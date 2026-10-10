# CRM SaaS Multiempresa — Especificação para Claude Code

**Status:** planejamento funcional e técnico aprovado; implementação ainda não iniciada.  
**Objetivo:** construir um CRM comercial web, multiempresa, com potencial de uso e comercialização reais.  
**Instrução principal:** este documento descreve o produto; **não criar backlog, sprints ou histórias de usuário**. Antes de executar mudanças irreversíveis, apresentar decisões pendentes. Implementar em incrementos verificáveis, sem adicionar funcionalidades não previstas.

## 1. Visão do produto

A plataforma atende várias empresas no mesmo SaaS, com isolamento rígido dos dados. Cada empresa possui administradores, vendedores, leads, funis, campos personalizados, tarefas, vendas e relatórios próprios. O sistema deve ser responsivo, acessível, seguro e preparado para expansão.

### Perfis

- **Superadministrador da plataforma:** administra cadastro, ativação e suspensão de empresas e indicadores operacionais da plataforma. Não tem acesso irrestrito a dados comerciais; suporte excepcional deve ser autorizado e auditado.
- **Administrador da empresa:** gerencia usuários, leads, distribuição, funis, tarefas, vendas, configurações e relatórios da sua empresa.
- **Vendedor:** acessa e gerencia leads atribuídos, registra interações, tarefas e vendas permitidas e consulta indicadores individuais. Não acessa leads de outros vendedores nem de outras empresas.

O cadastro de empresas é livre: quem cria a empresa torna-se seu administrador inicial. Deve haver confirmação de e-mail, limites contra abuso e recuperação segura de senha.

## 2. Stack e arquitetura

- **Front-end e aplicação web:** Next.js (App Router), React e TypeScript em modo estrito.
- **Estilização:** Tailwind CSS e shadcn/ui; ícones Lucide.
- **Dados:** Supabase PostgreSQL; migrações SQL versionadas em `supabase/migrations`.
- **Identidade:** Supabase Auth (e-mail/senha, verificação de e-mail e recuperação de acesso).
- **Autorização:** Supabase Row Level Security (RLS) e checagens no servidor; todas as entidades comerciais com vínculo de empresa.
- **Lógica de negócio:** funções de servidor e Route Handlers do Next.js; operações concorrentes/atômicas (como rodízio) via funções SQL/RPC transacionais.
- **Dados e interface:** TanStack Query para consultas que se beneficiem de cache; TanStack Table para tabelas; dnd-kit para Kanban; Recharts para gráficos; React Hook Form + Zod para formulários.
- **Atualizações:** Supabase Realtime apenas onde necessário, especialmente notificações e atualizações relevantes; evitar assinaturas desnecessárias.
- **Testes:** Vitest para lógica e Playwright para fluxos críticos.
- **Hospedagem candidata:** Vercel para Next.js e Supabase gerenciado; confirmar custo e limites antes de produção.

Não incluir FastAPI inicialmente. Não expor `service_role` ou segredos em código cliente. Credenciais e variáveis de ambiente ficam fora do Git; disponibilizar `.env.example` sem valores reais.

### Organização sugerida

```text
src/
  app/
    (auth)/
    (platform)/
    (workspace)/
    api/
  components/
    ui/
    layout/
  features/
    companies/
    users/
    leads/
    pipeline/
    interactions/
    tasks/
    sales/
    reports/
    notifications/
  lib/
    supabase/
    auth/
    validation/
  types/
supabase/
  migrations/
tests/
```

A estrutura pode ser ajustada conforme o projeto, sem criar abstrações excessivas.

## 3. Isolamento multiempresa e segurança

1. Toda tabela de negócio deve conter `company_id` ou herdar escopo por relacionamento seguro.
2. Usuários autenticados só acessam registros das empresas às quais pertencem e para os quais têm permissão. Para o MVP, o uso cotidiano pode considerar uma empresa ativa por sessão; o esquema de associação suporta evolução.
3. RLS deve cobrir **SELECT, INSERT, UPDATE e DELETE** conforme cada papel. Não confiar em filtros enviados pelo navegador.
4. Chaves estrangeiras e validações no banco devem impedir vínculos entre entidades de empresas diferentes; usar chaves compostas quando apropriado.
5. Administradores só administram membros de sua empresa; vendedores só manipulam seus registros permitidos.
6. Toda ação sensível registra autor, empresa, momento e tipo de evento; não armazenar senhas, tokens ou dados sensíveis desnecessários nos logs.
7. Proteger endpoints e Server Actions contra acesso não autenticado e escalada de privilégio. Não usar `service_role` como atalho para ignorar RLS.
8. Aplicar validação de entradas, paginação, limites de requisição e proteção contra abuso no cadastro e autenticação.
9. HTTPS, backups e restauração testada, retenção de dados e processos LGPD são requisitos para disponibilização real.
10. O cadastro livre não dá a novos usuários poderes de superadministrador. A atribuição de superadmin exige procedimento administrativo seguro, nunca parâmetro público.

