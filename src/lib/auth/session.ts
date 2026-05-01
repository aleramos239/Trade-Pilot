import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { demoUser } from "@/lib/trading/mock-data";
import { readAppData, updateAppData } from "@/lib/data/store";
import type { Session, User } from "@/lib/trading/types";

export const SESSION_COOKIE = "tc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export async function createDemoSession() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_LOGIN !== "true") {
    throw new Error("Demo login is disabled in production.");
  }

  const now = new Date();
  const session: Session = {
    id: randomUUID(),
    userId: demoUser.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };

  await updateAppData((data) => {
    data.sessions = [
      ...data.sessions.filter((item) => new Date(item.expiresAt).getTime() > now.getTime()),
      session,
    ];
  });

  return session;
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function validateConfiguredPassword(password: string) {
  const configuredHash = process.env.OPERATOR_PASSWORD_HASH;
  const configuredPassword = process.env.OPERATOR_PASSWORD;

  if (configuredHash) {
    return verifyPassword(password, configuredHash);
  }

  if (configuredPassword) {
    return password === configuredPassword;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return password === "demo";
}

export async function createPasswordSession(email: string, password: string) {
  const data = await readAppData();
  const user = data.users.find((item) => item.email.toLowerCase() === email.toLowerCase());

  if (!user || !validateConfiguredPassword(password)) {
    return null;
  }

  const now = new Date();
  const session: Session = {
    id: randomUUID(),
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };

  await updateAppData((nextData) => {
    nextData.sessions = [
      ...nextData.sessions.filter((item) => new Date(item.expiresAt).getTime() > now.getTime()),
      session,
    ];
  });

  return session;
}

export function setSessionCookie(response: NextResponse, session: Session) {
  response.cookies.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

async function getSessionUser(sessionId?: string): Promise<User | null> {
  if (!sessionId) {
    return null;
  }

  const data = await readAppData();
  const session = data.sessions.find((item) => item.id === sessionId);

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  return data.users.find((user) => user.id === session.userId) ?? null;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function getUserFromRequest(request: NextRequest) {
  return getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
}
