import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { createBrokerAdapter } from "@/lib/brokers/registry";
import {
  fetchTradovateMe,
  getTradovateOAuthClientId,
  getTradovateOAuthClientSecret,
  requestTradovateOAuthToken,
  tokenResponseToCredentials,
} from "@/lib/brokers/tradovate-auth";
import {
  getWorkspaceForUser,
  replaceDiscoveredBrokerAccounts,
  updateAppData,
} from "@/lib/data/store";
import { createVaultEntry } from "@/lib/security/credential-vault";
import type {
  BrokerConnection,
  DiscoveredBrokerAccount,
} from "@/lib/trading/types";

const TRADOVATE_OAUTH_STATE_COOKIE = "tp_tradovate_oauth_state";
const TRADOVATE_OAUTH_META_COOKIE = "tp_tradovate_oauth_meta";

type OAuthMeta = {
  environment: "demo" | "live";
  name: string;
  redirectUri: string;
};

function redirectHome(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/?brokerConnect=${status}`, request.url));
}

function clearOauthCookies(response: NextResponse) {
  for (const name of [TRADOVATE_OAUTH_STATE_COOKIE, TRADOVATE_OAUTH_META_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
}

function readMeta(value?: string): OAuthMeta | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as OAuthMeta;

    if (
      (parsed.environment === "demo" || parsed.environment === "live") &&
      parsed.name &&
      parsed.redirectUri
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return redirectHome(request, "auth-required");
  }

  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return redirectHome(request, "tradovate-oauth-denied");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(TRADOVATE_OAUTH_STATE_COOKIE)?.value;
  const meta = readMeta(request.cookies.get(TRADOVATE_OAUTH_META_COOKIE)?.value);

  if (!code || !state || !expectedState || state !== expectedState || !meta) {
    return redirectHome(request, "tradovate-oauth-state-error");
  }

  const clientId = getTradovateOAuthClientId();
  const clientSecret = getTradovateOAuthClientSecret();

  if (!clientId || !clientSecret) {
    return redirectHome(request, "tradovate-oauth-missing-env");
  }

  const workspace = await getWorkspaceForUser(user.id);

  if (!workspace) {
    return redirectHome(request, "workspace-not-found");
  }

  let response: NextResponse;

  try {
    const token = await requestTradovateOAuthToken({
      environment: meta.environment,
      body: {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: meta.redirectUri,
        code,
      },
    });
    const credentials = tokenResponseToCredentials({
      token,
      environment: meta.environment,
      clientId,
    });

    if (!credentials.accessToken) {
      response = redirectHome(request, "tradovate-oauth-token-error");
      clearOauthCookies(response);
      return response;
    }

    const now = new Date().toISOString();
    const connectionId = randomUUID();
    const profile = await fetchTradovateMe(meta.environment, credentials.accessToken).catch(
      () => null,
    );
    const connectionName =
      meta.name ||
      (typeof profile?.fullName === "string" ? `Tradovate ${profile.fullName}` : "Tradovate OAuth");
    const vaultEntry = await createVaultEntry({
      ownerId: user.id,
      brokerConnectionId: connectionId,
      platform: "Tradovate",
      label: connectionName,
      credentials,
    });
    const baseConnection: BrokerConnection = {
      id: connectionId,
      ownerId: user.id,
      name: connectionName,
      platform: "Tradovate",
      mode: "live",
      status: "connected",
      accountIds: [],
      credentialVaultId: vaultEntry.id,
      liveEnabled: false,
      lastError: "Tradovate OAuth connected. Live order placement is safety-gated.",
      lastValidatedAt: now,
      createdAt: now,
      lastHeartbeatAt: now,
    };
    const discovery = await createBrokerAdapter(baseConnection).discoverAccounts?.(credentials);
    const discoveredAt = discovery?.checkedAt ?? now;
    const discoveredAccounts: DiscoveredBrokerAccount[] =
      discovery?.accounts.map((account) => ({
        id: randomUUID(),
        ownerId: user.id,
        brokerConnectionId: connectionId,
        discoveredAt,
        ...account,
      })) ?? [];

    await updateAppData((data) => {
      data.brokerConnections = [
        {
          ...baseConnection,
          status: discovery?.status ?? "connected",
          accountIds: discovery?.ok
            ? discoveredAccounts.map((account) => account.brokerAccountId)
            : [],
          lastError: discovery?.ok
            ? null
            : discovery?.message ?? baseConnection.lastError,
          lastValidatedAt: discovery?.checkedAt ?? now,
          lastHeartbeatAt: discovery?.checkedAt ?? now,
        },
        ...data.brokerConnections,
      ];
      data.credentialVault = [vaultEntry, ...data.credentialVault];
    });

    if (discovery?.ok) {
      await replaceDiscoveredBrokerAccounts(user.id, connectionId, discoveredAccounts);
    }

    response = redirectHome(
      request,
      discovery?.ok ? "tradovate-oauth-connected" : "tradovate-oauth-connected-no-accounts",
    );
  } catch {
    response = redirectHome(request, "tradovate-oauth-token-error");
  }

  clearOauthCookies(response);
  return response;
}