## 4. Módulos e regras funcionais

### 4.1 Cadastro e gestão de empresas

- Formulário público para registrar empresa e administrador inicial.
- Confirmar e-mail antes de habilitar uso pleno.
- Empresa possui nome, identificador, estado (`active`, `suspended`), data de criação e configurações.
- Superadministrador lista, pesquisa, ativa e suspende empresas; suspensão bloqueia acesso operacional preservando os dados.
- Não implementar planos pagos, cobrança ou assinaturas na primeira versão.

### 4.2 Usuários e permissões

- Login, logout, recuperação de senha e gerenciamento de perfil.
- Administrador convida/cadastra vendedores, ativa/desativa acessos e define papel.
- Usuário desativado não participa do rodízio e não pode operar o workspace.
- Vendedor visualiza somente leads e dados comerciais autorizados.

### 4.3 Leads

- Cadastrar, editar, pesquisar, filtrar e arquivar leads.
- Campos padrão: nome (obrigatório), telefone/WhatsApp (obrigatório), e-mail (opcional), empresa do cliente (opcional), origem (opcional), responsável (opcional), observações (opcional), etapa, criação e atualização automáticas.
- Normalizar telefone para comparação; detectar possível duplicidade **somente na mesma empresa** e avisar, sem impedir cadastro.
- Campos personalizados por empresa: texto, número, data e seleção de opções. Validar tipo, opções e obrigatoriedade no servidor; evitar que definição de campo de uma empresa seja usada em lead de outra.
- Arquivamento lógico no uso comum; exclusão definitiva e solicitações de titulares exigem fluxo administrativo específico.

### 4.4 Distribuição de leads

- **Manual:** administrador atribui ou transfere lead para vendedor ativo da mesma empresa.
- **Automática:** rodízio entre vendedores ativos da empresa; operação atômica para impedir colisões sob concorrência.
- Atribuição manual não altera a posição do rodízio.
- Registrar atribuições e transferências no histórico, incluindo responsável anterior e novo.
- Se não houver vendedor ativo, manter lead sem responsável e apresentar aviso claro.

### 4.5 Funil Kanban

- Etapas iniciais: **Novo, Em atendimento, Negociação, Ganho e Perdido**.
- Administradores podem criar, renomear e ordenar etapas intermediárias por empresa.
- Os resultados semânticos `won` e `lost` são estáveis internamente, mesmo que os nomes exibidos mudem; preservar coerência dos indicadores.
- Vendedores movimentam apenas seus leads; administradores movimentam os da empresa.
- Toda movimentação gera evento de histórico com autor, origem, destino e horário.
- Ao marcar como perdido, motivo obrigatório.
- Ao marcar como ganho, solicitar valor de fechamento, inclusive zero. **Como um lead pode ter várias vendas, o fechamento do funil e o registro das vendas devem ser entidades distintas**: a etapa Ganho representa o resultado da oportunidade, e cada venda é uma transação separada. Evitar criação automática de vendas duplicadas ao repetir a movimentação.
- Administradores e vendedor responsável podem reabrir leads ganhos/perdidos, com registro do evento.
- Mudanças ou exclusões de etapas com leads vinculados exigem estratégia segura de migração/reatribuição; não excluir registros em cascata inadvertidamente.

### 4.6 Histórico, interações e WhatsApp

- Histórico de sistema imutável para mudanças importantes: criação, responsável, etapa, perda, ganho, reabertura e alterações sensíveis.
- Interações manuais: observação, contato realizado, autor e data.
- Ação de abrir conversa no WhatsApp pelo número normalizado; não enviar mensagens automaticamente nem integrar API oficial nesta versão.

### 4.7 Tarefas e alertas

- Administradores e vendedores criam tarefas conforme suas permissões de acesso ao lead.
- Campos: título, descrição, lead opcional ou vinculado conforme interface, responsável, prazo com fuso horário e situação.
- Estados persistidos: pendente e concluída; **atrasada é condição derivada** de prazo vencido e pendência.
- Exibir tarefas de hoje, próximas, atrasadas e concluídas; alertas internos visíveis no CRM.
- Notificações internas não dependem de e-mail ou push. Evitar notificações duplicadas; definir gatilhos e leitura/dispensa.

