import { Classification, Prisma } from "@prisma/client";
import { prisma, transaction } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { audit } from "./audit.service";

/** Código completo: regra da planilha ("Possui NG? = Sim" acrescenta " NG" ao código). */
export function fullCode(base: string, classification: Classification) {
  const b = base.trim().replace(/\s+NG$/i, "");
  return classification === "NG" ? `${b} NG` : b;
}

export type ProductInput = { code: string; description: string; model: string; clientId: string; classification: Classification; minStock: number; active?: boolean; initialBalance?: number };

export async function createProduct(i: ProductInput, userId: string, ip?: string) {
  const code = fullCode(i.code, i.classification);
  return transaction(async (tx) => {
    if (await tx.product.findUnique({ where: { code } })) throw conflict("CODIGO_DUPLICADO", `O código "${code}" já está cadastrado.`);
    const p = await tx.product.create({ data: {
      code, baseCode: code.replace(/\s+NG$/, ""), description: i.description.trim(), model: i.model.trim(), clientId: i.clientId,
      classification: i.classification, minStock: i.minStock, active: i.active ?? true, initialBalance: 0,
      balance: { create: { quantity: 0 } },
    } });
    await audit(tx, { userId, action: "PRODUTO_CRIADO", entity: "Product", entityId: p.id, after: { code }, ip });
    return p;
  });
}

/** Saldo nunca é editável aqui: só metadados do cadastro. */
export async function updateProduct(id: string, i: Partial<Pick<ProductInput, "description" | "model" | "clientId" | "minStock" | "active">>, userId: string, ip?: string) {
  return transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { id } });
    if (!before) throw notFound("Produto não encontrado.");
    const p = await tx.product.update({ where: { id }, data: i });
    await audit(tx, { userId, action: "PRODUTO_ALTERADO", entity: "Product", entityId: id, ip,
      before: { description: before.description, model: before.model, clientId: before.clientId, minStock: before.minStock, active: before.active },
      after: i as Prisma.InputJsonValue });
    return p;
  });
}

export type StockQuery = { q?: string; classification?: Classification; clientId?: string; status?: "ZERADO" | "ABAIXO_MINIMO" | "OK"; sort?: string; dir?: "asc" | "desc"; page: number; pageSize: number; includeInactive?: boolean };

export async function listStock(f: StockQuery) {
  const where: Prisma.ProductWhereInput = {
    ...(f.includeInactive ? {} : { active: true }),
    ...(f.classification && { classification: f.classification }),
    ...(f.clientId && { clientId: f.clientId }),
    ...(f.q && { OR: [
      { code: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } },
      { model: { contains: f.q, mode: "insensitive" } }, { client: { name: { contains: f.q, mode: "insensitive" } } },
    ] }),
  };
  const all = await prisma.product.findMany({ where, include: { client: true, balance: true } });
  let rows = all.map((p) => {
    const balance = p.balance?.quantity ?? 0;
    const warehouseQty = p.balance?.warehouseQty ?? 0;
    const preAssemblyQty = p.balance?.preAssemblyQty ?? 0;
    return {
      id: p.id,
      code: p.code,
      description: p.description,
      model: p.model,
      client: p.client.name,
      clientId: p.clientId,
      classification: p.classification,
      warehouseQty,
      preAssemblyQty,
      balance,
      minStock: p.minStock,
      active: p.active,
      status: balance <= 0 ? "ZERADO" : balance <= p.minStock ? "ABAIXO_MINIMO" : "OK",
      sortOrder: p.sortOrder,
    };
  });
  if (f.status) rows = rows.filter((r) => r.status === f.status);
  const key = (f.sort ?? "sortOrder") as keyof (typeof rows)[number];
  const dir = f.dir === "desc" ? -1 : 1;
  rows.sort((a, b) => (a[key]! > b[key]! ? 1 : a[key]! < b[key]! ? -1 : 0) * dir || a.code.localeCompare(b.code));
  const total = rows.length;
  return { total, page: f.page, pageSize: f.pageSize, rows: rows.slice((f.page - 1) * f.pageSize, f.page * f.pageSize) };
}

export function cleanCodeQuery(str: string): string {
  return (str || "").toLowerCase().replace(/[\s\-_/.]/g, "");
}

