import { route } from "@/lib/http";
import { userCreateSchema } from "@/server/validators";
import { createUser, listUsers } from "@/server/services/user.service";
export const GET = route({ perm: ["users.manage", "stock.view"], anyPerm: true }, () => listUsers());
export const POST = route({ perm: "users.manage", body: userCreateSchema }, ({ user, body, ip }) => createUser(body, user.id, ip));
