import { route } from "@/lib/http";
import { closeInventory } from "@/server/services/inventory.service";
export const POST = route({ perm: "inventory.close" }, async ({ user, params, ip }) => { const s = await closeInventory(params.id, user, ip); return { status: s.status, closedAt: s.closedAt }; });