export async function searchProducts(q: string, classification?: Classification) {
  const cleanQ = cleanCodeQuery(q);
  if (!cleanQ) return [];
  const qLower = q.toLowerCase().trim();
  const wantsNG = /\bng\b/i.test(q) || cleanQ.endsWith("ng");

  const all = await prisma.product.findMany({
    where: { active: true },
    include: { client: true, balance: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  const scored = all.map((p) => {
    if (classification && !wantsNG && p.classification !== classification) return null;
    if (wantsNG && p.classification !== "NG") return null;

    const cleanCode = cleanCodeQuery(p.code);
    const cleanBase = cleanCodeQuery(p.baseCode);
    const cleanDesc = cleanCodeQuery(p.description);
    const descLower = p.description.toLowerCase();
    const codeLower = p.code.toLowerCase();

    let score = 0;
    if (cleanCode === cleanQ || codeLower === qLower) score = 100;
    else if (cleanBase === cleanQ) score = 95;
    else if (cleanCode.startsWith(cleanQ) || codeLower.startsWith(qLower)) score = 90;
    else if (cleanBase.startsWith(cleanQ)) score = 88;
    else if (cleanCode.includes(cleanQ) || codeLower.includes(qLower)) score = 80;
    else if (cleanBase.includes(cleanQ)) score = 78;
    else if (cleanDesc.includes(cleanQ) || descLower.includes(qLower)) score = 65;
    else {
      const codeNums = cleanCode.replace(/\D/g, "");
      const qNums = cleanQ.replace(/\D/g, "");
      if (qNums.length >= 3 && codeNums.length >= 3) {
        if (codeNums === qNums) score = 85;
        else if (codeNums.includes(qNums) || qNums.includes(codeNums)) score = 75;
      }
    }

    if (score === 0) return null;

    return {
      id: p.id,
      code: p.code,
      baseCode: p.baseCode,
      description: p.description,
      model: p.model,
      client: p.client.name,
      classification: p.classification,
      balance: p.balance?.quantity ?? 0,
      minStock: p.minStock,
      active: p.active,
      score,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return scored;
}

export async function lookupByCode(code: string, classification?: Classification) {
  const full = classification ? fullCode(code, classification) : code.trim();

  let p = await prisma.product.findUnique({
    where: { code: full },
    include: { client: true, balance: true },
  });

  if (!p) {
    p = await prisma.product.findUnique({
      where: { code: code.trim() },
      include: { client: true, balance: true },
    });
  }

  const matches = await searchProducts(code, classification);

  if (!p && matches.length > 0) {
    const top = matches[0];
    p = await prisma.product.findUnique({
      where: { id: top.id },
      include: { client: true, balance: true },
    });
  }

  if (!p) throw notFound(`Código "${code}" não encontrado no cadastro.`);

  const allVariants = await prisma.product.findMany({
    where: { baseCode: p.baseCode, active: true },
    include: { client: true, balance: true },
  });

  const variants = {
    normal: allVariants.find((v) => v.classification === "NORMAL")
      ? {
          id: allVariants.find((v) => v.classification === "NORMAL")!.id,
          code: allVariants.find((v) => v.classification === "NORMAL")!.code,
          description: allVariants.find((v) => v.classification === "NORMAL")!.description,
          classification: "NORMAL" as const,
          balance: allVariants.find((v) => v.classification === "NORMAL")!.balance?.quantity ?? 0,
        }
      : null,
    ng: allVariants.find((v) => v.classification === "NG")
      ? {
          id: allVariants.find((v) => v.classification === "NG")!.id,
          code: allVariants.find((v) => v.classification === "NG")!.code,
          description: allVariants.find((v) => v.classification === "NG")!.description,
          classification: "NG" as const,
          balance: allVariants.find((v) => v.classification === "NG")!.balance?.quantity ?? 0,
        }
      : null,
  };

  return {
    id: p.id,
    code: p.code,
    baseCode: p.baseCode,
    description: p.description,
    model: p.model,
    client: p.client.name,
    classification: p.classification,
    balance: p.balance?.quantity ?? 0,
    minStock: p.minStock,
    active: p.active,
    matches: matches.slice(0, 10),
    variants,
  };
}

export async function productHistory(id: string, take = 100) {
  return prisma.movement.findMany({ where: { productId: id }, orderBy: { occurredAt: "desc" }, take, include: { createdBy: { select: { name: true } } } });
}
export { badRequest };
