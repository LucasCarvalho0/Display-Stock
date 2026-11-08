import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodTypeAny, z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, forbidden } from "./errors";
import { AuthUser, getCurrentUser } from "./session";
import { rateLimit } from "./rate-limit";
import { env } from "./env";

type Ctx<B, Q> = { user: AuthUser; body: B; query: Q; params: Record<string, string>; req: NextRequest; ip: string };
type Opts<B extends ZodTypeAny, Q extends ZodTypeAny> = {
  perm?: string | string[]; anyPerm?: boolean; public?: boolean;
  body?: B; query?: Q; rate?: { limit: number; windowMs: number; key?: string };
};

export const ok = <T>(data: T, status = 200) => NextResponse.json({ data }, { status });
const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";

function errorResponse(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  if (e instanceof ZodError) {
    const details = e.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message }));
    return NextResponse.json({ error: { code: "VALIDACAO", message: details[0]?.mensagem ?? "Dados inválidos.", details } }, { status: 400 });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return NextResponse.json({ error: { code: "DUPLICADO", message: "Já existe um registro com esses dados." } }, { status: 409 });
    if (e.code === "P2025") return NextResponse.json({ error: { code: "NAO_ENCONTRADO", message: "Registro não encontrado." } }, { status: 404 });
  }
  const msg = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
  console.error("[api] erro inesperado:", msg, e instanceof Error ? e.stack : "");
  return NextResponse.json({
    error: {
      code: "ERRO_INTERNO",
      message: e instanceof Error ? `${e.message}` : "Erro interno. Tente novamente ou contate o suporte.",
      details: msg,
    },
  }, { status: 500 });
}

/** Wrapper padrão de Route Handlers: sessão → CSRF → rate limit → permissão → validação Zod → handler. */
export function route<B extends ZodTypeAny = z.ZodUndefined, Q extends ZodTypeAny = z.ZodUndefined>(
  opts: Opts<B, Q>, handler: (c: Ctx<z.infer<B>, z.infer<Q>>) => Promise<NextResponse | unknown>,
) {
  return async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      const ip = clientIp(req);
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.get("origin");
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
        if (origin && origin !== "null") {
          try {
            const originHost = new URL(origin).host;
            const appUrlHost = new URL(env().APP_URL).host;
            const isMatch =
              !host ||
              originHost === host ||
              originHost === appUrlHost ||
              originHost.endsWith(".vercel.app") ||
              originHost.startsWith("localhost");
            if (!isMatch) {
              console.warn(`[csrf] Origem bloqueada: ${origin} (host: ${host}, appUrlHost: ${appUrlHost})`);
              throw forbidden("Origem da requisição não permitida.");
            }
          } catch (urlErr) {
            if (urlErr instanceof AppError) throw urlErr;
            // Se origin for formato especial (PWA standalone, app scheme), não bloquear por falha de parse
          }
        }
      }
      if (opts.rate) {
        const r = rateLimit(`${opts.rate.key ?? req.nextUrl.pathname}:${ip}`, opts.rate.limit, opts.rate.windowMs);
        if (!r.ok) throw new AppError(429, "MUITAS_REQUISICOES", `Muitas tentativas. Tente novamente em ${r.retryAfter}s.`);
      }
      let user = null as AuthUser | null;
      if (!opts.public) {
        user = await getCurrentUser();
        if (!user) throw new AppError(401, "NAO_AUTENTICADO", "Sessão expirada. Faça login novamente.");
        if (opts.perm) {
          const need = Array.isArray(opts.perm) ? opts.perm : [opts.perm];
          const has = opts.anyPerm ? need.some((p) => user!.permissions.includes(p)) : need.every((p) => user!.permissions.includes(p));
          if (!has) throw forbidden();
        }
      }
      let body: unknown = undefined;
      if (opts.body) {
        const raw = await req.json().catch(() => { throw new AppError(400, "VALIDACAO", "Corpo da requisição inválido (JSON esperado)."); });
        body = opts.body.parse(raw);
      }
      const query = opts.query ? opts.query.parse(Object.fromEntries(req.nextUrl.searchParams)) : undefined;
      const result = await handler({ user: user as AuthUser, body, query, params: ctx.params, req, ip } as never);
      return result instanceof NextResponse ? result : ok(result);
    } catch (e) {
      return errorResponse(e);
    }
  };
}
