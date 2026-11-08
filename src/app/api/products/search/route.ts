import { route } from "@/lib/http";
import { z } from "zod";
import { searchProducts } from "@/server/services/product.service";

const searchQuerySchema = z.object({
  q: z.string().default(""),
  classification: z.enum(["NORMAL", "NG"]).optional(),
});

export const GET = route({ perm: "stock.view", query: searchQuerySchema }, ({ query }) =>
  searchProducts(query.q, query.classification)
);

