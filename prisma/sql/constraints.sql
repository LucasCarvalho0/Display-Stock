-- Aplicar DEPOIS da primeira migration (ver docs/README.md, passo "Restrições extras").
-- Prisma não expressa CHECK constraints nem triggers; estas são a última linha de defesa no banco.
ALTER TABLE "StockBalance" ADD CONSTRAINT stock_balance_non_negative CHECK ("quantity" >= 0);
ALTER TABLE "Movement"     ADD CONSTRAINT movement_qty_positive      CHECK ("quantity" > 0);
ALTER TABLE "Product"      ADD CONSTRAINT product_min_non_negative   CHECK ("minStock" >= 0 AND "initialBalance" >= 0);
ALTER TABLE "InventoryCount" ADD CONSTRAINT count_non_negative       CHECK ("physicalQty" IS NULL OR "physicalQty" >= 0);

-- Movimentações confirmadas nunca podem ser apagadas fisicamente.
CREATE OR REPLACE FUNCTION forbid_movement_delete() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Movimentações não podem ser excluídas. Use estorno/correção.'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER movement_no_delete BEFORE DELETE ON "Movement" FOR EACH ROW EXECUTE FUNCTION forbid_movement_delete();
CREATE TRIGGER movement_revision_no_delete BEFORE DELETE ON "MovementRevision" FOR EACH ROW EXECUTE FUNCTION forbid_movement_delete();

-- Auditoria é append-only.
CREATE OR REPLACE FUNCTION forbid_audit_change() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'AuditLog é somente-inserção.'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();
