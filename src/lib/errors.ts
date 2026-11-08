export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const badRequest = (m: string, d?: unknown) => new AppError(400, "VALIDACAO", m, d);
export const unauthorized = (m = "Sessão expirada. Faça login novamente.") => new AppError(401, "NAO_AUTENTICADO", m);
export const forbidden = (m = "Você não tem permissão para esta operação.") => new AppError(403, "SEM_PERMISSAO", m);
export const notFound = (m = "Registro não encontrado.") => new AppError(404, "NAO_ENCONTRADO", m);
export const conflict = (code: string, m: string, d?: unknown) => new AppError(409, code, m, d);
