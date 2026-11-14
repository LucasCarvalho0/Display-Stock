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
      return await prisma.$transaction(fn, { maxWait: 10000, timeout: 30000 });
    } catch (e: any) {
      const isSerializationConflict = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";
      const isConnectionDrop =
        e?.message &&
        (e.message.includes("10054") ||
          e.message.includes("ConnectionReset") ||
          e.message.includes("closed") ||
          e.message.includes("Connection closed") ||
          e.message.includes("connection reset"));

      if ((isSerializationConflict || isConnectionDrop) && i < retries) {
        // Backoff exponencial para permitir reconexão do pool
        await new Promise((resolve) => setTimeout(resolve, 300 * Math.pow(2, i)));
        continue;
      }
      throw e;
    }
  }
}
