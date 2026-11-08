import { route } from "@/lib/http";
import { lookupQuerySchema } from "@/server/validators";
import { lookupByCode } from "@/server/services/product.service";
export const GET = route({ perm: "stock.view", query: lookupQuerySchema }, ({ query }) => lookupByCode(query.code, query.classification));