### 4.8 Vendas

- Um lead pode ter **múltiplas vendas**.
- Cada venda registra lead, empresa, vendedor, descrição do produto/serviço, valor monetário, data e estado comercial.
- Usar tipo decimal/numeric para valores, nunca float para dinheiro.
- Definir `completed` e `cancelled` (e outros estados apenas se necessários). Faturamento soma somente vendas concluídas e não canceladas.
- Registrar alterações e cancelamentos; não apagar vendas para corrigir indicadores.
- Venda pode ocorrer em período distinto da criação do lead. Não contar a mesma venda duas vezes em relatórios.

### 4.9 Dashboard e relatórios

- Indicadores: total de leads, quantidade de vendas, faturamento, ticket médio, taxa de conversão, ranking por vendedor, evolução mensal, origem dos leads, motivos de perda e desempenho individual.
- Filtros: período, vendedor (quando autorizado), etapa/status e origem; aplicar sempre escopo da empresa.
- **Taxa de conversão:** usar uma definição explícita e consistente. Proposta inicial: proporção de leads criados no período que alcançaram Ganho, com distinção visual entre data de criação do lead e data de fechamento da venda. Não confundir quantidade de vendas com quantidade de leads convertidos.
- Faturamento por período considera a data de conclusão da venda; evolução mensal deve usar o mesmo critério.
- Vendedor só vê seus indicadores autorizados; administrador vê totais da empresa.
- Relatórios precisam lidar corretamente com valores zero, dados ausentes, cancelamentos, fusos horários e filtros combinados.

## 5. Páginas e navegação

### Públicas

- Página de entrada/apresentação simples.
- Cadastro de empresa e administrador.
- Login, confirmação de e-mail, esqueci minha senha e redefinição de senha.

### Superadministrador

- Visão geral da plataforma.
- Empresas: pesquisa, detalhes, ativação/suspensão.
- Indicadores operacionais agregados sem exposição desnecessária de dados comerciais.

### Administrador da empresa

- Dashboard.
- Leads (tabela e cadastro/edição).
- Funil Kanban.
- Detalhes do lead (dados, campos personalizados, histórico, interações, tarefas e vendas).
- Tarefas e alertas.
- Vendas.
- Relatórios.
- Equipe.
- Configurações (empresa, etapas, campos personalizados e distribuição).

### Vendedor

- Dashboard individual.
- Meus leads, Kanban dos leads atribuídos, detalhes e interações.
- Minhas tarefas e notificações.
- Minhas vendas e resultados individuais.

### Diretrizes de interface

- Design profissional, responsivo e consistente, com menu lateral no desktop e navegação adaptada ao celular.
- Tema claro/escuro, estados de carregamento, erro e vazio, confirmação de ações destrutivas, acessibilidade de teclado e contraste.
- Filtros preservados quando fizer sentido; tabelas paginadas e busca eficiente.
- Evitar telas fictícias e dados estáticos na entrega funcional; usar estados vazios e dados reais.

## 6. Modelo de dados inicial

Tabelas candidatas (nomes podem ser refinados durante a modelagem):

| Tabela                    | Finalidade                                    |
| ------------------------- | --------------------------------------------- |
| `companies`               | Cadastro, status e configurações das empresas |
| `profiles`                | Perfil de usuário associado ao Supabase Auth  |
| `company_members`         | Papel, status e vínculo usuário-empresa       |
| `leads`                   | Cadastro e estado atual dos leads             |
| `custom_fields`           | Definições dos campos personalizados          |
| `lead_custom_values`      | Valores dos campos de cada lead               |
| `pipeline_stages`         | Etapas configuradas por empresa               |
| `lead_interactions`       | Contatos e observações manuais                |
| `lead_events`             | Histórico/auditoria de ações                  |
| `tasks`                   | Tarefas e prazos                              |
| `sales`                   | Transações de venda, múltiplas por lead       |
| `notifications`           | Alertas internos                              |
| `lead_distribution_state` | Estado transacional do rodízio                |

**Requisitos de modelagem:** UUIDs, timestamps com fuso (`timestamptz`), índices para `company_id`, responsáveis, etapas, datas e buscas comuns, restrições de integridade e chaves estrangeiras adequadas. Preparar migrações reversíveis quando viável e dados de demonstração sem informações pessoais reais.

