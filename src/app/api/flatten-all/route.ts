import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { createBrokerAdapter } from "@/lib/brokers/registry";
import {
  appendExecutionRecords,
  getWorkspaceForUser,
  readAppData,
  updateSafetySettings,
  appendExecutionAudit,
  appendOperatorAlerts,
} from "@/lib/data/store";
import { decryptCredentialPayload } from "@/lib/security/credential-vault";
import type {
  BrokerConnection,
  BrokerPositionSnapshot,
  ExecutionRecord,
  OrderSide,
  PropAccount,
  TradingWorkspace,
} from "@/lib/trading/types";

function getFlattenSide(position: BrokerPositionSnapshot): OrderSide {
  return position.side === "short" ? "buy" : "sell";
}

function findAppAccount(
  position: BrokerPositionSnapshot,
  workspace: TradingWorkspace,
) {
  const mapping = workspace.accountMappings.find(
    (item) =>
      item.brokerConnectionId === position.brokerConnectionId &&
      item.brokerAccountId === position.brokerAccountId,
  );
  const account = mapping
    ? workspace.accounts.find((item) => item.id === mapping.appAccountId)
    : undefined;

  return {
    accountId: account?.id ?? mapping?.appAccountId ?? position.brokerAccountId,
    accountName: account?.name ?? `Broker account ${position.brokerAccountId}`,
    mapping,
  };
}

