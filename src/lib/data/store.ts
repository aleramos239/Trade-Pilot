import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  brokerConnections,
  copierRules,
  demoUser,
  propAccounts,
  recentExecutions,
} from "@/lib/trading/mock-data";
import {
  isPostgresConfigured,
  readAppDataFromPostgres,
  shouldRequirePostgres,
  writeAppDataToPostgres,
} from "@/lib/data/postgres";
import type {
  AccountMapping,
  AppData,
  BrokerFillSnapshot,
  BrokerOrderSnapshot,
  BrokerPositionSnapshot,
  DiscoveredBrokerAccount,
  ExecutionAudit,
  ExecutionRecord,
  OperatorAlert,
  SafetySettings,
  TradingWorkspace,
} from "@/lib/trading/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "trade-copilot.json");

let writeQueue = Promise.resolve();

function createDefaultSafetySettings(ownerId: string): SafetySettings {
  return {
    ownerId,
    globalKillSwitch: false,
    liveTradingUnlocked: false,
    maxOrderQuantity: 4,
    minSecondsBetweenOrders: 2,
    duplicateWindowSeconds: 120,
    flattenAllRequestedAt: null,
  };
}

function createSeedData(): AppData {
  return {
    users: [demoUser],
    sessions: [],
    propAccounts,
    copierRules,
    brokerConnections,
    credentialVault: [],
    discoveredBrokerAccounts: [],
    accountMappings: [],
    brokerPositions: [],
    brokerOrders: [],
    brokerFills: [],
    safetySettings: [createDefaultSafetySettings(demoUser.id)],
    idempotencyRecords: [],
    executionRecords: [],
    executionAudits: [],
    alerts: [],
    recentExecutions,
  };
}

function normalizeExecutionRecord(record: ExecutionRecord): ExecutionRecord {
  return {
    ...record,
    brokerRaw: record.brokerRaw ?? null,
  };
}

function normalizeUser(user: AppData["users"][number]) {
  return {
    ...user,
    workspaceId: user.workspaceId ?? user.id,
  };
}

function normalizeAppData(data: Partial<AppData>): AppData {
  return {
    users: (data.users?.length ? data.users : [demoUser]).map(normalizeUser),
    sessions: data.sessions ?? [],
    propAccounts: data.propAccounts ?? propAccounts,
    copierRules: data.copierRules ?? copierRules,
    brokerConnections: (data.brokerConnections ?? brokerConnections).map((connection) => ({
      ...connection,
      credentialVaultId: connection.credentialVaultId ?? null,
      liveEnabled: connection.liveEnabled ?? false,
      lastError: connection.lastError ?? null,
      lastValidatedAt: connection.lastValidatedAt ?? null,
    })),
    credentialVault: data.credentialVault ?? [],
    discoveredBrokerAccounts: data.discoveredBrokerAccounts ?? [],
    accountMappings: data.accountMappings ?? [],
    brokerPositions: data.brokerPositions ?? [],
    brokerOrders: data.brokerOrders ?? [],
    brokerFills: data.brokerFills ?? [],
    safetySettings: data.safetySettings ?? [createDefaultSafetySettings(demoUser.id)],
    idempotencyRecords: data.idempotencyRecords ?? [],
    executionRecords: (data.executionRecords ?? []).map(normalizeExecutionRecord),
    executionAudits: data.executionAudits ?? [],
    alerts: data.alerts ?? [],
    recentExecutions: data.recentExecutions ?? recentExecutions,
  };
}

