import { route } from "@/lib/http";
import { correctionSchema } from "@/server/validators";
import { correctMovement } from "@/server/services/stock.service";
export const POST = route({ perm: "movements.correct", body: correctionSchema }, async ({ user, body, params, ip }) => {
  const { justification, ...c } = body; const m = await correctMovement(params.id, c, justification, user.id, ip); return { number: m.number, status: m.status };
});
