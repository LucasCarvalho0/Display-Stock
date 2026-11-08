import { describe, expect, it } from "vitest";
import { fullCode } from "@/server/services/product.service";
import { movementNumber, signedQty } from "@/server/services/stock.service";
describe("regras de código e numeração", () => {
  it("replica 'Possui NG? = Sim' da planilha, sem duplicar o sufixo", () => {
    expect(fullCode("BRPRT 11605", "NG")).toBe("BRPRT 11605 NG"); expect(fullCode("BRPRT 11605 NG", "NG")).toBe("BRPRT 11605 NG"); expect(fullCode("BRPRT 11605 NG", "NORMAL")).toBe("BRPRT 11605");
  });
  it("numeração MOV-000001", () => expect(movementNumber(1)).toBe("MOV-000001"));
  it("sinais dos tipos", () => { expect(signedQty("ENTRADA", 5)).toBe(5); expect(signedQty("SAIDA", 5)).toBe(-5); expect(signedQty("AJUSTE_NEGATIVO", 2)).toBe(-2); });
});
