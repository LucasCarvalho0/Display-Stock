import { PrismaClient, Prisma } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
const dbUrl = process.env.DATABASE_URL;
export const prisma =
  g.prisma ??
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
export type Tx = Prisma.TransactionClient;
/** Transação serializável com retry em caso de conflito de serialização (P2034). */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await prisma.$transaction(fn, { maxWait: 5000, timeout: 20000 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034" && i < retries) continue;
      throw e;
    }
  }
}
