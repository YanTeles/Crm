# CRM Comercial

## O que é o projeto

Nosso projeto é um **CRM** (sistema para gerenciar clientes e vendas) feito para empresas que têm uma equipe de vendedores. Várias empresas podem usar o mesmo sistema, mas cada uma só enxerga os próprios dados.

Com ele dá para:

- cadastrar **leads** (possíveis clientes);
- distribuir os leads entre os vendedores automaticamente (**rodízio**);
- acompanhar cada lead em um **funil de vendas** (quadro com colunas que dá para arrastar);
- criar **tarefas** com prazo (ex.: "ligar para o cliente amanhã");
- registrar **vendas**;
- ver **relatórios** com faturamento, conversão e ranking de vendedores.

Existem dois tipos de usuário na empresa:

- **Administrador** = vê tudo da empresa, gerencia a equipe e as configurações;
- **Vendedor** = vê e trabalha só com os leads que foram entregues a ele.

Também existe o **administrador da plataforma**, que cuida de todas as empresas (pode suspender ou reativar uma empresa), mas não vê os dados comerciais delas.

## Tecnologias que usamos

- **Next.js + React** = montam as telas do sistema e fazem a ligação com o servidor
- **TypeScript** = JavaScript com tipos, ajuda a evitar erros no código
- **Tailwind CSS + shadcn/ui** = deixam o visual bonito (cores, botões, tabelas, janelas)
- **Supabase** = banco de dados (PostgreSQL), login dos usuários e avisos em tempo real
- **Zod + React Hook Form** = conferem se os formulários foram preenchidos certo
- **dnd-kit** = permite arrastar os cartões no funil
- **Recharts** = desenha os gráficos dos relatórios
- **Vitest, Playwright e pgTAP** = testes automáticos do sistema e do banco

## Como o código está organizado

### Pastas principais

```
src/        = código do site (telas e lógica)
supabase/   = banco de dados (tabelas, regras e permissões)
tests/      = testes automáticos
scripts/    = ferramentas para rodar os testes do banco e gerar os tipos
```

### Dentro de `src/`

- `src/app` = as **páginas** do sistema. Cada pasta aqui vira um endereço do site
  - `(public)` = página inicial, que apresenta o sistema
  - `(auth)` = telas de acesso: `entrar` (login), `cadastro`, `esqueci-senha`, `redefinir-senha`, `onboarding` (criar a empresa depois do cadastro) e `convite` (aceitar convite para entrar em uma empresa)
  - `app` = escolha da empresa (quando a pessoa participa de mais de uma)
  - `app/[slug]` = área interna da empresa. O `[slug]` é o nome da empresa no endereço (ex.: `/app/minha-loja`)
    - `layout.tsx` = estrutura fixa: menu lateral e barra do topo. Ao trocar de seção, só o conteúdo muda e a página não recarrega
    - `dashboard` = painel com o resumo do mês
    - `leads` = lista de leads e a página de detalhes de cada um
    - `funil` = quadro do funil de vendas (arrastar e soltar)
    - `tarefas` = tarefas de hoje, atrasadas, próximas e concluídas
    - `vendas` = lista de vendas e totais
    - `relatorios` = gráficos e números do período
    - `equipe` = membros e convites (só administradores)
    - `configuracoes` = dados da empresa, etapas do funil, campos extras, origens e motivos de perda (só administradores)
  - `perfil` = trocar nome e senha
  - `plataforma` = painel do administrador da plataforma
  - `auth/confirm` = recebe os links enviados por e-mail (confirmação de cadastro e troca de senha)

- `src/features` = a **lógica de cada parte** do sistema. Cada pasta tem as telas daquela parte e as operações que salvam ou buscam dados
  - `auth` = login, cadastro, recuperação de senha e convites
  - `leads` = cadastrar, editar, mover, ganhar, perder, arquivar e anotar nos leads
  - `pipeline` = o quadro do funil
  - `tasks` = tarefas
  - `sales` = vendas
  - `reports` = relatórios e gráficos
  - `team` = equipe e convites
  - `settings` = configurações da empresa
  - `notifications` = sininho de avisos
  - `platform` = suspender/reativar empresas
  - `profile` = perfil do usuário
  - `workspace` = listas usadas em várias telas (etapas, membros, origens...)

  Dentro delas aparecem sempre os mesmos tipos de arquivo:
  - `actions.ts` = operações que **salvam** dados (rodam no servidor)
  - `queries.ts` = operações que **buscam** dados
  - `schemas.ts` = regras dos formulários (o que é obrigatório, tamanho máximo, formato)
  - `components/` = pedaços de tela daquela parte (formulários, tabelas, janelas)

