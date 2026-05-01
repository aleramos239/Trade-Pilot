import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { acknowledgeOperatorAlert, getWorkspaceForUser } from "@/lib/data/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const { id } = await params;
  await acknowledgeOperatorAlert(user.id, id);
  const workspace = await getWorkspaceForUser(user.id);

  return NextResponse.json({ alerts: workspace?.alerts ?? [] });
}
