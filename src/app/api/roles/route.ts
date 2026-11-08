import { route } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { listRoles } from "@/server/services/user.service";
export const GET = route({ perm: ["users.manage", "settings.manage"], anyPerm: true }, async () => ({ roles: await listRoles(), catalog: PERMISSIONS }));
