import { route } from "@/lib/http";
import { getMovement } from "@/server/services/movement.service";
export const GET = route({ perm: "stock.view" }, ({ params }) => getMovement(params.id));
