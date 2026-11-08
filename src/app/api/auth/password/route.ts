import { route } from "@/lib/http";
import { changePasswordSchema } from "@/server/validators";
import { changePassword } from "@/server/services/auth.service";
export const POST = route({ body: changePasswordSchema, rate: { limit: 10, windowMs: 15 * 60_000 } }, async ({ user, body }) => { await changePassword(user.id, body.current, body.next); return { ok: true }; });
