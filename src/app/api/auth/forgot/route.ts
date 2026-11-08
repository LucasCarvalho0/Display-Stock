import { route } from "@/lib/http";
import { forgotSchema } from "@/server/validators";
import { requestPasswordReset } from "@/server/services/auth.service";
export const POST = route({ public: true, body: forgotSchema, rate: { limit: 5, windowMs: 15 * 60_000, key: "forgot" } }, async ({ body }) => {
  await requestPasswordReset(body.email);
  return { message: "Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição." };
});
