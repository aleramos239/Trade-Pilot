import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  createDemoSession,
  createPasswordSession,
  getCurrentUser,
  setSessionCookie,
} from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json({ user });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    demo?: boolean;
  };
  const session =
    payload.email && payload.password
      ? await createPasswordSession(payload.email, payload.password)
      : payload.demo || process.env.NODE_ENV !== "production"
        ? await createDemoSession()
        : null;

  if (!session) {
    return NextResponse.json({ error: "Invalid operator credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, session);

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  return response;
}
