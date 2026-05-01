import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getWorkspaceForUser, updateAccountState } from "@/lib/data/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await request.json()) as { copyEnabled?: boolean; status?: "online" | "paused" };
  await updateAccountState(user.id, id, {
    copyEnabled: typeof payload.copyEnabled === "boolean" ? payload.copyEnabled : undefined,
    status: payload.status === "online" || payload.status === "paused" ? payload.status : undefined,
  });

  const workspace = await getWorkspaceForUser(user.id);
  return NextResponse.json({ workspace });
}
