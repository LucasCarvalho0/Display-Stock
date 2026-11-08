import { route } from "@/lib/http";
import { stockQuerySchema } from "@/server/validators";
import { listStock } from "@/server/services/product.service";
export const GET = route({ perm: "stock.view", query: stockQuerySchema }, ({ query }) => listStock(query));
