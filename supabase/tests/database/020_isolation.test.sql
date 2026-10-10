-- Isolamento entre empresas e entre vendedores: leitura, escrita e RPCs.
begin;
select plan(46);

-- Cenário: empresa A (admin + 2 vendedores) e empresa B (admin + 1 vendedor)
select tests.create_user('a_admin');
select tests.create_user('a_s1');
select tests.create_user('a_s2');
select tests.create_user('b_admin');
select tests.create_user('b_s1');
select tests.create_company('a_admin', 'Empresa A', 'A');
select tests.create_company('b_admin', 'Empresa B', 'B');
select tests.add_member('A', 'a_admin', 'a_s1', 'seller');
select tests.add_member('A', 'a_admin', 'a_s2', 'seller');
select tests.add_member('B', 'b_admin', 'b_s1', 'seller');

-- Dados: lead de cada vendedor de A e um lead de B
select tests.authenticate_as('a_admin');
select tests.set_var('lead_a1', public.create_lead(tests.id('A'), tests.lead_payload('Lead A1', '+5511911110001'),
  '{}', 'manual', tests.uid('a_s1')) ->> 'lead_id');
select tests.set_var('lead_a2', public.create_lead(tests.id('A'), tests.lead_payload('Lead A2', '+5511911110002'),
  '{}', 'manual', tests.uid('a_s2')) ->> 'lead_id');
select tests.set_var('sale_a1', public.create_sale(tests.id('lead_a1'), 'Plano anual', 1500, 'completed')::text);
insert into public.tasks (company_id, lead_id, title, assigned_to, due_at)
  values (tests.id('A'), tests.id('lead_a1'), 'Ligar', tests.uid('a_s1'), now() + interval '1 day');
insert into public.lead_interactions (company_id, lead_id, kind, content)
  values (tests.id('A'), tests.id('lead_a1'), 'note', 'Primeiro contato');
select tests.authenticate_as('b_admin');
select tests.set_var('lead_b1', public.create_lead(tests.id('B'), tests.lead_payload('Lead B1', '+5511911110001'),
  '{}', 'manual', tests.uid('b_s1')) ->> 'lead_id');
select tests.set_var('sale_b1', public.create_sale(tests.id('lead_b1'), 'Serviço', 900, 'completed')::text);
select tests.as_postgres();

-- ---------------------------------------------------------------------------
-- Leitura: admin de B não enxerga nada de A
-- ---------------------------------------------------------------------------
select tests.authenticate_as('b_admin');
select is((select count(*)::int from public.companies where id = tests.id('A')), 0, 'B não vê empresa A');
select is((select count(*)::int from public.company_members where company_id = tests.id('A')), 0, 'B não vê membros de A');
select is((select count(*)::int from public.profiles where id = tests.uid('a_admin')), 0, 'B não vê perfis de A');
select is((select count(*)::int from public.leads where company_id = tests.id('A')), 0, 'B não vê leads de A');
select is((select count(*)::int from public.leads where id = tests.id('lead_a1')), 0, 'B não vê lead de A mesmo pelo id');
select is((select count(*)::int from public.sales where company_id = tests.id('A')), 0, 'B não vê vendas de A');
select is((select count(*)::int from public.tasks where company_id = tests.id('A')), 0, 'B não vê tarefas de A');
select is((select count(*)::int from public.lead_interactions where company_id = tests.id('A')), 0, 'B não vê interações de A');
select is((select count(*)::int from public.lead_events where company_id = tests.id('A')), 0, 'B não vê histórico de A');
select is((select count(*)::int from public.pipeline_stages where company_id = tests.id('A')), 0, 'B não vê etapas de A');
select is((select count(*)::int from public.lead_sources where company_id = tests.id('A')), 0, 'B não vê origens de A');
select is((select count(*)::int from public.audit_logs where company_id = tests.id('A')), 0, 'B não vê auditoria de A');
select is((select count(*)::int from public.notifications where company_id = tests.id('A')), 0, 'B não vê notificações de A');
select is((select count(*)::int from public.leads), 1, 'B vê apenas o próprio lead');

-- ---------------------------------------------------------------------------
-- Escrita/RPC: admin de B não altera nada de A, mesmo manipulando IDs
-- ---------------------------------------------------------------------------
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('Invasor')) $$, tests.id('A')),
  '42501', 'crm:forbidden', 'B não cria lead em A');
select throws_ok(format($$ select public.move_lead_stage(%L, %L) $$, tests.id('lead_a1'), tests.stage_id('A', 'Negociação')),
  '42501', 'crm:forbidden', 'B não movimenta lead de A');
select throws_ok(format($$ select public.assign_lead(%L, %L) $$, tests.id('lead_a1'), tests.uid('b_s1')),
  '42501', 'crm:forbidden', 'B não transfere lead de A');
select throws_ok(format($$ select public.cancel_sale(%L, 'fraude') $$, tests.id('sale_a1')),
  '42501', 'crm:forbidden', 'B não cancela venda de A');
select throws_ok(format($$ select public.find_possible_duplicates(%L, '+5511911110001') $$, tests.id('A')),
  '42501', 'crm:forbidden', 'B não consulta duplicidade em A');
select throws_ok(format($$ select public.report_summary(%L, now() - interval '1 year', now() + interval '1 day') $$, tests.id('A')),
  '42501', 'crm:forbidden', 'B não lê relatórios de A');
select throws_ok(format($$ select * from public.create_invitation(%L, 'x@test.local') $$, tests.id('A')),
  '42501', 'crm:forbidden', 'B não convida para A');
