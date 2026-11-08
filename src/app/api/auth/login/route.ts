import { route } from "@/lib/http";
import { loginSchema } from "@/server/validators";
import { verifyLogin } from "@/server/services/auth.service";
import { createSession } from "@/lib/session";
export const POST = route({ public: true, body: loginSchema, rate: { limit: 10, windowMs: 60_000, key: "login" } }, async ({ body, ip, req }) => {
  const u = await verifyLogin(body.email, body.password, ip);
  await createSession(u.id, ip, req.headers.get("user-agent") ?? undefined);
  return { mustChangePassword: u.mustChangePassword };
});
