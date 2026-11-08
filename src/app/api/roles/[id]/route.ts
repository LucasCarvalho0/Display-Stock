import { route } from "@/lib/http";
import { rolePermissionsSchema } from "@/server/validators";
import { setRolePermissions } from "@/server/services/user.service";
export const PUT = route({ perm: "users.manage", body: rolePermissionsSchema }, async ({ user, body, params, ip }) => { await setRolePermissions(params.id, body.permissions, user.id, ip); return { ok: true }; });
