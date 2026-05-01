# Trade Copilot

A Next.js MVP for a prop-firm trade copier and automated execution control room.

The app currently runs in paper-routing mode:

- Dashboard for leader and follower prop-firm accounts
- Copier rule model with sizing, symbol maps, and account status
- TradingView-style webhook endpoint at `/api/webhooks/tradingview`
- Risk-aware execution preview for daily loss and trailing drawdown
- Client-side signal tester for webhook payloads
- Local persistent workspace data in `.data/trade-copilot.json`
- Demo operator session for dashboard mutations
- Broker adapter interface with simulated Tradovate, Rithmic, and ProjectX connections
- Execution router that persists simulated, blocked, and rejected order records
- Encrypted local credential vault for live-stub broker connections
- Broker setup UI for simulation or live-stub connections
- Tradovate credential validation flow using `/auth/accessTokenRequest`
- Tradovate account discovery using `/account/list`
- Account mapping UI from local prop accounts to discovered broker accounts
- Safety-gated Tradovate live order adapter using contract lookup and order submission
- Route preview showing when execution remains dry-run protected versus live-capable
- Broker reconciliation snapshots for live positions, working orders, and recent fills
- Tradovate reconciliation endpoint using account-related orders, positions, fills, and contract metadata
- Live flatten-all flow using reconciled broker position IDs and the Tradovate liquidate-positions endpoint

## Run Locally

```bash
npm.cmd run dev
```

Open `http://localhost:3000`.

PowerShell may block `npm.ps1` on some Windows machines, so `npm.cmd` is the safest command form here.

## Production Storage

Set `DATABASE_URL` to use Postgres instead of the local `.data` JSON store. The app lazily
creates the same schema at runtime, and you can also run the migration explicitly:

```bash
npm.cmd run db:migrate
```

Production broker credential encryption requires `CREDENTIAL_ENCRYPTION_KEY`. Use a base64
encoded 32-byte key. Local development still creates `.data/vault.key` when the env var is absent.

## Auth And Jobs

Local development supports `operator@tradecopilot.local` with password `demo`, plus the demo-session
button. Production disables demo login unless `ALLOW_DEMO_LOGIN=true`.

Generate a production password hash:

```bash
npm.cmd run auth:hash -- your-password
```

Set the result as `OPERATOR_PASSWORD_HASH`.

Scheduled reconciliation is configured in `vercel.json` at `/api/cron/reconcile`. Set
`CRON_SECRET` in production; the route rejects requests without `Authorization: Bearer <secret>`.

Use `/api/health` to verify storage, credential key, cron secret, operator auth, and app counts.

To migrate local `.data` records into Postgres:

```bash
npm.cmd run db:import-json
```

## Broker Bridge Contract

Tradovate uses its native API. Rithmic and ProjectX are wired through a secure HTTP bridge because
their production access depends on vendor/prop-firm infrastructure. Configure a bridge URL on the
broker connection. The bridge should expose:

- `POST /validate`
- `GET /accounts`
- `GET /reconcile?accountIds=...`
- `POST /orders`
- `POST /flatten`

The app sends `Authorization: Bearer <apiKey>` and `x-api-secret` when those credentials are stored.

## Sample Webhook

```json
{
  "strategy": "NQ momentum reclaim",
  "symbol": "NQ",
  "side": "buy",
  "orderType": "market",
  "quantity": 2,
  "stopLossTicks": 28,
  "takeProfitTicks": 56,
  "webhookSecret": "demo-webhook-secret"
}
```

POST it to:

```text
/api/webhooks/tradingview
```

## Next Production Steps

Live order placement now goes through the broker adapter contract and safety router, not directly
inside route handlers. Tradovate orders remain blocked unless the workspace live unlock, per-broker
toggle, account mapping, idempotency, rate limit, and kill-switch checks all pass.

Recommended order:

1. Move `.data/trade-copilot.json` to a real database with migrations.
2. Replace the demo session with production authentication and encrypted broker credentials.
3. Add an execution detail page with raw broker request/response inspection.
4. Add provider-backed SSO if you want multi-user onboarding beyond the built-in operator login.
5. Implement live adapters for Rithmic, ProjectX, and any supported prop platforms.
6. Add retries, broker outage handling, and account lockouts.
7. Paper trade for a long validation window before enabling live execution.

This is not financial advice. Live automated trading should only be enabled after broker API approval, prop-firm rule review, and extensive sim testing.
