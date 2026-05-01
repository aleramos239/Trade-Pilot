import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import {
  getTradovateAuthorizeUrl,
  getTradovateOAuthClientId,
  getTradovateOAuthClientSecret,
  getTradovateOAuthRedirectUri,
} from "@/lib/brokers/tradovate-auth";

export const TRADOVATE_OAUTH_STATE_COOKIE = "tp_tradovate_oauth_state";
export const TRADOVATE_OAUTH_META_COOKIE = "tp_tradovate_oauth_meta";

function getOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.redirect(new URL("/?brokerConnect=auth-required", request.url));
  }

  const clientId = getTradovateOAuthClientId();
  const clientSecret = getTradovateOAuthClientSecret();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?brokerConnect=tradovate-oauth-missing-env", request.url));
  }

  const environment =
    request.nextUrl.searchParams.get("environment") === "live" ? "live" : "demo";
  const name = request.nextUrl.searchParams.get("name")?.trim() || "Tradovate OAuth";
  const state = randomUUID();
  const redirectUri = getTradovateOAuthRedirectUri(getOrigin(request));
  const authUrl = getTradovateAuthorizeUrl({ clientId, redirectUri, state });
  const response = NextResponse.redirect(authUrl);

  response.cookies.set(TRADOVATE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  response.cookies.set(
    TRADOVATE_OAUTH_META_COOKIE,
    Buffer.from(JSON.stringify({ environment, name, redirectUri })).toString("base64url"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    },
  );

  return response;
}
