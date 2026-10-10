import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /smoke.spec.ts/ },
  ],
  // Sem E2E_BASE_URL, sobe o app localmente. As variáveis vêm do .env.local
  // (ou de placeholders para os testes de fumaça que não acessam o Supabase).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "e2e-placeholder",
          NEXT_PUBLIC_SITE_URL: baseURL,
        },
      },
});