- `src/components` = **pedaços de tela reaproveitados** em vários lugares
  - `ui` = peças básicas prontas (botão, campo de texto, janela, tabela...)
  - `layout` = menu lateral, cabeçalho, logotipo, botão de tema claro/escuro, menu do usuário
  - `forms` = campo de formulário padrão, campo de dinheiro e botão de enviar
  - `data` = tabela, paginação, filtro de período, cartões de números e etiquetas coloridas

- `src/lib` = **funções de apoio** usadas pelo sistema todo
  - `supabase` = conexão com o banco de dados
  - `auth/session.ts` = descobre quem está logado, de qual empresa é e o que pode fazer
  - `dates.ts` = cálculos de data respeitando o fuso horário da empresa
  - `format.ts` = mostra valores no formato brasileiro (R$ 1.234,56, 03/11/2026)
  - `phone.ts` = valida e formata telefones e cria o link do WhatsApp
  - `errors.ts` = transforma erros do banco em mensagens claras em português

- `src/types/database.ts` = descrição das tabelas do banco para o TypeScript (gerado automaticamente)
- `src/proxy.ts` = roda antes de cada página: mantém o login ativo e manda para o login quem tenta entrar sem estar logado

### Dentro de `supabase/`

- `migrations` = scripts que **criam o banco de dados**, executados em ordem:
  - `base` = tipos de valores e ferramentas básicas
  - `tables` = todas as tabelas (empresas, membros, leads, tarefas, vendas, histórico, avisos...)
  - `authorization` = **regras de permissão**: cada empresa só vê os próprios dados e o vendedor só vê os leads dele
  - `triggers` = ações automáticas (gravar histórico, avisar o responsável, impedir apagar o histórico)
  - `rpc_company_team` = operações de empresa, equipe e convites
  - `rpc_leads` = operações de leads, rodízio e funil
  - `rpc_sales_reports` = operações de vendas e cálculos dos relatórios
- `tests/database` = testes que conferem as regras do banco (permissões, isolamento entre empresas, rodízio, vendas)
- `templates` = modelos dos e-mails de confirmação e de troca de senha

### Dentro de `tests/`

- `unit` = testes das funções de apoio (telefone, dinheiro, datas, mensagens de erro)
- `integration` = teste do rodízio com vários cadastros ao mesmo tempo
- `e2e` = testes que abrem o sistema no navegador e simulam uma pessoa usando

## Como as partes conversam

1. A pessoa abre uma página (ex.: Leads).
2. O `proxy.ts` confere se ela está logada.
3. A página, em `src/app`, usa as funções de `src/features/.../queries.ts` para buscar os dados no banco.
4. Quando a pessoa salva algo (ex.: cadastra um lead), o formulário chama uma função de `actions.ts`.
5. Essa função confere os dados com as regras de `schemas.ts` e manda para o banco.
6. O banco confere de novo as permissões, salva e registra no histórico.
7. A tela é atualizada com os dados novos.

## Segurança

- **A segurança fica no banco de dados.** Mesmo que alguém tente burlar a tela, o banco confere se a pessoa é membro ativo da empresa e se tem permissão.
- Cada registro guarda de qual empresa ele é, então um dado de uma empresa nunca se mistura com o de outra.
- O histórico dos leads e o registro de auditoria **não podem ser alterados nem apagados**.
- Se duas pessoas editam o mesmo lead ao mesmo tempo, o sistema avisa em vez de sobrescrever.
- Os formulários são conferidos duas vezes: na tela (para avisar rápido) e no servidor (para garantir).

## Regras de negócio

- **Rodízio:** os leads novos são entregues aos vendedores ativos, um de cada vez, em ordem.
- **Ganho:** marcar um lead como ganho exige informar um valor (pode ser R$ 0,00).
- **Perda:** marcar como perdido exige escolher um motivo.
- **Faturamento:** soma só as vendas **concluídas**, pela data de conclusão. O valor do ganho não entra no faturamento.
- **Conversão:** leads criados no período que estão ganhos.
- **Vendedor:** vê e altera só os leads dele e só pode editar ou cancelar as próprias vendas pendentes.
- **Tarefas atrasadas:** geram um aviso automático no sininho do responsável.
