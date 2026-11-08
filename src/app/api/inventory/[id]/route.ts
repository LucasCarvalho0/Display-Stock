import { route } from "@/lib/http";
import { countItemsQuerySchema } from "@/server/validators";
import { getCountItems, getInventory } from "@/server/services/inventory.service";
export const GET = route({ perm: "stock.view" }, async ({ params, req }) => {
  const shift = req.nextUrl.searchParams.get("shift");
  const base = await getInventory(params.id);
  return shift ? { ...base, items: await getCountItems(params.id, countItemsQuerySchema.parse({ shift }).shift) } : base;
});
