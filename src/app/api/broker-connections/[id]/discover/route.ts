import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { createBrokerAdapter } from "@/lib/brokers/registry";
import {
  getWorkspaceForUser,
  readAppData,
  replaceDiscoveredBrokerAccounts,
  updateAppData,
} from "@/lib/data/store";
import { decryptCredentialPayload } from "@/lib/security/credential-vault";
import type { DiscoveredBrokerAccount } from "@/lib/trading/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const { id } = await params;
  const workspace = await getWorkspaceForUser(user.id);
  const connection = workspace?.brokerConnections.find((item) => item.id === id);

  if (!connection) {
    return NextResponse.json({ error: "Broker connection not found." }, { status: 404 });
  }

  if (!connection.credentialVaultId) {
    return NextResponse.json(
      { error: "This connection does not have stored credentials for discovery." },
      { status: 400 },
    );
  }

  const data = await readAppData();
  const vaultEntry = data.credentialVault.find(
    (entry) => entry.ownerId === user.id && entry.id === connection.credentialVaultId,
  );

  if (!vaultEntry) {
    return NextResponse.json({ error: "Credential vault entry not found." }, { status: 404 });
  }

  const adapter = createBrokerAdapter(connection);

  if (!adapter.discoverAccounts) {
    return NextResponse.json(
      { error: `${connection.platform} account discovery is not implemented yet.` },
      { status: 400 },
    );
  }

  const credentials = await decryptCredentialPayload(vaultEntry.encryptedPayload);
  const discovery = await adapter.discoverAccounts(credentials);
  const discoveredAt = discovery.checkedAt;
  const discoveredAccounts: DiscoveredBrokerAccount[] = discovery.accounts.map((account) => ({
    id: randomUUID(),
    ownerId: user.id,
    brokerConnectionId: connection.id,
    discoveredAt,
    ...account,
  }));

  if (discovery.ok) {
    await replaceDiscoveredBrokerAccounts(user.id, connection.id, discoveredAccounts);
  }

  await updateAppData((nextData) => {
    nextData.brokerConnections = nextData.brokerConnections.map((item) => {
      if (item.ownerId !== user.id || item.id !== connection.id) {
        return item;
      }

      return {
        ...item,
        status: discovery.status,
        accountIds: discovery.ok
          ? discoveredAccounts.map((account) => account.brokerAccountId)
          : item.accountIds,
        lastError: discovery.ok ? null : discovery.message,
        lastValidatedAt: discovery.checkedAt,
        lastHeartbeatAt: discovery.checkedAt,
      };
    });
  });

  return NextResponse.json({ discovery, discoveredAccounts });
}
