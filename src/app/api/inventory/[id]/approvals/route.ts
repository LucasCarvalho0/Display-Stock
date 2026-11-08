import { route } from "@/lib/http";
import { approvalSchema } from "@/server/validators";
import { approve } from "@/server/services/inventory.service";
export const POST = route({ perm: "inventory.approve", body: approvalSchema }, ({ user, body, params, ip }) => approve(params.id, body, user, ip));
