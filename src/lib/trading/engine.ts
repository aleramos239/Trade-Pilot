import type { AutomationSignal, CopierRule, ExecutionDecision, ExecutionPlan, PropAccount } from "./types";

const TICK_RISK_VALUE: Record<string, number> = {
  NQ: 5,
  MNQ: 0.5,
  ES: 12.5,
  MES: 1.25,
};

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeSignal(payload: Record<string, unknown>): AutomationSignal {
  const side = String(payload.side ?? payload.action ?? "buy").toLowerCase();
  const orderType = String(payload.orderType ?? payload.type ?? "market").toLowerCase();

  return {
    source: "tradingview",
    strategy: String(payload.strategy ?? payload.alertName ?? "Webhook strategy"),
    symbol: String(payload.symbol ?? "NQ").toUpperCase(),
    side: side === "sell" ? "sell" : "buy",
    orderType: orderType === "limit" || orderType === "stop" ? orderType : "market",
    quantity: Math.max(1, normalizeNumber(payload.quantity ?? payload.qty, 1)),
    price: payload.price === undefined ? undefined : normalizeNumber(payload.price, 0),
    stopLossTicks:
      payload.stopLossTicks === undefined
        ? undefined
        : Math.max(0, normalizeNumber(payload.stopLossTicks, 0)),
    takeProfitTicks:
      payload.takeProfitTicks === undefined
        ? undefined
        : Math.max(0, normalizeNumber(payload.takeProfitTicks, 0)),
    timestamp: new Date().toISOString(),
  };
}

function estimateOrderRisk(signal: AutomationSignal, quantity: number) {
  const tickValue = TICK_RISK_VALUE[signal.symbol] ?? 5;
  const stopTicks = signal.stopLossTicks ?? 30;
  return tickValue * stopTicks * quantity;
}

function buildDecision(
  signal: AutomationSignal,
  accountId: string,
  accounts: PropAccount[],
  activeRule: CopierRule,
): ExecutionDecision {
  const account = accounts.find((item) => item.id === accountId);

  if (!account) {
    return {
      accountId,
      accountName: "Unknown account",
      firm: "Unknown",
      platform: "Tradovate",
      symbol: signal.symbol,
      quantity: 0,
      side: signal.side,
      action: "blocked",
      reason: "Follower account is not configured.",
      latencyMs: 0,
      riskAfterOrder: {
        dailyLossBuffer: 0,
        drawdownRemaining: 0,
      },
    };
  }

  const quantity = Math.min(
    Math.max(1, Math.round(signal.quantity * account.multiplier)),
    activeRule.maxContractsPerFollower,
  );
  const estimatedRisk = estimateOrderRisk(signal, quantity);
  const dailyLossBuffer = account.maxDailyLoss + Math.min(account.dailyPnl, 0) - estimatedRisk;
  const drawdownRemaining =
    account.trailingDrawdownLimit * (1 - account.drawdownUsed / 100) - estimatedRisk;

  if (account.status !== "online") {
    return {
      accountId: account.id,
      accountName: account.name,
      firm: account.firm,
      platform: account.platform,
      symbol: signal.symbol,
      quantity,
      side: signal.side,
      action: "blocked",
      reason: `Account is ${account.status}.`,
      latencyMs: account.latencyMs,
      riskAfterOrder: { dailyLossBuffer, drawdownRemaining },
    };
  }

  if (!account.copyEnabled) {
    return {
      accountId: account.id,
      accountName: account.name,
      firm: account.firm,
      platform: account.platform,
      symbol: signal.symbol,
      quantity,
      side: signal.side,
      action: "blocked",
      reason: "Copying is disabled for this account.",
      latencyMs: account.latencyMs,
      riskAfterOrder: { dailyLossBuffer, drawdownRemaining },
    };
  }

  if (dailyLossBuffer <= 0 || drawdownRemaining <= 0) {
    return {
      accountId: account.id,
      accountName: account.name,
      firm: account.firm,
      platform: account.platform,
      symbol: signal.symbol,
      quantity,
      side: signal.side,
      action: "blocked",
      reason: "Risk guard would breach daily loss or trailing drawdown.",
      latencyMs: account.latencyMs,
      riskAfterOrder: { dailyLossBuffer, drawdownRemaining },
    };
  }

  return {
    accountId: account.id,
    accountName: account.name,
    firm: account.firm,
    platform: account.platform,
    symbol: signal.symbol,
    quantity,
    side: signal.side,
    action: "queued",
    reason: "Passed copier, sizing, and prop-firm risk checks.",
    latencyMs: account.latencyMs,
    riskAfterOrder: { dailyLossBuffer, drawdownRemaining },
  };
}

export function createExecutionPlan(
  signal: AutomationSignal,
  accounts: PropAccount[],
  copierRules: CopierRule[],
): ExecutionPlan {
  const activeRule = copierRules.find((rule) => rule.enabled);

  if (!activeRule) {
    return {
      accepted: false,
      receivedSignal: signal,
      leaderAccountId: "",
      generatedAt: new Date().toISOString(),
      decisions: [],
      warnings: ["No enabled copier rule was found."],
    };
  }

  const mappedSymbol = activeRule.symbolMap[signal.symbol];
  const normalizedSignal = {
    ...signal,
    symbol: mappedSymbol ?? signal.symbol,
  };
  const decisions = activeRule.followerAccountIds.map((accountId) =>
    buildDecision(normalizedSignal, accountId, accounts, activeRule),
  );
  const warnings = [];

  if (!mappedSymbol) {
    warnings.push(`No symbol map was found for ${signal.symbol}; using the incoming symbol.`);
  }

  if (!signal.stopLossTicks) {
    warnings.push("No stop loss was supplied; risk estimate used the default 30 tick stop.");
  }

  return {
    accepted: decisions.some((decision) => decision.action === "queued"),
    receivedSignal: normalizedSignal,
    leaderAccountId: activeRule.leaderAccountId,
    generatedAt: new Date().toISOString(),
    decisions,
    warnings,
  };
}
