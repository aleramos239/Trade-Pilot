import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getWorkspaceForUser, updateCopierRuleState } from "@/lib/data/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await request.json()) as { enabled?: boolean };
  await updateCopierRuleState(user.id, id, {
    enabled: typeof payload.enabled === "boolean" ? payload.enabled : undefined,
  });

  const workspace = await getWorkspaceForUser(user.id);
  return NextResponse.json({ workspace });
}
