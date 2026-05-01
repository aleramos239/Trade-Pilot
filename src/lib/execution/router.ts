import { randomUUID } from "node:crypto";
import { createBrokerAdapter, findConnectionForAccount } from "@/lib/brokers/registry";
import type { BrokerCredentialInput } from "@/lib/security/credential-vault";
import type {
  BrokerConnection,
  ExecutionPlan,
  ExecutionRecord,
  ExecutionRouteResult,
  AccountMapping,
  SafetySettings,
} from "@/lib/trading/types";

export async function routeExecutionPlan(
  ownerId: string,
  plan: ExecutionPlan,
  brokerConnections: BrokerConnection[],
  accountMappings: AccountMapping[] = [],
  options: {
    safetySettings?: SafetySettings;
    idempotencyKey?: string;
    duplicate?: boolean;
    recentExecutionRecords?: ExecutionRecord[];
    credentialsByConnectionId?: Record<string, BrokerCredentialInput>;
  } = {},
): Promise<ExecutionRouteResult> {
  const signalId = randomUUID();
  const records: ExecutionRecord[] = [];
  const safetySettings = options.safetySettings;

  function safetyRecord(
    decision: ExecutionPlan["decisions"][number],
    reason: string,
    requestedAt: string,
    brokerConnectionId: string | null = null,
  ): ExecutionRecord {
    const mapping = accountMappings.find((item) => item.appAccountId === decision.accountId);

    return {
      id: randomUUID(),
      ownerId,
      signalId,
      brokerConnectionId,
      accountId: decision.accountId,
      accountName: decision.accountName,
      brokerAccountId: mapping?.brokerAccountId ?? null,
      platform: decision.platform,
      symbol: decision.symbol,
      side: decision.side,
      quantity: decision.quantity,
      orderType: plan.receivedSignal.orderType,
      status: "safety_blocked",
      mode: "simulation",
      brokerOrderId: null,
      reason,
      requestedAt,
      completedAt: requestedAt,
      latencyMs: 0,
      brokerRaw: null,
    };
  }

  for (const decision of plan.decisions) {
    const requestedAt = new Date().toISOString();
    const mapping = accountMappings.find((item) => item.appAccountId === decision.accountId);

    if (options.duplicate) {
      records.push(safetyRecord(decision, "Duplicate webhook idempotency key blocked.", requestedAt));
      continue;
    }

    if (safetySettings?.globalKillSwitch) {
      records.push(safetyRecord(decision, "Global kill switch is active.", requestedAt));
      continue;
    }

    if (safetySettings && decision.quantity > safetySettings.maxOrderQuantity) {
      records.push(
        safetyRecord(
          decision,
          `Order quantity ${decision.quantity} exceeds max ${safetySettings.maxOrderQuantity}.`,
          requestedAt,
        ),
      );
      continue;
    }

    if (decision.action === "blocked") {
      records.push({
        id: randomUUID(),
        ownerId,
        signalId,
        brokerConnectionId: null,
        accountId: decision.accountId,
        accountName: decision.accountName,
        brokerAccountId: mapping?.brokerAccountId ?? null,
        platform: decision.platform,
        symbol: decision.symbol,
        side: decision.side,
        quantity: decision.quantity,
        orderType: plan.receivedSignal.orderType,
        status: "blocked",
        mode: "simulation",
        brokerOrderId: null,
        reason: decision.reason,
        requestedAt,
        completedAt: requestedAt,
        latencyMs: 0,
        brokerRaw: null,
      });
      continue;
    }

    const connection = findConnectionForAccount(
      brokerConnections,
      decision.platform,
      mapping?.brokerAccountId ?? decision.accountId,
    );

    if (!connection) {
      records.push({
        id: randomUUID(),
        ownerId,
        signalId,
        brokerConnectionId: null,
        accountId: decision.accountId,
        accountName: decision.accountName,
        brokerAccountId: mapping?.brokerAccountId ?? null,
        platform: decision.platform,
        symbol: decision.symbol,
        side: decision.side,
        quantity: decision.quantity,
        orderType: plan.receivedSignal.orderType,
        status: "rejected",
        mode: "simulation",
        brokerOrderId: null,
        reason: "No connected broker adapter is mapped to this account.",
        requestedAt,
        completedAt: requestedAt,
        latencyMs: 0,
        brokerRaw: null,
      });
      continue;
    }

    if (
      safetySettings &&
      options.recentExecutionRecords?.some(
        (record) =>
          record.accountId === decision.accountId &&
          (record.status === "simulated" || record.status === "live_submitted") &&
          Date.parse(requestedAt) - Date.parse(record.requestedAt) <
            safetySettings.minSecondsBetweenOrders * 1000,
      )
    ) {
      records.push(
        safetyRecord(
          decision,
          `Rate limit blocked: wait ${safetySettings.minSecondsBetweenOrders}s between account orders.`,
          requestedAt,
          connection.id,
        ),
      );
      continue;
    }

    if (
      connection.mode === "live" &&
      (!safetySettings?.liveTradingUnlocked || !connection.liveEnabled)
    ) {
      records.push(
        safetyRecord(
          decision,
          "Live execution is locked. Enable workspace live trading and this broker connection first.",
          requestedAt,
          connection.id,
        ),
      );
      continue;
    }

    const adapter = createBrokerAdapter(connection);
    const result = await adapter.placeOrder({
      accountId: decision.accountId,
      accountName: decision.accountName,
      brokerAccountId: mapping?.brokerAccountId ?? null,
      platform: decision.platform,
      symbol: decision.symbol,
      side: decision.side,
      quantity: decision.quantity,
      orderType: plan.receivedSignal.orderType,
      price: plan.receivedSignal.price,
      credentials: options.credentialsByConnectionId?.[connection.id],
      requestedAt,
    });

    records.push({
      id: randomUUID(),
      ownerId,
      signalId,
      brokerConnectionId: connection.id,
      accountId: decision.accountId,
      accountName: decision.accountName,
      brokerAccountId: mapping?.brokerAccountId ?? null,
      platform: decision.platform,
      symbol: decision.symbol,
      side: decision.side,
      quantity: decision.quantity,
      orderType: plan.receivedSignal.orderType,
      status: result.status,
      mode: result.mode,
      brokerOrderId: result.brokerOrderId,
      reason: result.reason,
      requestedAt,
      completedAt: result.completedAt,
      latencyMs: result.latencyMs,
      brokerRaw: result.raw ?? null,
    });
  }

  return {
    signalId,
    records,
    summary: {
      simulated: records.filter((record) => record.status === "simulated").length,
      liveSubmitted: records.filter((record) => record.status === "live_submitted").length,
      blocked: records.filter((record) => record.status === "blocked").length,
      rejected: records.filter((record) => record.status === "rejected").length,
      safetyBlocked: records.filter((record) => record.status === "safety_blocked").length,
    },
  };
}
