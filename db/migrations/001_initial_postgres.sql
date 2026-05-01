CREATE TABLE IF NOT EXISTS trade_copilot_users (
  entity_id text PRIMARY KEY,
  owner_id text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trade_copilot_sessions (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_prop_accounts (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_copier_rules (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_broker_connections (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_credential_vault (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_discovered_broker_accounts (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_account_mappings (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_broker_positions (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_broker_orders (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_broker_fills (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_safety_settings (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_idempotency_records (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_execution_records (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_execution_audits (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_alerts (LIKE trade_copilot_users INCLUDING ALL);
CREATE TABLE IF NOT EXISTS trade_copilot_recent_executions (LIKE trade_copilot_users INCLUDING ALL);

CREATE INDEX IF NOT EXISTS trade_copilot_users_owner_id_idx ON trade_copilot_users (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_sessions_owner_id_idx ON trade_copilot_sessions (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_prop_accounts_owner_id_idx ON trade_copilot_prop_accounts (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_copier_rules_owner_id_idx ON trade_copilot_copier_rules (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_broker_connections_owner_id_idx ON trade_copilot_broker_connections (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_credential_vault_owner_id_idx ON trade_copilot_credential_vault (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_discovered_broker_accounts_owner_id_idx ON trade_copilot_discovered_broker_accounts (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_account_mappings_owner_id_idx ON trade_copilot_account_mappings (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_broker_positions_owner_id_idx ON trade_copilot_broker_positions (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_broker_orders_owner_id_idx ON trade_copilot_broker_orders (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_broker_fills_owner_id_idx ON trade_copilot_broker_fills (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_safety_settings_owner_id_idx ON trade_copilot_safety_settings (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_idempotency_records_owner_id_idx ON trade_copilot_idempotency_records (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_execution_records_owner_id_idx ON trade_copilot_execution_records (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_execution_audits_owner_id_idx ON trade_copilot_execution_audits (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_alerts_owner_id_idx ON trade_copilot_alerts (owner_id);
CREATE INDEX IF NOT EXISTS trade_copilot_recent_executions_owner_id_idx ON trade_copilot_recent_executions (owner_id);
