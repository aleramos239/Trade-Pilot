import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  brokerConnections,
  copierRules,
  demoUser,
  propAccounts,
  recentExecutions,
} from "@/lib/trading/mock-data";
import type { AppData, SafetySettings } from "@/lib/trading/types";

const TABLES = {
  users: "trade_copilot_users",
  sessions: "trade_copilot_sessions",
  propAccounts: "trade_copilot_prop_accounts",
  copierRules: "trade_copilot_copier_rules",
  brokerConnections: "trade_copilot_broker_connections",
  credentialVault: "trade_copilot_credential_vault",
  discoveredBrokerAccounts: "trade_copilot_discovered_broker_accounts",
  accountMappings: "trade_copilot_account_mappings",
  brokerPositions: "trade_copilot_broker_positions",
  brokerOrders: "trade_copilot_broker_orders",
  brokerFills: "trade_copilot_broker_fills",
  safetySettings: "trade_copilot_safety_settings",
  idempotencyRecords: "trade_copilot_idempotency_records",
  executionRecords: "trade_copilot_execution_records",
  executionAudits: "trade_copilot_execution_audits",
  alerts: "trade_copilot_alerts",
  recentExecutions: "trade_copilot_recent_executions",
} as const satisfies Record<keyof AppData, string>;

const APPEND_ONLY_TABLES = new Set<keyof AppData>(["executionRecords", "executionAudits"]);

let pool: Pool | null = null;
let initialized = false;

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

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for the Postgres data store.");
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }

  return pool;
}

export function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function shouldRequirePostgres() {
  return process.env.NODE_ENV === "production" && process.env.ALLOW_JSON_STORE_IN_PRODUCTION !== "true";
}

function getEntityId(collection: keyof AppData, item: unknown) {
  const record = item as Record<string, unknown>;

  if (collection === "safetySettings") {
    return String(record.ownerId);
  }

  return String(record.id ?? record.key ?? randomUUID());
}

function getOwnerId(item: unknown) {
  const record = item as Record<string, unknown>;
  return record.ownerId ? String(record.ownerId) : null;
}

async function createEntityTable(client: PoolClient, tableName: string) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      entity_id text PRIMARY KEY,
      owner_id text,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS ${tableName}_owner_id_idx ON ${tableName} (owner_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS ${tableName}_payload_gin_idx ON ${tableName} USING gin (payload)`);
}

async function ensurePostgresSchema() {
  if (initialized) {
    return;
  }

  const client = await getPool().connect();

  try {
    for (const tableName of Object.values(TABLES)) {
      await createEntityTable(client, tableName);
    }

    initialized = true;
  } finally {
    client.release();
  }
}

async function seedIfEmpty(client: PoolClient) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${TABLES.users}`);

  if (result.rows[0]?.count > 0) {
    return;
  }

  await writeAppDataToPostgres(createSeedData(), client);
}

async function readCollection<T>(client: PoolClient, collection: keyof AppData): Promise<T[]> {
  const result = await client.query(`SELECT payload FROM ${TABLES[collection]} ORDER BY updated_at DESC`);
  return result.rows.map((row) => row.payload as T);
}

export async function readAppDataFromPostgres(): Promise<AppData> {
  await ensurePostgresSchema();

  const client = await getPool().connect();

  try {
    await seedIfEmpty(client);

    return {
      users: await readCollection(client, "users"),
      sessions: await readCollection(client, "sessions"),
      propAccounts: await readCollection(client, "propAccounts"),
      copierRules: await readCollection(client, "copierRules"),
      brokerConnections: await readCollection(client, "brokerConnections"),
      credentialVault: await readCollection(client, "credentialVault"),
      discoveredBrokerAccounts: await readCollection(client, "discoveredBrokerAccounts"),
      accountMappings: await readCollection(client, "accountMappings"),
      brokerPositions: await readCollection(client, "brokerPositions"),
      brokerOrders: await readCollection(client, "brokerOrders"),
      brokerFills: await readCollection(client, "brokerFills"),
      safetySettings: await readCollection(client, "safetySettings"),
      idempotencyRecords: await readCollection(client, "idempotencyRecords"),
      executionRecords: await readCollection(client, "executionRecords"),
      executionAudits: await readCollection(client, "executionAudits"),
      alerts: await readCollection(client, "alerts"),
      recentExecutions: await readCollection(client, "recentExecutions"),
    };
  } finally {
    client.release();
  }
}

async function replaceCollection(
  client: PoolClient,
  collection: keyof AppData,
  items: unknown[],
) {
  const tableName = TABLES[collection];

  if (!APPEND_ONLY_TABLES.has(collection)) {
    await client.query(`DELETE FROM ${tableName}`);
  }

  for (const item of items) {
    if (APPEND_ONLY_TABLES.has(collection)) {
      await client.query(
        `
        INSERT INTO ${tableName} (entity_id, owner_id, payload, updated_at)
        VALUES ($1, $2, $3::jsonb, now())
        ON CONFLICT (entity_id) DO NOTHING
        `,
        [getEntityId(collection, item), getOwnerId(item), JSON.stringify(item)],
      );
      continue;
    }

    await client.query(
      `
      INSERT INTO ${tableName} (entity_id, owner_id, payload, updated_at)
      VALUES ($1, $2, $3::jsonb, now())
      ON CONFLICT (entity_id) DO UPDATE
      SET owner_id = excluded.owner_id,
          payload = excluded.payload,
          updated_at = now()
      `,
      [getEntityId(collection, item), getOwnerId(item), JSON.stringify(item)],
    );
  }
}

export async function writeAppDataToPostgres(data: AppData, existingClient?: PoolClient) {
  if (!existingClient) {
    await ensurePostgresSchema();
  }

  const client = existingClient ?? (await getPool().connect());
  const ownClient = !existingClient;

  try {
    if (ownClient) {
      await client.query("BEGIN");
    }

    for (const collection of Object.keys(TABLES) as (keyof AppData)[]) {
      await replaceCollection(client, collection, data[collection] as unknown[]);
    }

    if (ownClient) {
      await client.query("COMMIT");
    }
  } catch (error) {
    if (ownClient) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    if (ownClient) {
      client.release();
    }
  }
}
