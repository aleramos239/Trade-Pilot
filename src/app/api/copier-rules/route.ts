import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getWorkspaceForUser, upsertCopierRule } from "@/lib/data/store";
import type { CopierRule } from "@/lib/trading/types";

function parseSymbolMap(value: unknown) {
  if (typeof value !== "string") {
    return {};
  }

  return Object.fromEntries(
    value
      .split(/[\n,]/)
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [from, to] = pair.split(/[:=]/).map((part) => part.trim().toUpperCase());
        return [from, to || from];
      })
      .filter(([from]) => Boolean(from)),
  );
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    name?: string;
    leaderAccountId?: string;
    followerAccountIds?: string[];
    symbolMap?: string;
    maxContractsPerFollower?: number;
    copyStopsAndTargets?: boolean;
    autoFlattenOnRuleBreach?: boolean;
  };
  const workspace = await getWorkspaceForUser(user.id);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const leader = workspace.accounts.find((account) => account.id === payload.leaderAccountId);
  const followers = workspace.accounts.filter((account) =>
    (payload.followerAccountIds ?? []).includes(account.id),
  );

  if (!leader) {
    return NextResponse.json({ error: "Choose a leader account." }, { status: 400 });
  }

  if (!followers.length) {
    return NextResponse.json({ error: "Choose at least one follower account." }, { status: 400 });
  }

  const maxContracts = Number(payload.maxContractsPerFollower);
  const rule: CopierRule = {
    id: randomUUID(),
    ownerId: user.id,
    name: payload.name?.trim() || "Copy automation group",
    leaderAccountId: leader.id,
    followerAccountIds: followers.map((account) => account.id),
    symbolMap: parseSymbolMap(payload.symbolMap),
    maxContractsPerFollower: Number.isFinite(maxContracts) ? Math.max(1, maxContracts) : 1,
    copyStopsAndTargets: payload.copyStopsAndTargets !== false,
    autoFlattenOnRuleBreach: Boolean(payload.autoFlattenOnRuleBreach),
    enabled: false,
  };

  await upsertCopierRule(rule);
  const updatedWorkspace = await getWorkspaceForUser(user.id);

  return NextResponse.json({ rule, workspace: updatedWorkspace }, { status: 201 });
}
