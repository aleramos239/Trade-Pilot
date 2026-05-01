import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { getWorkspaceForUser, updateSafetySettings } from "@/lib/data/store";

export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    globalKillSwitch?: boolean;
    liveTradingUnlocked?: boolean;
    maxOrderQuantity?: number;
    minSecondsBetweenOrders?: number;
    duplicateWindowSeconds?: number;
  };

  await updateSafetySettings(user.id, {
    globalKillSwitch:
      typeof payload.globalKillSwitch === "boolean" ? payload.globalKillSwitch : undefined,
    liveTradingUnlocked:
      typeof payload.liveTradingUnlocked === "boolean" ? payload.liveTradingUnlocked : undefined,
    maxOrderQuantity:
      typeof payload.maxOrderQuantity === "number"
        ? Math.max(1, Math.min(100, Math.floor(payload.maxOrderQuantity)))
        : undefined,
    minSecondsBetweenOrders:
      typeof payload.minSecondsBetweenOrders === "number"
        ? Math.max(0, Math.min(3600, Math.floor(payload.minSecondsBetweenOrders)))
        : undefined,
    duplicateWindowSeconds:
      typeof payload.duplicateWindowSeconds === "number"
        ? Math.max(1, Math.min(86400, Math.floor(payload.duplicateWindowSeconds)))
        : undefined,
  });

  const workspace = await getWorkspaceForUser(user.id);
  return NextResponse.json({ safetySettings: workspace?.safetySettings });
}
