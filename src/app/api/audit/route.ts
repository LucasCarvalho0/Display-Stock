import { route } from "@/lib/http";
import { prisma } from "@/lib/db";
export const GET = route({ perm: "settings.manage" }, () => prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true } } } }));
