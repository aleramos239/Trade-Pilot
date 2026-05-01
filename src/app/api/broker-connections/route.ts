import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { createBrokerAdapter } from "@/lib/brokers/registry";
import { getWorkspaceForUser, updateAppData } from "@/lib/data/store";
import { createVaultEntry } from "@/lib/security/credential-vault";
import type { BrokerConnection, BrokerMode, BrokerPlatform } from "@/lib/trading/types";

const SUPPORTED_PLATFORMS: BrokerPlatform[] = ["Tradovate", "Rithmic", "ProjectX"];

function isSupportedPlatform(platform: string): platform is BrokerPlatform {
  return SUPPORTED_PLATFORMS.includes(platform as BrokerPlatform);
}

function isBrokerMode(mode: string): mode is BrokerMode {
  return mode === "simulation" || mode === "live";
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(user.id);
  return NextResponse.json({ brokerConnections: workspace?.brokerConnections ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    name?: string;
    platform?: string;
    mode?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiSecret?: string;
    bridgeUrl?: string;
    appId?: string;
    appVersion?: string;
    cid?: string;
    deviceId?: string;
    environment?: "demo" | "live";
    validateNow?: boolean;
  };
  const platform = payload.platform ?? "";
  const mode = payload.mode ?? "";

  if (!isSupportedPlatform(platform)) {
    return NextResponse.json({ error: "Unsupported broker platform." }, { status: 400 });
  }

  if (!isBrokerMode(mode)) {
    return NextResponse.json({ error: "Broker mode must be simulation or live." }, { status: 400 });
  }

  if (mode === "live" && !payload.username && !payload.apiKey) {
    return NextResponse.json(
      { error: "Live connections need at least a username or API key." },
      { status: 400 },
    );
  }

  const workspace = await getWorkspaceForUser(user.id);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const connectionId = randomUUID();
  const mappedAccountIds =
    mode === "simulation"
      ? workspace.accounts
          .filter((account) => account.platform === platform)
          .map((account) => account.id)
      : [];
  const connectionName =
    payload.name?.trim() || `${platform} ${mode === "simulation" ? "simulator" : "live"}`;
  const vaultEntry =
    mode === "live"
      ? await createVaultEntry({
          ownerId: user.id,
          brokerConnectionId: connectionId,
          platform,
          label: connectionName,
          credentials: {
            username: payload.username,
            password: payload.password,
            apiKey: payload.apiKey,
            apiSecret: payload.apiSecret,
            bridgeUrl: payload.bridgeUrl,
            appId: payload.appId,
            appVersion: payload.appVersion,
            cid: payload.cid,
            deviceId: payload.deviceId,
            environment: payload.environment ?? "demo",
          },
        })
      : null;
  const baseConnection: BrokerConnection = {
    id: connectionId,
    ownerId: user.id,
    name: connectionName,
    platform,
    mode,
    status: mode === "simulation" ? "connected" : "disconnected",
    accountIds: mappedAccountIds,
    credentialVaultId: vaultEntry?.id ?? null,
    liveEnabled: false,
    lastError:
      mode === "live"
        ? "Credentials encrypted. Live login validation has not run yet."
        : null,
    lastValidatedAt: null,
    createdAt: now,
    lastHeartbeatAt: now,
  };
  const validationResult =
    mode === "live" && payload.validateNow
      ? await createBrokerAdapter(baseConnection).validateCredentials?.({
          username: payload.username,
          password: payload.password,
          apiKey: payload.apiKey,
          apiSecret: payload.apiSecret,
          bridgeUrl: payload.bridgeUrl,
          appId: payload.appId,
          appVersion: payload.appVersion,
          cid: payload.cid,
          deviceId: payload.deviceId,
          environment: payload.environment ?? "demo",
        })
      : null;

  await updateAppData((data) => {
    data.brokerConnections = [
      {
        ...baseConnection,
        status: validationResult?.status ?? baseConnection.status,
        lastError: validationResult?.ok
          ? "Validated. Live order placement is safety-gated."
          : validationResult?.message ?? baseConnection.lastError,
        lastValidatedAt: validationResult?.checkedAt ?? null,
        accountIds: validationResult?.accountIds?.length
          ? validationResult.accountIds
          : baseConnection.accountIds,
      },
      ...data.brokerConnections,
    ];

    if (vaultEntry) {
      data.credentialVault = [vaultEntry, ...data.credentialVault];
    }
  });

  const updatedWorkspace = await getWorkspaceForUser(user.id);

  return NextResponse.json(
    {
      brokerConnections: updatedWorkspace?.brokerConnections ?? [],
      credentialStored: Boolean(vaultEntry),
      validation: validationResult,
    },
    { status: 201 },
  );
}
