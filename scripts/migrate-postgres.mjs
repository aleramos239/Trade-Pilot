import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required to run Postgres migrations.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const migrationPath = path.join(process.cwd(), "db", "migrations", "001_initial_postgres.sql");
const sql = await readFile(migrationPath, "utf8");

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Postgres migration complete.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
