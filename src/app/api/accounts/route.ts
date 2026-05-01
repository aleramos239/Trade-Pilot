import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getWorkspaceForUser, upsertAccountMapping, upsertPropAccount } from "@/lib/data/store";
import type { AccountMapping, BrokerPlatform, PropAccount } from "@/lib/trading/types";

const SUPPORTED_PLATFORMS: BrokerPlatform[] = ["Tradovate", "Rithmic", "ProjectX"];

function isSupportedPlatform(platform: string): platform is BrokerPlatform {
  return SUPPORTED_PLATFORMS.includes(platform as BrokerPlatform);
}

function numberFrom(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    discoveredAccountId?: string;
    name?: string;
    firm?: string;
    platform?: string;
    role?: "leader" | "follower";
    balance?: number;
    maxDailyLoss?: number;
    trailingDrawdownLimit?: number;
    multiplier?: number;
  };
  const workspace = await getWorkspaceForUser(user.id);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const discoveredAccount = payload.discoveredAccountId
    ? workspace.discoveredBrokerAccounts.find((account) => account.id === payload.discoveredAccountId)
    : null;
  const platform = discoveredAccount?.platform ?? payload.platform ?? "";

  if (!isSupportedPlatform(platform)) {
    return NextResponse.json({ error: "Choose Tradovate, Rithmic, or ProjectX." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const account: PropAccount = {
    id: randomUUID(),
    ownerId: user.id,
    name:
      payload.name?.trim() ||
      discoveredAccount?.name ||
      `${platform} ${payload.role === "leader" ? "leader" : "follower"}`,
    firm: payload.firm?.trim() || discoveredAccount?.accountType || "Unassigned firm",
    platform,
    status: "paused",
    balance: numberFrom(payload.balance, 0),
    dailyPnl: 0,
    drawdownUsed: 0,
    maxDailyLoss: numberFrom(payload.maxDailyLoss, 0),
    trailingDrawdownLimit: numberFrom(payload.trailingDrawdownLimit, 0),
    multiplier: numberFrom(payload.multiplier, payload.role === "leader" ? 1 : 1),
    copyEnabled: payload.role !== "leader",
    latencyMs: 0,
  };

  await upsertPropAccount(account);

  if (discoveredAccount) {
    const mapping: AccountMapping = {
      id: randomUUID(),
      ownerId: user.id,
      appAccountId: account.id,
      brokerConnectionId: discoveredAccount.brokerConnectionId,
      brokerAccountId: discoveredAccount.brokerAccountId,
      platform: discoveredAccount.platform,
      createdAt: now,
      updatedAt: now,
    };
    await upsertAccountMapping(mapping);
  }

  const updatedWorkspace = await getWorkspaceForUser(user.id);
  return NextResponse.json({ account, workspace: updatedWorkspace }, { status: 201 });
}
