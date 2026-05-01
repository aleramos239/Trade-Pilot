import { NextResponse } from "next/server";
import { readAppData } from "@/lib/data/store";
import { reconcileLiveConnectionsForUser } from "@/lib/reconciliation/service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await readAppData();
  const results = [];

  for (const user of data.users) {
    results.push({
      userId: user.id,
      results: await reconcileLiveConnectionsForUser(user.id),
    });
  }

  return NextResponse.json({ ok: true, results });
}