## 7. Fluxos críticos que precisam funcionar

1. Pessoa cria empresa, confirma e-mail, entra como administrador e encontra workspace isolado.
2. Administrador cadastra vendedor e configura as etapas e campos personalizados.
3. Administrador cadastra lead, recebe alerta de duplicidade e decide continuar.
4. Administrador distribui manualmente ou aciona rodízio automático.
5. Vendedor registra contato, cria tarefa, recebe alerta interno e movimenta lead no Kanban.
6. Vendedor marca oportunidade como perdida informando motivo ou como ganha com valor obrigatório (zero permitido).
7. Lead pode ter várias vendas independentes, sem duplicar faturamento.
8. Administrador visualiza dashboard e relatórios consistentes com filtros.
9. Vendedor da empresa A não consegue consultar, alterar ou descobrir dados da empresa B, mesmo manipulando IDs ou chamadas de rede.
10. Usuário sem permissão recebe erro apropriado em vez de acesso parcial.

## 8. Qualidade e critérios técnicos

- TypeScript estrito, lint e formatação consistentes.
- Componentes reutilizáveis, lógica de domínio separada da apresentação.
- Validação no cliente **e** no servidor, com mensagens claras.
- Paginação e consultas eficientes; evitar carregar todos os leads para filtrar no navegador.
- Testes de RLS e autorização multiempresa são obrigatórios antes de produção.
- Testes automatizados para rodízio concorrente, duplicidade, movimentação, múltiplas vendas, cancelamentos e cálculos dos indicadores.
- Migrações versionadas e scripts de setup reproduzíveis.
- README com pré-requisitos, configuração Supabase, variáveis de ambiente, comandos de desenvolvimento, testes e deploy.
- Não registrar nem exibir segredos em logs; não versionar `.env`.

## 9. Fora do escopo da versão inicial

- Cobrança recorrente, planos pagos e gateway de pagamento.
- Disparo automático de WhatsApp, integração com WhatsApp Business API ou chatbot.
- Importação/exportação em massa de leads.
- Integrações externas com formulários, telefonia ou ERPs.
- Automação avançada de campanhas e jornadas.
- Notificações por e-mail ou push para tarefas (somente internas no MVP).
- Aplicativos nativos Android/iOS.
- Inteligência artificial para qualificação ou previsão de vendas.

## 10. Orientações operacionais para o Claude Code

1. Leia este documento integralmente antes de propor implementação.
2. Inspecione o repositório existente; **não sobrescreva trabalho prévio** sem autorização.
3. Antes de codificar, apresente resumidamente a arquitetura efetiva, estrutura de pastas, esquema inicial e dependências necessárias.
4. Identifique e pergunte apenas decisões que bloqueiam implementação. Não substitua decisões já aprovadas.
5. Trabalhe por módulos pequenos e executáveis; não tentar construir o sistema inteiro em uma única alteração.
6. Crie e teste migrações e políticas RLS antes de conectar módulos de interface a dados reais.
7. Use Supabase Auth e SSR de forma compatível com Next.js App Router; mantenha tokens e chaves protegidos.
8. Nunca contorne segurança para fazer a interface funcionar. Nunca use dados de outra empresa em consultas ou testes sem isolamento.
9. Ao concluir cada módulo, execute verificações disponíveis (lint, typecheck, testes), informe arquivos alterados, resultado e pendências reais.
10. Não alegue que algo foi testado se não executou o teste. Não invente URLs, credenciais, integrações ou funcionalidades.
11. Não elaborar backlog, sprints, story points ou documentação Scrum sem pedido explícito.
12. **Não iniciar deploy, alterar configurações de produção ou executar operações destrutivas sem confirmação.**

## 11. Pontos que exigem confirmação durante o detalhamento

- Regras de associação de um mesmo usuário a várias empresas (o esquema permite, mas a experiência de troca de empresa ainda não foi definida).
- Se todas as vendas exigem oportunidade ganha ou se vendas podem ser registradas independentemente do status do lead.
- Critério final de conversão e tratamento de leads reabertos.
- Se vendedores podem editar/cancelar vendas já concluídas ou se isso exige administrador.
- Limites de quantidade de campos personalizados, etapas e usuários por empresa.
- Provedor de e-mail para confirmação/recuperação em produção, limites de envio e antispam.
- Política de retenção, exportação e eliminação de dados para atendimento à LGPD.

Esses pontos não autorizam a implementação de comportamento arbitrário: documentar proposta e solicitar decisão quando ela afetar segurança, dados ou resultados comerciais.
