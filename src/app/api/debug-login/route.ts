import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import bcrypt from "bcryptjs";

// Rota de diagnóstico TEMPORÁRIA — remover após resolver o bug
export async function POST(req: NextRequest) {
  const steps: string[] = [];
  try {
    steps.push("1. iniciando");

    const body = await req.json().catch(() => null);
    steps.push(`2. body: ${JSON.stringify(body)}`);

    const { email, password } = body ?? {};
    if (!email || !password) {
      return NextResponse.json({ steps, error: "email/password ausente" }, { status: 400 });
    }

    steps.push("3. buscando usuario no banco");
    const u = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } }).catch((e: any) => {
      steps.push(`ERRO prisma.findUnique: ${e?.message}`);
      return null;
    });
    steps.push(`4. usuario encontrado: ${u ? u.email : "NÃO"}, active: ${u?.active}`);

    if (!u || !u.active) {
      return NextResponse.json({ steps, error: "usuario nao encontrado" }, { status: 401 });
    }

    steps.push("5. comparando senha");
    const ok = await bcrypt.compare(String(password), u.passwordHash).catch((e: any) => {
      steps.push(`ERRO bcrypt: ${e?.message}`);
      return false;
    });
    steps.push(`6. senha ok: ${ok}`);

    if (!ok) {
      return NextResponse.json({ steps, error: "senha incorreta" }, { status: 401 });
    }

    steps.push("7. criando sessao");
    await createSession(u.id, "debug", req.headers.get("user-agent") ?? undefined);
    steps.push("8. sessao criada com sucesso");

    return NextResponse.json({ steps, success: true, mustChangePassword: u.mustChangePassword });
  } catch (e: any) {
    steps.push(`ERRO INESPERADO: ${e?.constructor?.name}: ${e?.message}`);
    steps.push(`STACK: ${e?.stack?.substring(0, 500)}`);
    return NextResponse.json({ steps, error: e?.message }, { status: 500 });
  }
}
