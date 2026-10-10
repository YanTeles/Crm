import { expect, test } from "@playwright/test";

// Testes de fumaça: não dependem de dados no Supabase.
test("página inicial apresenta o produto e leva ao cadastro", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Cadastrar minha empresa" }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(page.getByLabel("Nome da empresa")).toBeVisible();
});

test("rotas protegidas redirecionam para o login preservando o destino", async ({ page }) => {
  await page.goto("/app/qualquer-empresa/leads");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fapp%2Fqualquer-empresa%2Fleads/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("validação do cadastro no cliente", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Ana");
  await page.getByLabel("E-mail").fill("invalido");
  await page.getByLabel("Senha").fill("curta");
  await page.getByRole("button", { name: "Criar conta e empresa" }).click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
  await expect(page.getByText("Informe o nome da empresa.")).toBeVisible();
});

test("link de confirmação inválido mostra erro amigável", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=x&type=email");
  await expect(page).toHaveURL(/\/entrar\?erro=link/);
  await expect(page.getByText("O link é inválido ou expirou")).toBeVisible();
});