async function writeAppData(data: AppData) {
  if (isPostgresConfigured()) {
    await writeAppDataToPostgres(data);
    return;
  }

  if (shouldRequirePostgres()) {
    throw new Error(
      "DATABASE_URL is required in production. Set ALLOW_JSON_STORE_IN_PRODUCTION=true only for temporary diagnostics.",
    );
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function ensureStoreFile() {
  if (isPostgresConfigured()) {
    return;
  }

  if (shouldRequirePostgres()) {
    throw new Error(
      "DATABASE_URL is required in production. Set ALLOW_JSON_STORE_IN_PRODUCTION=true only for temporary diagnostics.",
    );
  }

  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeAppData(createSeedData());
  }
}

export async function readAppData(): Promise<AppData> {
  if (isPostgresConfigured()) {
    return normalizeAppData(await readAppDataFromPostgres());
  }

  await ensureStoreFile();
  const raw = await readFile(DATA_FILE, "utf8");
  return normalizeAppData(JSON.parse(raw.replace(/^\uFEFF/, "")) as Partial<AppData>);
}

export async function updateAppData(mutator: (data: AppData) => AppData | void) {
  writeQueue = writeQueue.then(async () => {
    const data = await readAppData();
    const nextData = mutator(data) ?? data;
    await writeAppData(nextData);
  });

  await writeQueue;
  return readAppData();
}

export async function getWorkspaceForUser(userId: string): Promise<TradingWorkspace | null> {
  const data = await readAppData();
  const user = data.users.find((item) => item.id === userId);

  if (!user) {
    return null;
  }

  return {
    user,
    accounts: data.propAccounts.filter((account) => account.ownerId === userId),
    copierRules: data.copierRules.filter((rule) => rule.ownerId === userId),
    brokerConnections: data.brokerConnections.filter((connection) => connection.ownerId === userId),
    discoveredBrokerAccounts: data.discoveredBrokerAccounts.filter(
      (account) => account.ownerId === userId,
    ),
    accountMappings: data.accountMappings.filter((mapping) => mapping.ownerId === userId),
    brokerPositions: data.brokerPositions
      .filter((position) => position.ownerId === userId)
      .sort((a, b) => b.syncedAt.localeCompare(a.syncedAt)),
    brokerOrders: data.brokerOrders
      .filter((order) => order.ownerId === userId)
      .sort((a, b) => b.syncedAt.localeCompare(a.syncedAt)),
    brokerFills: data.brokerFills
      .filter((fill) => fill.ownerId === userId)
      .sort((a, b) => b.syncedAt.localeCompare(a.syncedAt)),
    safetySettings:
      data.safetySettings.find((settings) => settings.ownerId === userId) ??
      createDefaultSafetySettings(userId),
    executionRecords: data.executionRecords
      .filter((execution) => execution.ownerId === userId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    executionAudits: data.executionAudits
      .filter((audit) => audit.ownerId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    alerts: data.alerts
      .filter((alert) => alert.ownerId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    recentExecutions: data.recentExecutions.filter((execution) => execution.ownerId === userId),
  };
}

export async function updateSafetySettings(
  userId: string,
  updates: Partial<Omit<SafetySettings, "ownerId">>,
) {
  return updateAppData((data) => {
    const existing =
      data.safetySettings.find((settings) => settings.ownerId === userId) ??
      createDefaultSafetySettings(userId);

    data.safetySettings = [
      { ...existing, ...updates, ownerId: userId },
      ...data.safetySettings.filter((settings) => settings.ownerId !== userId),
    ];
  });
}

export async function getUserByWebhookSecret(secret: string) {
  const data = await readAppData();
  return data.users.find((user) => user.webhookSecret === secret) ?? null;
}

export async function updateAccountState(
  userId: string,
  accountId: string,
  updates: { copyEnabled?: boolean; status?: "online" | "paused" },
) {
  return updateAppData((data) => {
    data.propAccounts = data.propAccounts.map((account) => {
      if (account.ownerId !== userId || account.id !== accountId) {
        return account;
      }

      return {
        ...account,
        copyEnabled: updates.copyEnabled ?? account.copyEnabled,
        status: updates.status ?? account.status,
      };
    });
  });
}

export async function updateCopierRuleState(
  userId: string,
  ruleId: string,
  updates: { enabled?: boolean },
) {
  return updateAppData((data) => {
    data.copierRules = data.copierRules.map((rule) => {
      if (rule.ownerId !== userId || rule.id !== ruleId) {
        return rule;
      }

      return {
        ...rule,
        enabled: updates.enabled ?? rule.enabled,
      };
    });
  });
}

export async function appendExecutionRecords(records: ExecutionRecord[]) {
  return updateAppData((data) => {
    data.executionRecords = [...records.map(normalizeExecutionRecord), ...data.executionRecords].slice(0, 250);
  });
}

export async function appendExecutionAudit(audit: ExecutionAudit) {
  return updateAppData((data) => {
    data.executionAudits = [
      audit,
      ...data.executionAudits.filter(
        (item) => item.ownerId !== audit.ownerId || item.signalId !== audit.signalId,
      ),
    ].slice(0, 250);
  });
}

export async function appendOperatorAlerts(alerts: OperatorAlert[]) {
  if (!alerts.length) {
    return readAppData();
  }

  return updateAppData((data) => {
    data.alerts = [...alerts, ...data.alerts].slice(0, 500);
  });
}

export async function acknowledgeOperatorAlert(userId: string, alertId: string) {
  return updateAppData((data) => {
    data.alerts = data.alerts.map((alert) => {
      if (alert.ownerId !== userId || alert.id !== alertId) {
        return alert;
      }

      return {
        ...alert,
        status: "acknowledged",
        acknowledgedAt: new Date().toISOString(),
      };
    });
  });
}

export async function registerIdempotencyKey(
  userId: string,
  key: string,
  duplicateWindowSeconds: number,
) {
  const now = new Date();
  let duplicate = false;

  await updateAppData((data) => {
    const existing = data.idempotencyRecords.find(
      (record) => record.ownerId === userId && record.key === key,
    );

    if (
      existing &&
      now.getTime() - Date.parse(existing.firstSeenAt) < duplicateWindowSeconds * 1000
    ) {
      duplicate = true;
      existing.lastSeenAt = now.toISOString();
      return;
    }

    data.idempotencyRecords = [
      {
        id: randomUUID(),
        ownerId: userId,
        key,
        firstSeenAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        routeSignalId: null,
      },
      ...data.idempotencyRecords.filter(
        (record) =>
          now.getTime() - Date.parse(record.firstSeenAt) < duplicateWindowSeconds * 1000,
      ),
    ].slice(0, 500);
  });

  return duplicate;
}

export async function replaceDiscoveredBrokerAccounts(
  userId: string,
  brokerConnectionId: string,
  discoveredAccounts: DiscoveredBrokerAccount[],
) {
  return updateAppData((data) => {
    data.discoveredBrokerAccounts = [
      ...discoveredAccounts,
      ...data.discoveredBrokerAccounts.filter(
        (account) =>
          account.ownerId !== userId || account.brokerConnectionId !== brokerConnectionId,
      ),
    ];
  });
}

export async function upsertAccountMapping(mapping: AccountMapping) {
  return updateAppData((data) => {
    data.accountMappings = [
      mapping,
      ...data.accountMappings.filter(
        (item) => item.ownerId !== mapping.ownerId || item.appAccountId !== mapping.appAccountId,
      ),
    ];
  });
}

export async function replaceBrokerReconciliation({
  userId,
  brokerConnectionId,
  positions,
  orders,
  fills,
}: {
  userId: string;
  brokerConnectionId: string;
  positions: BrokerPositionSnapshot[];
  orders: BrokerOrderSnapshot[];
  fills: BrokerFillSnapshot[];
}) {
  return updateAppData((data) => {
    data.brokerPositions = [
      ...positions,
      ...data.brokerPositions.filter(
        (position) =>
          position.ownerId !== userId || position.brokerConnectionId !== brokerConnectionId,
      ),
    ];
    data.brokerOrders = [
      ...orders,
      ...data.brokerOrders.filter(
        (order) => order.ownerId !== userId || order.brokerConnectionId !== brokerConnectionId,
      ),
    ].slice(0, 500);
    data.brokerFills = [
      ...fills,
      ...data.brokerFills.filter(
        (fill) => fill.ownerId !== userId || fill.brokerConnectionId !== brokerConnectionId,
      ),
    ].slice(0, 500);
  });
}
