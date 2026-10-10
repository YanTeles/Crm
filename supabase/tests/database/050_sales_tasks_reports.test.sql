-- Vendas múltiplas, permissões D2, faturamento, tarefas, notificações e relatórios.
begin;
select plan(32);

select tests.create_user('adm');
select tests.create_user('s1');
select tests.create_user('s2');
select tests.create_company('adm', 'Vendas SA', 'V');
select tests.add_member('V', 'adm', 's1', 'seller');
select tests.add_member('V', 'adm', 's2', 'seller');

select tests.authenticate_as('adm');
select tests.set_var('lead1', public.create_lead(tests.id('V'), tests.lead_payload('Cliente 1'), '{}', 'manual', tests.uid('s1')) ->> 'lead_id');
select tests.set_var('lead2', public.create_lead(tests.id('V'), tests.lead_payload('Cliente 2'), '{}', 'manual', tests.uid('s2')) ->> 'lead_id');

-- ---------------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------------
select tests.authenticate_as('s1');
select tests.set_var('req', gen_random_uuid()::text);
select tests.set_var('sale1', public.create_sale(tests.id('lead1'), 'Implantação', 100, 'completed', null, tests.uid('s2'), tests.id('req'))::text);
select is((select seller_id from public.sales where id = tests.id('sale1')), tests.uid('s1'),
  'vendedor sempre registra a venda em seu nome');
select is(public.create_sale(tests.id('lead1'), 'Implantação', 100, 'completed', null, null, tests.id('req')), tests.id('sale1'),
  'reenvio da mesma venda não duplica');
select tests.set_var('sale2', public.create_sale(tests.id('lead1'), 'Mensalidade', 50.5, 'pending')::text);
select tests.set_var('sale3', public.create_sale(tests.id('lead1'), 'Treinamento', 30, 'pending')::text);
select is((select count(*)::int from public.sales where lead_id = tests.id('lead1')), 3, 'lead com várias vendas independentes');
select throws_ok(format($$ select public.create_sale(%L, 'x', 0) $$, tests.id('lead1')),
  'P0001', 'crm:invalid_amount', 'venda com valor zero não é permitida');
select throws_ok(format($$ select public.create_sale(%L, 'x', 10.555) $$, tests.id('lead1')),
  'P0001', 'crm:invalid_amount', 'valor com mais de duas casas rejeitado');
select throws_ok(format($$ select public.create_sale(%L, 'x', 10, 'completed', now() + interval '1 day') $$, tests.id('lead1')),
  'P0001', 'crm:invalid_completed_at', 'data de conclusão no futuro rejeitada');

select lives_ok(format($$ select public.update_sale(%L, 'Mensalidade março', 60) $$, tests.id('sale2')),
  'vendedor edita a própria venda pendente');
select throws_ok(format($$ select public.update_sale(%L, 'Alterada', 999) $$, tests.id('sale1')),
  '42501', 'crm:forbidden', 'vendedor não edita venda concluída');
select throws_ok(format($$ select public.cancel_sale(%L, 'erro') $$, tests.id('sale1')),
  '42501', 'crm:forbidden', 'vendedor não cancela venda concluída');
select lives_ok(format($$ select public.complete_sale(%L) $$, tests.id('sale2')), 'vendedor conclui a própria venda pendente');
select lives_ok(format($$ select public.cancel_sale(%L, 'Cliente desistiu') $$, tests.id('sale3')),
  'vendedor cancela a própria venda pendente');

select tests.authenticate_as('s2');
select is((select count(*)::int from public.sales where lead_id = tests.id('lead1')), 0, 'outro vendedor não vê as vendas');

select tests.authenticate_as('adm');
select throws_ok(format($$ select public.cancel_sale(%L, '') $$, tests.id('sale2')),
  'P0001', 'crm:cancel_reason_required', 'cancelamento exige motivo');
