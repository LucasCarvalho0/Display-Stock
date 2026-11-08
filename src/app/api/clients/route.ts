import { route } from "@/lib/http";
import { prisma } from "@/lib/db";
export const GET = route({ perm: "stock.view" }, () => prisma.client.findMany({ where: { active: true }, orderBy: { name: "asc" } }));
