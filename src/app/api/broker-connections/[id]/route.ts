import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getWorkspaceForUser, updateAppData } from "@/lib/data/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await request.json()) as { liveEnabled?: boolean };

  await updateAppData((data) => {
    data.brokerConnections = data.brokerConnections.map((connection) => {
      if (connection.ownerId !== user.id || connection.id !== id) {
        return connection;
      }

      return {
        ...connection,
        liveEnabled:
          connection.mode === "live" && typeof payload.liveEnabled === "boolean"
            ? payload.liveEnabled
            : connection.liveEnabled,
      };
    });
  });

  const workspace = await getWorkspaceForUser(user.id);
  return NextResponse.json({ brokerConnections: workspace?.brokerConnections ?? [] });
}
