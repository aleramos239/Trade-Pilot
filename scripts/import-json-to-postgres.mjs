import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required to import local JSON data.");
  process.exit(1);
}

const dataPath = path.join(process.cwd(), ".data", "trade-copilot.json");
const migrationPath = path.join(process.cwd(), "db", "migrations", "001_initial_postgres.sql");
const data = JSON.parse(await readFile(dataPath, "utf8"));
const migration = await readFile(migrationPath, "utf8");
const tableMap = {
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
};

function entityId(collection, item) {
  if (collection === "safetySettings") {
    return String(item.ownerId);
  }

  return String(item.id ?? item.key);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(migration);

  for (const [collection, table] of Object.entries(tableMap)) {
    await client.query(`DELETE FROM ${table}`);

    for (const item of data[collection] ?? []) {
      await client.query(
        `
        INSERT INTO ${table} (entity_id, owner_id, payload, updated_at)
        VALUES ($1, $2, $3::jsonb, now())
        ON CONFLICT (entity_id) DO UPDATE
        SET owner_id = excluded.owner_id,
            payload = excluded.payload,
            updated_at = now()
        `,
        [entityId(collection, item), item.ownerId ?? null, JSON.stringify(item)],
      );
    }
  }

  await client.query("COMMIT");
  console.log("Imported .data/trade-copilot.json into Postgres.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