select lives_ok(format($$ select public.cancel_sale(%L, 'Estorno') $$, tests.id('sale2')), 'admin cancela venda concluída');
select throws_ok(format($$ select public.update_sale(%L, 'x', 10) $$, tests.id('sale2')),
  'P0001', 'crm:sale_cancelled', 'venda cancelada não é alterada');
select is((select status::text || ':' || (completed_at is not null)::text from public.sales where id = tests.id('sale2')),
  'cancelled:true', 'cancelamento preserva o registro original');
select is((select count(*)::int from public.audit_logs where entity_id = tests.id('sale2')), 4,
  'criação, edição, conclusão e cancelamento auditados');

-- Venda em lead perdido é permitida; ganho não entra no faturamento
select public.mark_lead_lost(tests.id('lead2'), tests.reason_id('V', 'Preço'));
select lives_ok(format($$ select public.create_sale(%L, 'Avulsa', 200, 'completed', null, %L) $$, tests.id('lead2'), tests.uid('s2')),
  'venda registrada em lead perdido');
select public.mark_lead_won(tests.id('lead1'), 5000);

select tests.set_var('summary', public.report_summary(tests.id('V'), now() - interval '1 day', now() + interval '1 day')::text);
select is((tests.var('summary')::jsonb ->> 'revenue')::numeric, 300.00, 'faturamento soma apenas vendas concluídas');
select is((tests.var('summary')::jsonb ->> 'sales_count')::int, 2, 'quantidade de vendas concluídas');
select is((tests.var('summary')::jsonb ->> 'average_ticket')::numeric, 150.00, 'ticket médio');
select is((tests.var('summary')::jsonb ->> 'won_amount')::numeric, 5000.00, 'valor de ganho reportado separadamente');
select is((tests.var('summary')::jsonb ->> 'pending_count')::int, 0, 'nenhuma venda pendente restante');
select is((tests.var('summary')::jsonb ->> 'conversion_rate')::numeric, 0.5, 'conversão: leads criados no período que estão ganhos');
select is((select count(*)::int from public.report_monthly(tests.id('V'), date_trunc('month', now()), date_trunc('month', now()) + interval '2 months')),
  2, 'evolução mensal retorna todos os meses do intervalo');

select tests.authenticate_as('s1');
select is((public.report_summary(tests.id('V'), now() - interval '1 day', now() + interval '1 day', tests.uid('s2')) ->> 'revenue')::numeric,
  100.00, 'vendedor vê apenas o próprio faturamento, mesmo pedindo outro vendedor');

-- ---------------------------------------------------------------------------
-- Tarefas e notificações
-- ---------------------------------------------------------------------------
select throws_ok(format($$ insert into public.tasks (company_id, title, assigned_to, due_at) values (%L, 'x', %L, now()) $$,
  tests.id('V'), tests.uid('s2')),
  '42501', null, 'vendedor não cria tarefa para outro usuário');
insert into public.tasks (company_id, lead_id, title, assigned_to, due_at)
  values (tests.id('V'), tests.id('lead1'), 'Própria', tests.uid('s1'), now() + interval '1 day');

select tests.authenticate_as('adm');
insert into public.tasks (company_id, lead_id, title, assigned_to, due_at)
  values (tests.id('V'), tests.id('lead1'), 'Atrasada', tests.uid('s1'), now() - interval '1 hour');

select tests.as_postgres();
select is(private.generate_overdue_task_notifications(), 1, 'notificação de atraso gerada');
select is(private.generate_overdue_task_notifications(), 0, 'geração de notificações é idempotente');

select tests.authenticate_as('s1');
select is((select count(*)::int from public.notifications where type in ('task_assigned', 'task_overdue')), 2,
  'vendedor recebe atribuição e atraso');
update public.tasks set status = 'done' where title = 'Própria';
select ok((select completed_at is not null and completed_by = tests.uid('s1') from public.tasks where title = 'Própria'),
  'conclusão registra autor e momento');
select tests.authenticate_as('s2');
select is((select count(*)::int from public.notifications where user_id = tests.uid('s1')), 0,
  'notificações de outro usuário são invisíveis');

select * from finish();
rollback;
