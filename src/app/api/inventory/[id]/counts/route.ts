import { route } from "@/lib/http";
import { countSchema } from "@/server/validators";
import { saveCount } from "@/server/services/inventory.service";
export const POST = route({ perm: "inventory.count", body: countSchema }, async ({ user, body, params, ip }) => { const c = await saveCount(params.id, body, user, ip); return { id: c.id, physicalQty: c.physicalQty, countedAt: c.countedAt }; });
