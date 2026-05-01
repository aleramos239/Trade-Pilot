import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getWorkspaceForUser, upsertAccountMapping } from "@/lib/data/store";
import type { AccountMapping } from "@/lib/trading/types";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    appAccountId?: string;
    discoveredAccountId?: string;
  };
  const workspace = await getWorkspaceForUser(user.id);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const appAccount = workspace.accounts.find((account) => account.id === payload.appAccountId);
  const discoveredAccount = workspace.discoveredBrokerAccounts.find(
    (account) => account.id === payload.discoveredAccountId,
  );

  if (!appAccount || !discoveredAccount) {
    return NextResponse.json({ error: "Account mapping target not found." }, { status: 404 });
  }

  if (appAccount.platform !== discoveredAccount.platform) {
    return NextResponse.json(
      { error: "App account and broker account platforms must match." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const existing = workspace.accountMappings.find(
    (mapping) => mapping.appAccountId === appAccount.id,
  );
  const mapping: AccountMapping = {
    id: existing?.id ?? randomUUID(),
    ownerId: user.id,
    appAccountId: appAccount.id,
    brokerConnectionId: discoveredAccount.brokerConnectionId,
    brokerAccountId: discoveredAccount.brokerAccountId,
    platform: discoveredAccount.platform,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await upsertAccountMapping(mapping);
  const updatedWorkspace = await getWorkspaceForUser(user.id);

  return NextResponse.json({
    mapping,
    accountMappings: updatedWorkspace?.accountMappings ?? [],
  });
}
