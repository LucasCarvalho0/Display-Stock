import { route } from "@/lib/http";
import { getDashboard } from "@/server/services/dashboard.service";
export const GET = route({ perm: "stock.view" }, () => getDashboard());
