import { route } from "@/lib/http";
import { shiftStartSchema } from "@/server/validators";
import { startShift } from "@/server/services/inventory.service";
export const POST = route({ perm: "inventory.count", body: shiftStartSchema }, async ({ user, body, params, ip }) => { await startShift(params.id, body.shift, user, ip); return { ok: true }; });
