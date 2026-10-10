# CRM Comercial (SaaS multiempresa)

CRM web multiempresa com isolamento rígido de dados: leads, funil Kanban, distribuição por rodízio, tarefas, vendas e relatórios. Especificação funcional em [CRM_SAAS_ESPECIFICACAO.md](CRM_SAAS_ESPECIFICACAO.md).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript estrito · Tailwind CSS 4 · shadcn/ui · Supabase (PostgreSQL, Auth, RLS, Realtime) · TanStack Query/Table · dnd-kit · Recharts · React Hook Form + Zod · Vitest · Playwright · pgTAP.

## Arquitetura em uma página

- **Banco é a fonte da verdade.** Toda tabela tem RLS. Escrita em entidades centrais (leads, etapas, atribuição, vendas, equipe, empresa) só acontece por funções SQL (`supabase/migrations/*_rpc_*.sql`) que validam autorização, travam linhas e gravam histórico/auditoria na mesma transação.
- **Isolamento multiempresa:** FKs compostas `(company_id, id)` impedem vínculos entre empresas; políticas exigem membro **ativo** de empresa **ativa** (lidos do banco, nunca de claims do JWT).
- **Next.js:** Server Components para leitura e Server Actions para mutações, sempre com a sessão do usuário (`@supabase/ssr`). Nenhuma chave `service_role`/secret é usada pela aplicação.
- **URLs:** `/app/[slug]/...`. O slug só identifica a empresa; a autorização vem do vínculo do usuário.

```
src/
  app/            rotas (públicas, auth, /app/[slug]/..., /plataforma, /perfil)
  components/     ui (shadcn), layout, forms, data (tabelas, filtros, cards)
  features/       módulos: auth, leads, pipeline, tasks, sales, reports, team, settings, notifications, platform
  lib/            supabase, auth (DAL), datas/fuso, telefone, formatação, erros
  types/          database.ts (gerado)
supabase/
  migrations/     schema, RLS, funções, triggers, agendamento
  tests/database/ testes pgTAP (isolamento, permissões, regras de negócio)
tests/            unit (Vitest), integration (Postgres real), e2e (Playwright)
scripts/db/       runner de testes e gerador de tipos sem Docker (PGlite)
```

## Pré-requisitos

- Node.js 22+ (testado com 24 LTS)
- Para o ambiente local completo: **Docker Desktop** (com WSL2 no Windows) — o Supabase CLI já vem como dependência (`npx supabase`).

## Configuração local

```bash
npm install
npm run db:start            # sobe Supabase local (Docker); exibe URL e chaves
cp .env.example .env.local  # preencha com a URL e a chave publishable exibidas
npm run db:reset            # aplica migrações + seed
npm run dev                 # http://localhost:3000
```

E-mails locais (confirmação, recuperação) ficam no Mailpit: http://127.0.0.1:54324.

Superadministrador: não existe cadastro público. Promova um usuário via SQL (veja `supabase/seed.sql`).

## Variáveis de ambiente

| Variável                               | Uso                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL do projeto Supabase                                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública (publishable/anon). Segura no navegador: a RLS protege os dados        |
| `NEXT_PUBLIC_SITE_URL`                 | URL pública da aplicação (links de e-mail e convites)                                |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       | Opcional. CAPTCHA no cadastro/recuperação; a chave secreta vai no painel do Supabase |

Nunca versione `.env.local`. A aplicação não precisa de `service_role`.

## Comandos

| Comando                              | O que faz                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`    | Desenvolvimento, build e produção                                                      |
| `npm run typecheck` · `npm run lint` | TypeScript estrito e ESLint                                                            |
| `npm test`                           | Vitest (unidade; integração roda se `SUPABASE_DB_URL` estiver definido)                |
| `npm run test:db`                    | Migrações + **todos os testes pgTAP** em Postgres embarcado (PGlite), sem Docker       |
| `npm run test:db:supabase`           | Mesmos testes pgTAP no Supabase local (`supabase test db`)                             |
| `npm run test:e2e`                   | Playwright: testes de fumaça; fluxo crítico completo com `E2E_FULL=1` e Supabase local |
| `npm run db:types`                   | Regenera `src/types/database.ts` a partir das migrações (sem Docker)                   |
| `npm run check`                      | typecheck + lint + unit + pgTAP                                                        |

Teste de concorrência do rodízio (Postgres real):
`SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm test`

## Deploy (Vercel + Supabase gerenciado)

1. Crie o projeto Supabase e rode `npx supabase link` + `npx supabase db push` (aplica as migrações versionadas).
2. No painel do Supabase: habilite confirmação de e-mail, configure **SMTP próprio** (o padrão tem limite muito baixo), Site URL e Redirect URLs com o domínio de produção, templates de e-mail iguais aos de `supabase/templates/` (fluxo `token_hash`), e opcionalmente o CAPTCHA (Turnstile).
3. Confirme que a extensão `pg_cron` está habilitada (notificações de tarefas vencidas a cada 5 min).
4. Na Vercel, defina as variáveis de ambiente acima e faça o deploy.
5. Antes de produção: backups/restauração testados, política de retenção e processo LGPD.

## Regras de negócio relevantes

- Ganho exige valor (R$ 0,00 permitido) e **não** cria venda; faturamento soma apenas vendas `completed`, pela data de conclusão.
- Conversão = leads criados no período que estão ganhos (lead reaberto e não ganho de novo não conta).
- Vendedor vê e altera apenas leads atribuídos a ele; edita/cancela só as próprias vendas pendentes.
- Rodízio: só vendedores ativos, ordem de entrada na empresa, transacional por empresa; atribuição manual não altera a posição.
- Histórico (`lead_events`) e auditoria (`audit_logs`) são imutáveis.
