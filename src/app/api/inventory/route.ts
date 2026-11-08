import { route } from "@/lib/http";
import { inventoryStartSchema } from "@/server/validators";
import { listInventories, startInventory } from "@/server/services/inventory.service";
export const GET = route({ perm: "stock.view" }, () => listInventories());
export const POST = route({ perm: "inventory.count", body: inventoryStartSchema }, async ({ user, body, ip }) => ({ id: (await startInventory(body, user, ip)).id }));
