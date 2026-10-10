import { expect, test, type Page } from "@playwright/test";

// Fluxo crítico completo contra o Supabase local (supabase start).
// Requer E2E_FULL=1, .env.local apontando para o Supabase local e o Mailpit
// em http://127.0.0.1:54324 (padrão do CLI) para ler os e-mails de confirmação.
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
test.skip(!process.env.E2E_FULL, "Defina E2E_FULL=1 com o Supabase local em execução.");
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const admin = { name: "Admin Teste", email: `admin-${run}@example.test`, password: "Senha12345" };
const seller = { name: "Vendedor Teste", email: `vendedor-${run}@example.test`, password: "Senha12345" };
const company = `Empresa E2E ${run}`;
let slug = "";
let inviteLink = "";

async function confirmationLink(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const data = (await res.json()) as { messages?: { ID: string }[] };
    const id = data.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML: string };
      const href = msg.HTML.match(/href="([^"]+auth\/confirm[^"]+)"/)?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`E-mail de confirmação não encontrado para ${email}`);
}

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("1. cadastro da empresa com confirmação de e-mail", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(admin.name);
  await page.getByLabel("E-mail").fill(admin.email);
  await page.getByLabel("Senha").fill(admin.password);
  await page.getByLabel("Nome da empresa").fill(company);
  await page.getByRole("button", { name: "Criar conta e empresa" }).click();
  await expect(page.getByText("Confirme seu e-mail")).toBeVisible();

  await page.goto(await confirmationLink(admin.email));
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: "Criar empresa" }).click();
  await expect(page).toHaveURL(/\/app\/[a-z0-9-]+\/dashboard/);
  slug = page.url().match(/\/app\/([a-z0-9-]+)\//)![1];
});

test("2. admin convida vendedor e habilita o rodízio", async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`/app/${slug}/equipe`);
  await page.getByRole("button", { name: "Convidar" }).click();
  await page.getByLabel("E-mail").fill(seller.email);
  await page.getByRole("button", { name: "Gerar convite" }).click();
  inviteLink = await page.getByLabel("Link do convite").inputValue();
  expect(inviteLink).toContain("/convite/");

  await page.goto(`/app/${slug}/configuracoes`);
  await page.getByLabel("Distribuição automática (rodízio)").click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();
});

test("3. vendedor cria conta pelo convite", async ({ page }) => {
  const token = inviteLink.split("/convite/")[1];
  await page.goto(`/cadastro?convite=${token}`);
  await page.getByLabel("Seu nome").fill(seller.name);
  await page.getByLabel("E-mail").fill(seller.email);
  await page.getByLabel("Senha").fill(seller.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.goto(await confirmationLink(seller.email));
  await expect(page).toHaveURL(/\/convite\//);
  await page.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${slug}/dashboard`));
});

test("4. admin cadastra lead com rodízio e aviso de duplicidade", async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`/app/${slug}/leads`);
  for (const name of ["Cliente Um", "Cliente Dois"]) {
    await page.getByRole("button", { name: "Novo lead" }).click();
    await page.getByLabel("Nome").first().fill(name);
    await page.getByLabel("Telefone / WhatsApp").fill("(11) 98888-7777");
    await page.getByLabel("E-mail").click();
    if (name === "Cliente Dois") await expect(page.getByText("Possível duplicidade")).toBeVisible();
    await page.getByRole("button", { name: "Cadastrar lead" }).click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]{36}$/);
    await expect(page.getByText(`Responsável: ${seller.name}`)).toBeVisible();
    await page.goto(`/app/${slug}/leads`);
  }
});

test("5. vendedor registra contato, ganha a oportunidade e registra vendas", async ({ page }) => {
  await signIn(page, seller);
  await page.goto(`/app/${slug}/leads`);
  await page.getByRole("link", { name: /Cliente Um/ }).click();
  await page.getByLabel("Conteúdo").fill("Primeiro contato por WhatsApp.");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(page.getByText("Primeiro contato por WhatsApp.")).toBeVisible();

  await page.getByRole("button", { name: "Ganho" }).click();
  await page.getByLabel("Valor do ganho").fill("0");
  await page.getByRole("button", { name: "Confirmar ganho" }).click();
  await expect(page.getByText("Ganho em")).toBeVisible();

  for (const [desc, value] of [
    ["Implantação", "1500,00"],
    ["Mensalidade", "300,00"],
  ]) {
    await page.getByRole("tab", { name: /Vendas/ }).click();
    await page.getByRole("button", { name: "Registrar venda" }).click();
    await page.getByLabel("Produto ou serviço").fill(desc);
    await page.getByLabel("Valor").fill(value);
    await page.getByRole("dialog").getByRole("button", { name: "Registrar venda" }).click();
    await expect(page.getByText(desc)).toBeVisible();
  }
  await expect(page.getByText("R$ 1.800,00")).toBeVisible();
});

test("6. relatórios refletem somente vendas concluídas", async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`/app/${slug}/relatorios`);
  await expect(page.getByText("R$ 1.800,00").first()).toBeVisible();
});

test("7. vendedor não acessa outra empresa manipulando a URL", async ({ page }) => {
  await signIn(page, seller);
  const res = await page.goto(`/app/empresa-que-nao-e-dele/leads`);
  expect(res?.status()).toBe(404);
});
