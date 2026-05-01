import { NextResponse } from "next/server";
import { isPostgresConfigured } from "@/lib/data/postgres";
import { readAppData } from "@/lib/data/store";

export async function GET() {
  const checks = {
    database: isPostgresConfigured() ? "postgres" : "json-fallback",
    credentialKey:
      process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.NODE_ENV !== "production"
        ? "configured"
        : "missing",
    cronSecret: process.env.CRON_SECRET ? "configured" : "missing",
    operatorAuth:
      process.env.OPERATOR_PASSWORD_HASH ||
      process.env.OPERATOR_PASSWORD ||
      process.env.NODE_ENV !== "production"
        ? "configured"
        : "missing",
    tradovateOAuth:
      process.env.TRADOVATE_OAUTH_CLIENT_ID && process.env.TRADOVATE_OAUTH_CLIENT_SECRET
        ? "configured"
        : "missing",
  };

  try {
    const data = await readAppData();

    return NextResponse.json({
      ok:
        checks.credentialKey === "configured" &&
        checks.operatorAuth === "configured" &&
        (process.env.NODE_ENV !== "production" || checks.database === "postgres"),
      checks,
      counts: {
        users: data.users.length,
        brokerConnections: data.brokerConnections.length,
        executionRecords: data.executionRecords.length,
        alerts: data.alerts.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        checks,
        error: error instanceof Error ? error.message : "Health check failed.",
      },
      { status: 500 },
    );
  }
}
