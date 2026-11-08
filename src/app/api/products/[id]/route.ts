import { route } from "@/lib/http";
import { productUpdateSchema } from "@/server/validators";
import { productHistory, updateProduct } from "@/server/services/product.service";
export const GET = route({ perm: "stock.view" }, ({ params }) => productHistory(params.id));
export const PATCH = route({ perm: "products.edit", body: productUpdateSchema }, async ({ user, body, params, ip }) => { await updateProduct(params.id, body, user.id, ip); return { ok: true }; });
