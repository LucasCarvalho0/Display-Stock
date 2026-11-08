import { expect, test } from "@playwright/test";
const PASS = process.env.E2E_PASSWORD ?? "Trocar@123456";
test("login → trocar senha → entrada → saída bloqueada por saldo", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("lider1@suaempresa.com.br"); await page.getByLabel("Senha").fill(PASS); await page.getByRole("button", { name: "Entrar no sistema" }).click();
  if (page.url().includes("trocar-senha")) { await page.getByLabel("Senha atual (temporária)").fill(PASS); await page.getByLabel("Nova senha").fill("NovaSenha@2026x"); await page.getByRole("button", { name: /Salvar/ }).click(); }
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/saida"); await page.getByLabel("Código da peça *").fill("BRPRT 11605"); await page.getByLabel("Quantidade *").fill("999999"); await page.getByLabel("Código da peça *").blur();
  await expect(page.getByText(/Saldo insuficiente/)).toBeVisible();
});