select throws_ok(format($$ select public.set_member_status(%L, 'inactive') $$, tests.member_id('A', 'a_s1')),
  '42501', 'crm:forbidden', 'B não desativa membro de A');
select throws_ok(format($$ insert into public.lost_reasons (company_id, name) values (%L, 'Invasão') $$, tests.id('A')),
  '42501', null, 'B não cria motivo de perda em A');
select throws_ok(format($$ insert into public.tasks (company_id, lead_id, title, assigned_to, due_at) values (%L, %L, 'x', %L, now()) $$,
  tests.id('A'), tests.id('lead_a1'), tests.uid('b_admin')),
  '42501', null, 'B não cria tarefa em A');
select throws_ok(format($$ insert into public.lead_interactions (company_id, lead_id, kind, content) values (%L, %L, 'note', 'x') $$,
  tests.id('A'), tests.id('lead_a1')),
  '42501', null, 'B não registra interação em lead de A');
select is_empty(format($$ update public.tasks set title = 'hack' where company_id = %L returning id $$, tests.id('A')),
  'B não altera tarefas de A');

-- ---------------------------------------------------------------------------
-- Admin de A não consegue ligar entidades de B
-- ---------------------------------------------------------------------------
select tests.authenticate_as('a_admin');
select throws_ok(format($$ select public.assign_lead(%L, %L) $$, tests.id('lead_a1'), tests.uid('b_s1')),
  'P0001', 'crm:assignee_not_active_seller', 'A não atribui lead a vendedor de B');
select throws_ok(format($$ select public.move_lead_stage(%L, %L) $$, tests.id('lead_a1'), tests.stage_id('B', 'Negociação')),
  'P0001', 'crm:invalid_stage', 'A não move lead para etapa de B');
select throws_ok(format($$ select public.mark_lead_lost(%L, %L) $$, tests.id('lead_a1'), tests.reason_id('B', 'Preço')),
  'P0001', 'crm:invalid_lost_reason', 'A não usa motivo de perda de B');
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('X') || jsonb_build_object('source_id', %L)) $$,
  tests.id('A'), tests.source_id('B', 'Site')),
  'P0001', 'crm:invalid_source', 'A não usa origem de B');
select throws_ok(format($$ insert into public.tasks (company_id, lead_id, title, assigned_to, due_at) values (%L, %L, 'x', %L, now()) $$,
  tests.id('A'), tests.id('lead_b1'), tests.uid('a_s1')),
  '23503', null, 'FK composta impede tarefa de A apontando para lead de B');

-- ---------------------------------------------------------------------------
-- Escrita direta em tabelas centrais é negada
-- ---------------------------------------------------------------------------
select throws_ok(format($$ insert into public.leads (company_id, name, phone_raw, phone_normalized, stage_id, created_by) values (%L, 'x', '1', '+5511900000000', %L, %L) $$,
  tests.id('A'), tests.stage_id('A', 'Novo'), tests.uid('a_admin')),
  '42501', null, 'insert direto em leads negado');
select throws_ok(format($$ update public.leads set assigned_to = null where id = %L $$, tests.id('lead_a1')),
  '42501', null, 'update direto em leads negado');
select throws_ok($$ delete from public.lead_events $$, '42501', null, 'delete em lead_events negado');
select throws_ok(format($$ update public.sales set amount = 1 where id = %L $$, tests.id('sale_a1')),
  '42501', null, 'update direto em vendas negado');
select throws_ok(format($$ update public.company_members set role = 'admin' where company_id = %L $$, tests.id('A')),
  '42501', null, 'escalada de papel por update direto negada');
select throws_ok(format($$ update public.lost_reasons set company_id = %L $$, tests.id('B')),
  '42501', null, 'troca de company_id em configuração negada');

-- ---------------------------------------------------------------------------
-- Vendedor: só os próprios leads
-- ---------------------------------------------------------------------------
select tests.authenticate_as('a_s1');
select is((select count(*)::int from public.leads), 1, 'vendedor vê somente o próprio lead');
select is((select count(*)::int from public.leads where id = tests.id('lead_a2')), 0, 'vendedor não vê lead do colega');
select is((select count(*)::int from public.lead_events where lead_id = tests.id('lead_a2')), 0, 'vendedor não vê histórico do lead do colega');
select throws_ok(format($$ select public.move_lead_stage(%L, %L) $$, tests.id('lead_a2'), tests.stage_id('A', 'Negociação')),
  'P0002', 'crm:not_found', 'vendedor não movimenta lead do colega');
select throws_ok(format($$ select public.assign_lead(%L, %L) $$, tests.id('lead_a1'), tests.uid('a_s2')),
  '42501', 'crm:forbidden', 'vendedor não transfere leads');
select throws_ok(format($$ select public.create_sale(%L, 'x', 10) $$, tests.id('lead_a2')),
  'P0002', 'crm:not_found', 'vendedor não registra venda em lead do colega');
select throws_ok(format($$ insert into public.lead_interactions (company_id, lead_id, kind, content) values (%L, %L, 'note', 'x') $$,
  tests.id('A'), tests.id('lead_a2')),
  '42501', null, 'vendedor não registra interação em lead do colega');
select throws_ok(format($$ select public.create_stage(%L, 'Etapa nova') $$, tests.id('A')),
  '42501', 'crm:forbidden', 'vendedor não configura funil');
select is((select count(*)::int from public.report_by_seller(tests.id('A'), now() - interval '1 year', now() + interval '1 day')),
  1, 'ranking para vendedor contém apenas ele mesmo');

select * from finish();
rollback;
