import { route } from "@/lib/http";
import { userUpdateSchema } from "@/server/validators";
import { updateUser } from "@/server/services/user.service";
export const PATCH = route({ perm: "users.manage", body: userUpdateSchema }, async ({ user, body, params, ip }) => { await updateUser(params.id, body, user.id, ip); return { ok: true }; });
