import type { BrokerCredentialInput } from "@/lib/security/credential-vault";

export type TradovateEnvironment = "demo" | "live";

export const TRADOVATE_BASE_URL: Record<TradovateEnvironment, string> = {
  demo: "https://demo.tradovateapi.com/v1",
  live: "https://live.tradovateapi.com/v1",
};

const DEFAULT_AUTH_URL = "https://trader.tradovate.com/oauth";
const TOKEN_REFRESH_BUFFER_MS = 60_000;

export type TradovateOAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
  id_token?: string;
};

export function getTradovateAuthorizeUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(process.env.TRADOVATE_OAUTH_AUTH_URL || DEFAULT_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url;
}

export function getTradovateOAuthClientId(credentials?: BrokerCredentialInput) {
  return credentials?.clientId || process.env.TRADOVATE_OAUTH_CLIENT_ID || "";
}

export function getTradovateOAuthClientSecret(credentials?: BrokerCredentialInput) {
  return credentials?.clientSecret || process.env.TRADOVATE_OAUTH_CLIENT_SECRET || "";
}

export function getTradovateOAuthRedirectUri(origin: string) {
  return (
    process.env.TRADOVATE_OAUTH_REDIRECT_URI ||
    `${origin.replace(/\/$/, "")}/api/broker-connections/oauth/tradovate/callback`
  );
}

export function hasUsableTradovateOAuthToken(credentials: BrokerCredentialInput) {
  if (!credentials.accessToken) {
    return false;
  }

  if (!credentials.tokenExpiresAt) {
    return true;
  }

  return new Date(credentials.tokenExpiresAt).getTime() - TOKEN_REFRESH_BUFFER_MS > Date.now();
}

export function tokenResponseToCredentials({
  token,
  environment,
  clientId,
}: {
  token: TradovateOAuthTokenResponse;
  environment: TradovateEnvironment;
  clientId?: string;
}): BrokerCredentialInput {
  const now = Date.now();

  return {
    authMethod: "oauth",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenExpiresAt:
      typeof token.expires_in === "number"
        ? new Date(now + token.expires_in * 1000).toISOString()
        : undefined,
    refreshTokenExpiresAt:
      typeof token.refresh_token_expires_in === "number"
        ? new Date(now + token.refresh_token_expires_in * 1000).toISOString()
        : undefined,
    clientId,
    environment,
  };
}

export async function requestTradovateOAuthToken({
  environment,
  body,
}: {
  environment: TradovateEnvironment;
  body: Record<string, string>;
}) {
  const response = await fetch(`${TRADOVATE_BASE_URL[environment]}/auth/oauthtoken`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const token = (await response.json().catch(() => ({}))) as TradovateOAuthTokenResponse;

  if (!response.ok || token.error || !token.access_token) {
    const message =
      token.error_description ||
      token.error ||
      `Tradovate OAuth token request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  return token;
}

export async function refreshTradovateOAuthCredentials(credentials: BrokerCredentialInput) {
  const environment = credentials.environment ?? "demo";
  const clientId = getTradovateOAuthClientId(credentials);
  const clientSecret = getTradovateOAuthClientSecret(credentials);

  if (!credentials.refreshToken) {
    throw new Error("Tradovate OAuth refresh token is missing. Reconnect the broker account.");
  }

  if (!clientId || !clientSecret) {
    throw new Error("Tradovate OAuth client id and secret are required to refresh the broker token.");
  }

  const token = await requestTradovateOAuthToken({
    environment,
    body: {
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    },
  });

  return tokenResponseToCredentials({ token, environment, clientId });
}

export async function fetchTradovateMe(environment: TradovateEnvironment, accessToken: string) {
  const response = await fetch(`${TRADOVATE_BASE_URL[environment]}/auth/me`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`Tradovate profile lookup failed with HTTP ${response.status}.`);
  }

  return body;
}
