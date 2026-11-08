import { route } from "@/lib/http";
import { compareInventory } from "@/server/services/inventory.service";
export const GET = route({ perm: "stock.view" }, ({ params }) => compareInventory(params.id));
