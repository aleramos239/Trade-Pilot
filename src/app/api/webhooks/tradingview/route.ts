import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { routeExecutionPlan } from "@/lib/execution/router";
import { createExecutionPlan, normalizeSignal } from "@/lib/trading/engine";
import {
  appendExecutionAudit,
  appendExecutionRecords,
  appendOperatorAlerts,
  getUserByWebhookSecret,
  getWorkspaceForUser,
  readAppData,
  registerIdempotencyKey,
} from "@/lib/data/store";
import { decryptCredentialPayload } from "@/lib/security/credential-vault";
import type { BrokerConnection } from "@/lib/trading/types";

function sanitizePayload(payload: Record<string, unknown>) {
  const { webhookSecret, secret, password, apiSecret, ...safePayload } = payload;
  void webhookSecret;
  void secret;
  void password;
  void apiSecret;

  return safePayload;
}

async function getLiveCredentialsByConnectionId(
  userId: string,
  brokerConnections: BrokerConnection[],
) {
  const liveConnections = brokerConnections.filter(
    (connection) =>
      connection.mode === "live" &&
      connection.status === "connected" &&
      connection.liveEnabled &&
      connection.credentialVaultId,
  );

  if (!liveConnections.length) {
    return {};
  }

  const data = await readAppData();
  const credentialsByConnectionId = await Promise.all(
    liveConnections.map(async (connection) => {
      const vaultEntry = data.credentialVault.find(
        (entry) => entry.ownerId === userId && entry.id === connection.credentialVaultId,
      );

      if (!vaultEntry) {
        return null;
      }

      try {
        return [connection.id, await decryptCredentialPayload(vaultEntry.encryptedPayload)] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(credentialsByConnectionId.filter((item) => item !== null));
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload. Send a TradingView-style alert body." },
      { status: 400 },
    );
  }

  const webhookSecret =
    request.headers.get("x-trade-copilot-secret") ??
    (payload.webhookSecret ? String(payload.webhookSecret) : "");
  const user = await getUserByWebhookSecret(webhookSecret);

  if (!user) {
    return NextResponse.json(
      { error: "Valid webhook secret required. Use demo-webhook-secret for local testing." },
      { status: 401 },
    );
  }

  const workspace = await getWorkspaceForUser(user.id);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const signal = normalizeSignal(payload);
  const plan = createExecutionPlan(signal, workspace.accounts, workspace.copierRules);
  const idempotencyKey =
    request.headers.get("x-trade-copilot-idempotency-key") ??
    (payload.idempotencyKey ? String(payload.idempotencyKey) : "");
  const duplicate = idempotencyKey
    ? await registerIdempotencyKey(
        user.id,
        idempotencyKey,
        workspace.safetySettings.duplicateWindowSeconds,
      )
    : false;
  const credentialsByConnectionId =
    workspace.safetySettings.liveTradingUnlocked && !workspace.safetySettings.globalKillSwitch
      ? await getLiveCredentialsByConnectionId(user.id, workspace.brokerConnections)
      : {};
  const routeResult = await routeExecutionPlan(
    user.id,
    plan,
    workspace.brokerConnections,
    workspace.accountMappings,
    {
      duplicate,
      idempotencyKey,
      safetySettings: workspace.safetySettings,
      recentExecutionRecords: workspace.executionRecords,
      credentialsByConnectionId,
    },
  );
  await appendExecutionRecords(routeResult.records);
  await appendExecutionAudit({
    id: randomUUID(),
    ownerId: user.id,
    signalId: routeResult.signalId,
    source: "webhook",
    idempotencyKey: idempotencyKey || null,
    duplicate,
    payload: sanitizePayload(payload),
    executionPlan: plan,
    routeSummary: routeResult.summary,
    createdAt: plan.generatedAt,
  });
  const alertRecords = routeResult.records
    .filter(
      (record) =>
        record.status === "rejected" ||
        record.status === "safety_blocked" ||
        record.status === "live_submitted",
    )
    .map((record) => ({
      id: randomUUID(),
      ownerId: user.id,
      severity:
        record.status === "live_submitted"
          ? ("info" as const)
          : record.status === "safety_blocked"
            ? ("critical" as const)
            : ("warning" as const),
      status: "open" as const,
      source: "execution" as const,
      title:
        record.status === "live_submitted"
          ? `Live order submitted: ${record.accountName}`
          : `${record.status.replace("_", " ")}: ${record.accountName}`,
      message: record.reason,
      relatedSignalId: record.signalId,
      brokerConnectionId: record.brokerConnectionId,
      createdAt: record.completedAt,
      acknowledgedAt: null,
    }));

  await appendOperatorAlerts(alertRecords);

  return NextResponse.json({ ...plan, routeResult }, { status: plan.accepted ? 202 : 409 });
}
