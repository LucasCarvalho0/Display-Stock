import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET precisa ter ao menos 32 caracteres"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SMTP_URL: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});
let cached: z.infer<typeof schema> | null = null;
export const env = () => (cached ??= schema.parse(process.env));
