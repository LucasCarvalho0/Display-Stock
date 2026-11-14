import { route } from "@/lib/http";
import { finishCounting, finishShift } from "@/server/services/inventory.service";

export const POST = route({ perm: "inventory.count" }, async ({ user, params, req, ip }) => {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  if (body?.shift) {
    return finishShift(params.id, body.shift, user, ip);
  }

  return finishCounting(params.id, user, ip, !!body?.allowSingleShift);
});

