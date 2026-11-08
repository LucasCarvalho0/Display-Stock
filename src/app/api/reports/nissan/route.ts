import { route } from "@/lib/http";
import { reportQuerySchema } from "@/server/validators";
import { buildReport } from "@/server/services/report.service";
export const GET = route({ perm: "stock.view", query: reportQuerySchema }, ({ query }) => buildReport(query.kind, query.date));
