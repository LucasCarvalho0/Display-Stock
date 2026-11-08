import { route } from "@/lib/http";
import { finishCounting } from "@/server/services/inventory.service";
export const POST = route({ perm: "inventory.count" }, ({ user, params, ip }) => finishCounting(params.id, user, ip));
