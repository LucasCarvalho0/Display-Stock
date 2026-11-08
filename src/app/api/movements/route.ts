import { route } from "@/lib/http";
import { movementCreateSchema, movementQuerySchema } from "@/server/validators";
import { listMovements } from "@/server/services/movement.service";
import { registerMovement } from "@/server/services/stock.service";
import { lookupByCode } from "@/server/services/product.service";
export const GET = route({ perm: "stock.view", query: movementQuerySchema }, ({ query }) => listMovements(query));
export const POST = route({ perm: "movements.create", body: movementCreateSchema, rate: { limit: 120, windowMs: 60_000 } }, async ({ user, body, ip }) => {
  const p = await lookupByCode(body.code, body.classification);
  const r = await registerMovement({ productId: p.id, type: body.type, quantity: body.quantity, note: body.note, userId: user.id, shift: user.shift, ip });
  return { number: r.movement.number, previousBalance: r.previousBalance, newBalance: r.newBalance, occurredAt: r.movement.occurredAt, shift: r.movement.shift };
});
