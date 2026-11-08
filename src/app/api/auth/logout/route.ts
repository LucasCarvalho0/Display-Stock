import { route } from "@/lib/http";
import { destroySession } from "@/lib/session";
export const POST = route({ public: true }, async () => { await destroySession(); return { ok: true }; });
