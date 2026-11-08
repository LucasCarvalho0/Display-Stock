import { route } from "@/lib/http";
import { productCreateSchema, stockQuerySchema } from "@/server/validators";
import { createProduct, listStock } from "@/server/services/product.service";
export const GET = route({ perm: "stock.view", query: stockQuerySchema }, ({ query }) => listStock({ ...query, includeInactive: true }));
export const POST = route({ perm: "products.edit", body: productCreateSchema }, async ({ user, body, ip }) => ({ id: (await createProduct(body, user.id, ip)).id }));
