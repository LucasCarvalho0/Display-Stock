import { route } from "@/lib/http";
import { resetSchema } from "@/server/validators";
import { resetPassword } from "@/server/services/auth.service";
export const POST = route({ public: true, body: resetSchema, rate: { limit: 10, windowMs: 15 * 60_000, key: "reset" } }, async ({ body }) => { await resetPassword(body.token, body.password); return { ok: true }; });
