import { route } from "@/lib/http";
import { justificationSchema } from "@/server/validators";
import { justify } from "@/server/services/inventory.service";
export const POST = route({ perm: "inventory.count", body: justificationSchema }, async ({ user, body, params, ip }) => { await justify(params.id, body, user, ip); return { ok: true }; });