function buildPositionRecord({
  userId,
  signalId,
  position,
  connection,
  account,
  status,
  mode,
  reason,
  requestedAt,
  completedAt = requestedAt,
  latencyMs = 0,
  brokerRaw = null,
}: {
  userId: string;
  signalId: string;
  position: BrokerPositionSnapshot;
  connection: BrokerConnection | null;
  account: Pick<PropAccount, "id" | "name"> | { id: string; name: string };
  status: ExecutionRecord["status"];
  mode: ExecutionRecord["mode"];
  reason: string;
  requestedAt: string;
  completedAt?: string;
  latencyMs?: number;
  brokerRaw?: Record<string, unknown> | null;
}): ExecutionRecord {
  return {
    id: randomUUID(),
    ownerId: userId,
    signalId,
    brokerConnectionId: connection?.id ?? position.brokerConnectionId,
    accountId: account.id,
    accountName: account.name,
    brokerAccountId: position.brokerAccountId,
    platform: position.platform,
    symbol: position.symbol,
    side: getFlattenSide(position),
    quantity: position.quantity,
    orderType: "market",
    status,
    mode,
    brokerOrderId: null,
    reason,
    requestedAt,
    completedAt,
    latencyMs,
    brokerRaw,
  };
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const currentUser = user;
  const workspace = await getWorkspaceForUser(user.id);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const currentWorkspace = workspace;
  const now = new Date().toISOString();
  const signalId = randomUUID();
  const activePositions = currentWorkspace.brokerPositions.filter(
    (position) => position.active && position.quantity > 0,
  );
  const records: ExecutionRecord[] = [];
  const data = await readAppData();
  const positionsByConnection = Map.groupBy(
    activePositions,
    (position) => position.brokerConnectionId,
  );

  for (const [brokerConnectionId, positions] of positionsByConnection) {
    const connection =
      currentWorkspace.brokerConnections.find((item) => item.id === brokerConnectionId) ?? null;

    function pushBlocked(reason: string, status: ExecutionRecord["status"] = "safety_blocked") {
      positions.forEach((position) => {
        const appAccount = findAppAccount(position, currentWorkspace);
        records.push(
          buildPositionRecord({
            userId: currentUser.id,
            signalId,
            position,
            connection,
            account: {
              id: appAccount.accountId,
              name: appAccount.accountName,
            },
            status,
            mode: connection?.mode ?? "simulation",
            reason,
            requestedAt: now,
          }),
        );
      });
    }

    if (!connection) {
      pushBlocked("Broker connection for this reconciled position was not found.", "rejected");
      continue;
    }

    if (connection.mode !== "live") {
      pushBlocked("Flatten-all only submits live broker liquidation for live connections.");
      continue;
    }

    if (!currentWorkspace.safetySettings.liveTradingUnlocked) {
      pushBlocked("Workspace live trading unlock is off; live flatten request was not submitted.");
      continue;
    }

    if (connection.status !== "connected") {
      pushBlocked(`${connection.name} is ${connection.status}; live flatten request was not submitted.`);
      continue;
    }

    if (!connection.liveEnabled) {
      pushBlocked(`${connection.name} live toggle is disabled; live flatten request was not submitted.`);
      continue;
    }

    if (!connection.credentialVaultId) {
      pushBlocked("Live broker credentials are missing; live flatten request was not submitted.", "rejected");
      continue;
    }

    const vaultEntry = data.credentialVault.find(
      (entry) => entry.ownerId === currentUser.id && entry.id === connection.credentialVaultId,
    );

    if (!vaultEntry) {
      pushBlocked("Credential vault entry was not found; live flatten request was not submitted.", "rejected");
      continue;
    }

    const positionIds = positions.map((position) => position.brokerPositionId);
    const accountId = positions[0]?.brokerAccountId ?? connection.accountIds[0] ?? "";

    try {
      const credentials = await decryptCredentialPayload(vaultEntry.encryptedPayload);
      const adapter = createBrokerAdapter(connection);
      const result = await adapter.flattenAccount({
        accountId,
        brokerAccountId: accountId,
        credentials,
        positionIds,
        requestedAt: now,
      });

      positions.forEach((position) => {
        const appAccount = findAppAccount(position, currentWorkspace);
        records.push(
          buildPositionRecord({
            userId: currentUser.id,
            signalId,
            position,
            connection,
            account: {
              id: appAccount.accountId,
              name: appAccount.accountName,
            },
            status: result.status,
            mode: result.mode,
            reason: `${result.reason} Position ${position.brokerPositionId}.`,
            requestedAt: now,
            completedAt: result.completedAt,
            latencyMs: result.latencyMs,
            brokerRaw: {
              ...result.raw,
              brokerPositionId: position.brokerPositionId,
            },
          }),
        );
      });
    } catch (error) {
      pushBlocked(
        error instanceof Error ? error.message : "Live flatten request failed before broker submission.",
        "rejected",
      );
    }
  }

  if (records.length) {
    await appendExecutionRecords(records);
  }

  await updateSafetySettings(currentUser.id, {
    flattenAllRequestedAt: now,
    globalKillSwitch: true,
  });

  await appendExecutionAudit({
    id: randomUUID(),
    ownerId: currentUser.id,
    signalId,
    source: "flatten_all",
    idempotencyKey: null,
    duplicate: false,
    payload: {
      requestedAt: now,
      activePositions: activePositions.map((position) => ({
        brokerConnectionId: position.brokerConnectionId,
        brokerAccountId: position.brokerAccountId,
        brokerPositionId: position.brokerPositionId,
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
      })),
    },
    executionPlan: null,
    routeSummary: {
      simulated: records.filter((record) => record.status === "simulated").length,
      liveSubmitted: records.filter((record) => record.status === "live_submitted").length,
      blocked: records.filter((record) => record.status === "blocked").length,
      rejected: records.filter((record) => record.status === "rejected").length,
      safetyBlocked: records.filter((record) => record.status === "safety_blocked").length,
    },
    createdAt: now,
  });
  await appendOperatorAlerts([
    {
      id: randomUUID(),
      ownerId: currentUser.id,
      severity: records.some((record) => record.status === "rejected") ? "critical" : "warning",
      status: "open",
      source: "safety",
      title: "Flatten-all requested",
      message: activePositions.length
        ? `Flatten-all processed ${activePositions.length} reconciled position${activePositions.length === 1 ? "" : "s"}.`
        : "Flatten-all requested with no active reconciled positions.",
      relatedSignalId: signalId,
      brokerConnectionId: null,
      createdAt: now,
      acknowledgedAt: null,
    },
  ]);

  return NextResponse.json({
    ok: true,
    records,
    message: activePositions.length
      ? "Flatten-all processed against reconciled broker positions and global kill switch enabled."
      : "No active reconciled broker positions found. Global kill switch enabled.",
  });
}
