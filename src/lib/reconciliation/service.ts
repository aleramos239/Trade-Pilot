import { randomUUID } from "node:crypto";
import { createBrokerAdapter } from "@/lib/brokers/registry";
import type { BrokerReconciliationResult } from "@/lib/brokers/types";
import {
  appendOperatorAlerts,
  getWorkspaceForUser,
  readAppData,
  replaceBrokerReconciliation,
  updateAppData,
} from "@/lib/data/store";
import { decryptCredentialPayload } from "@/lib/security/credential-vault";
import type {
  BrokerConnection,
  BrokerFillSnapshot,
  BrokerOrderSnapshot,
  BrokerPositionSnapshot,
  OperatorAlert,
} from "@/lib/trading/types";

export async function reconcileBrokerConnection(userId: string, brokerConnectionId: string) {
  const workspace = await getWorkspaceForUser(userId);
  const connection = workspace?.brokerConnections.find((item) => item.id === brokerConnectionId);

  if (!workspace || !connection) {
    return {
      ok: false,
      error: "Broker connection not found.",
      status: 404,
    };
  }

  if (connection.mode !== "live") {
    return {
      ok: false,
      error: "Only live broker connections can be reconciled.",
      status: 400,
    };
  }

  if (!connection.credentialVaultId) {
    return {
      ok: false,
      error: "This connection does not have stored credentials for reconciliation.",
      status: 400,
    };
  }

  const data = await readAppData();
  const vaultEntry = data.credentialVault.find(
    (entry) => entry.ownerId === userId && entry.id === connection.credentialVaultId,
  );

  if (!vaultEntry) {
    return {
      ok: false,
      error: "Credential vault entry not found.",
      status: 404,
    };
  }

  const adapter = createBrokerAdapter(connection);

  if (!adapter.reconcileAccounts) {
    return {
      ok: false,
      error: `${connection.platform} reconciliation is not implemented yet.`,
      status: 400,
    };
  }

  const credentials = await decryptCredentialPayload(vaultEntry.encryptedPayload);
  const reconciliation = await adapter.reconcileAccounts(credentials);
  const positions: BrokerPositionSnapshot[] = reconciliation.positions.map((position) => ({
    id: randomUUID(),
    ownerId: userId,
    brokerConnectionId: connection.id,
    syncedAt: reconciliation.syncedAt,
    ...position,
  }));
  const orders: BrokerOrderSnapshot[] = reconciliation.orders.map((order) => ({
    id: randomUUID(),
    ownerId: userId,
    brokerConnectionId: connection.id,
    syncedAt: reconciliation.syncedAt,
    ...order,
  }));
  const fills: BrokerFillSnapshot[] = reconciliation.fills.map((fill) => ({
    id: randomUUID(),
    ownerId: userId,
    brokerConnectionId: connection.id,
    syncedAt: reconciliation.syncedAt,
    ...fill,
  }));

  if (reconciliation.ok) {
    await replaceBrokerReconciliation({
      userId,
      brokerConnectionId: connection.id,
      positions,
      orders,
      fills,
    });
  }

  await updateAppData((nextData) => {
    nextData.brokerConnections = nextData.brokerConnections.map((item) => {
      if (item.ownerId !== userId || item.id !== connection.id) {
        return item;
      }

      return {
        ...item,
        status: reconciliation.status,
        lastError: reconciliation.ok ? null : reconciliation.message,
        lastValidatedAt: reconciliation.syncedAt,
        lastHeartbeatAt: reconciliation.syncedAt,
      };
    });
  });

  const alerts = buildReconciliationAlerts(userId, connection, reconciliation, positions, orders);

  if (alerts.length) {
    await appendOperatorAlerts(alerts);
  }

  return {
    ok: true,
    reconciliation,
    positions,
    orders,
    fills,
    alerts,
  };
}

export async function reconcileLiveConnectionsForUser(userId: string) {
  const workspace = await getWorkspaceForUser(userId);
  const liveConnections = workspace?.brokerConnections.filter(
    (connection) => connection.mode === "live" && connection.credentialVaultId,
  ) ?? [];
  const results = [];

  for (const connection of liveConnections) {
    results.push(await reconcileBrokerConnection(userId, connection.id));
  }

  return results;
}

function buildReconciliationAlerts(
  ownerId: string,
  connection: BrokerConnection,
  reconciliation: BrokerReconciliationResult,
  positions: BrokerPositionSnapshot[],
  orders: BrokerOrderSnapshot[],
): OperatorAlert[] {
  const now = reconciliation.syncedAt;
  const activePositions = positions.filter((position) => position.active && position.quantity > 0);
  const workingOrders = orders.filter((order) =>
    ["PendingCancel", "PendingNew", "PendingReplace", "Suspended", "Working"].includes(order.status),
  );
  const alerts: OperatorAlert[] = [];

  if (!reconciliation.ok) {
    alerts.push({
      id: randomUUID(),
      ownerId,
      severity: "warning",
      status: "open",
      source: "broker_sync",
      title: `${connection.name} sync failed`,
      message: reconciliation.message,
      relatedSignalId: null,
      brokerConnectionId: connection.id,
      createdAt: now,
      acknowledgedAt: null,
    });
  }

  if (activePositions.length) {
    alerts.push({
      id: randomUUID(),
      ownerId,
      severity: "critical",
      status: "open",
      source: "broker_sync",
      title: `${activePositions.length} open position${activePositions.length === 1 ? "" : "s"}`,
      message: `${connection.name} has reconciled open exposure.`,
      relatedSignalId: null,
      brokerConnectionId: connection.id,
      createdAt: now,
      acknowledgedAt: null,
    });
  }

  if (workingOrders.length) {
    alerts.push({
      id: randomUUID(),
      ownerId,
      severity: "warning",
      status: "open",
      source: "broker_sync",
      title: `${workingOrders.length} working order${workingOrders.length === 1 ? "" : "s"}`,
      message: `${connection.name} has working broker orders in the latest sync.`,
      relatedSignalId: null,
      brokerConnectionId: connection.id,
      createdAt: now,
      acknowledgedAt: null,
    });
  }

  return alerts;
}
