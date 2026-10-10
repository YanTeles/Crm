-- Rodízio, cadastro, duplicidade, funil (ganho/perda/reabertura), versões e histórico.
begin;
select plan(43);

select tests.create_user('adm');
select tests.create_user('s1');
select tests.create_user('s2');
select tests.create_user('s3');
select tests.create_company('adm', 'Funil Ltda', 'F');
select tests.add_member('F', 'adm', 's1', 'seller');
select tests.add_member('F', 'adm', 's2', 'seller');
select tests.add_member('F', 'adm', 's3', 'seller');

-- ---------------------------------------------------------------------------
-- Rodízio
-- ---------------------------------------------------------------------------
select tests.authenticate_as('adm');
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('X'), '{}', 'auto') $$, tests.id('F')),
  'P0001', 'crm:auto_distribution_disabled', 'rodízio exige distribuição automática habilitada');
select public.update_company_settings(tests.id('F'), 'Funil Ltda', 'funil-ltda', 'America/Sao_Paulo', true);

select is(public.create_lead(tests.id('F'), tests.lead_payload('R1'), '{}', 'auto') ->> 'assigned_to', tests.uid('s1')::text, 'rodízio: 1º vai para s1');
select is(public.create_lead(tests.id('F'), tests.lead_payload('R2'), '{}', 'auto') ->> 'assigned_to', tests.uid('s2')::text, 'rodízio: 2º vai para s2');
select tests.set_var('manual', public.create_lead(tests.id('F'), tests.lead_payload('M1'), '{}', 'manual', tests.uid('s1')) ->> 'lead_id');
select is(public.create_lead(tests.id('F'), tests.lead_payload('R3'), '{}', 'auto') ->> 'assigned_to', tests.uid('s3')::text,
  'atribuição manual não altera a posição do rodízio');
select public.set_member_status(tests.member_id('F', 's1'), 'inactive');
select is(public.create_lead(tests.id('F'), tests.lead_payload('R4'), '{}', 'auto') ->> 'assigned_to', tests.uid('s2')::text,
  'vendedor desativado é ignorado e o ciclo recomeça');
select is(public.create_lead(tests.id('F'), tests.lead_payload('R5'), '{}', 'auto') ->> 'assigned_to', tests.uid('s3')::text,
  'ordem estável após desativação');
select public.set_member_status(tests.member_id('F', 's1'), 'active');
select is(public.create_lead(tests.id('F'), tests.lead_payload('R6'), '{}', 'auto') ->> 'assigned_to', tests.uid('s1')::text,
  'vendedor reativado volta à posição original');
select public.set_member_status(tests.member_id('F', 's1'), 'inactive');
select public.set_member_status(tests.member_id('F', 's2'), 'inactive');
select public.set_member_status(tests.member_id('F', 's3'), 'inactive');
select tests.set_var('no_sellers', public.create_lead(tests.id('F'), tests.lead_payload('R7'), '{}', 'auto')::text);
select ok((tests.var('no_sellers')::jsonb ->> 'assigned_to') is null and (tests.var('no_sellers')::jsonb ->> 'no_active_sellers')::boolean,
  'sem vendedores ativos o lead fica sem responsável e o aviso é retornado');
select public.set_member_status(tests.member_id('F', 's1'), 'active');
select public.set_member_status(tests.member_id('F', 's2'), 'active');
select public.set_member_status(tests.member_id('F', 's3'), 'active');
select ok(exists (select 1 from public.lead_events where event_type = 'assigned' and data ->> 'method' = 'rotation'),
  'atribuição por rodízio registrada no histórico');

-- ---------------------------------------------------------------------------
-- Cadastro: idempotência, vendedor, validações e duplicidade
-- ---------------------------------------------------------------------------
select tests.set_var('req', gen_random_uuid()::text);
select tests.set_var('lead_req', public.create_lead(tests.id('F'), tests.lead_payload('Idem', '+5521988887777'), '{}', 'none', null, tests.id('req')) ->> 'lead_id');
select is(public.create_lead(tests.id('F'), tests.lead_payload('Idem', '+5521988887777'), '{}', 'none', null, tests.id('req')) ->> 'lead_id',
  tests.var('lead_req'), 'reenvio com o mesmo client_request_id não duplica');
select is((select count(*)::int from public.leads where name = 'Idem'), 1, 'apenas um lead criado');
select throws_ok(format($$ select public.create_lead(%L, jsonb_build_object('name', 'X', 'phone_raw', '123', 'phone_normalized', '123')) $$, tests.id('F')),
  'P0001', 'crm:invalid_phone', 'telefone fora do padrão E.164 rejeitado');
select throws_ok(format($$ select public.create_lead(%L, jsonb_build_object('name', '', 'phone_raw', '1', 'phone_normalized', '+5511900000000')) $$, tests.id('F')),
  'P0001', 'crm:invalid_lead_name', 'nome obrigatório');

select tests.authenticate_as('s2');
select tests.set_var('s2_lead', public.create_lead(tests.id('F'), tests.lead_payload('Do Vendedor', '+5521988887777'), '{}', 'auto') ->> 'lead_id');
select is((select assigned_to from public.leads where id = tests.id('s2_lead')), tests.uid('s2'),
  'lead criado por vendedor é atribuído a ele (sem rodízio)');
select is((select created_by from public.leads where id = tests.id('s2_lead')), tests.uid('s2'), 'registra quem cadastrou');
select is((public.find_possible_duplicates(tests.id('F'), '+5521988887777', tests.id('s2_lead')) ->> 'hidden_count')::int, 1,
  'vendedor recebe só a contagem de duplicados de outros');
select is(jsonb_array_length(public.find_possible_duplicates(tests.id('F'), '+5521988887777', tests.id('s2_lead')) -> 'visible'), 0,
  'vendedor não vê dados de leads alheios');
select tests.authenticate_as('adm');
select is(jsonb_array_length(public.find_possible_duplicates(tests.id('F'), '+5521988887777') -> 'visible'), 2,
  'admin vê os possíveis duplicados');

-- ---------------------------------------------------------------------------
-- Funil
-- ---------------------------------------------------------------------------
select tests.authenticate_as('s2');
select throws_ok(format($$ select public.move_lead_stage(%L, %L) $$, tests.id('s2_lead'), tests.stage_id('F', 'Ganho')),
  'P0001', 'crm:use_close_action', 'Ganho/Perdido só por ação de fechamento');
select is(public.move_lead_stage(tests.id('s2_lead'), tests.stage_id('F', 'Negociação'), 1), 2, 'movimentação incrementa versão');
select throws_ok(format($$ select public.move_lead_stage(%L, %L, 1) $$, tests.id('s2_lead'), tests.stage_id('F', 'Em atendimento')),
  '40001', 'crm:version_conflict', 'versão desatualizada gera conflito');
select throws_ok(format($$ select public.mark_lead_won(%L, null) $$, tests.id('s2_lead')),
  'P0001', 'crm:invalid_amount', 'ganho exige valor');
select is(public.mark_lead_won(tests.id('s2_lead'), 0, 2), 3, 'ganho com valor zero permitido');
select is((select outcome::text || ':' || won_amount::text from public.leads where id = tests.id('s2_lead')), 'won:0.00',
  'lead ganho guarda o valor');
select throws_ok(format($$ select public.mark_lead_won(%L, 10) $$, tests.id('s2_lead')),
  'P0001', 'crm:lead_not_open', 'repetir o ganho não gera novo registro');
select is((select count(*)::int from public.lead_events where lead_id = tests.id('s2_lead') and event_type = 'won'), 1,
  'apenas um evento de ganho');
select is((select count(*)::int from public.sales where lead_id = tests.id('s2_lead')), 0, 'ganho não cria venda automaticamente');
select is(public.reopen_lead(tests.id('s2_lead')), 4, 'vendedor responsável reabre');
select is((select outcome::text from public.leads where id = tests.id('s2_lead')), 'open', 'lead reaberto volta a open');
select is((select (data ->> 'previous_outcome') || ':' || amount::text from public.lead_events
           where lead_id = tests.id('s2_lead') and event_type = 'reopened'), 'won:0.00',
  'histórico preserva o fechamento anterior');
select throws_ok(format($$ select public.mark_lead_lost(%L, null) $$, tests.id('s2_lead')),
  'P0001', 'crm:invalid_lost_reason', 'perda exige motivo');
select tests.authenticate_as('adm');
update public.lost_reasons set is_active = false where company_id = tests.id('F') and name = 'Preço';
select tests.authenticate_as('s2');
select throws_ok(format($$ select public.mark_lead_lost(%L, %L) $$, tests.id('s2_lead'), tests.reason_id('F', 'Preço')),
  'P0001', 'crm:invalid_lost_reason', 'motivo desativado não pode ser usado');
select lives_ok(format($$ select public.mark_lead_lost(%L, %L, 'Fechou com outro') $$, tests.id('s2_lead'), tests.reason_id('F', 'Concorrente')),
  'perda com motivo ativo');
select throws_ok(format($$ select public.set_lead_archived(%L, true) $$, tests.id('s2_lead')),
  '42501', 'crm:forbidden', 'vendedor não arquiva leads');

-- Histórico imutável
select tests.as_postgres();
select throws_ok($$ update public.lead_events set data = '{}' $$, '42501', 'crm:immutable_record', 'histórico não pode ser alterado');
select throws_ok($$ delete from public.audit_logs $$, '42501', 'crm:immutable_record', 'auditoria não pode ser excluída');

-- ---------------------------------------------------------------------------
-- Transferência com tarefas (D4) e etapas
-- ---------------------------------------------------------------------------
select tests.authenticate_as('adm');
insert into public.tasks (company_id, lead_id, title, assigned_to, due_at)
  values (tests.id('F'), tests.id('manual'), 'Retornar', tests.uid('s1'), now() + interval '1 day');
select public.assign_lead(tests.id('manual'), tests.uid('s3'));
select is((select assigned_to from public.tasks where lead_id = tests.id('manual')), tests.uid('s3'),
  'tarefas pendentes acompanham a transferência por padrão');
select public.assign_lead(tests.id('manual'), tests.uid('s2'), null, false);
select is((select assigned_to from public.tasks where lead_id = tests.id('manual')), tests.uid('s3'),
  'admin pode optar por não transferir tarefas');

select tests.set_var('stage_x', public.create_stage(tests.id('F'), 'Proposta')::text);
select throws_ok(format($$ select public.create_stage(%L, 'proposta') $$, tests.id('F')),
  'P0001', 'crm:stage_name_taken', 'nome de etapa único (sem diferenciar maiúsculas)');
select public.move_lead_stage(tests.id('manual'), tests.id('stage_x'));
select throws_ok(format($$ select public.archive_stage(%L, null) $$, tests.id('stage_x')),
  'P0001', 'crm:invalid_target_stage', 'etapa com leads exige destino');
select is(public.archive_stage(tests.id('stage_x'), tests.stage_id('F', 'Novo')), 1, 'leads migrados ao arquivar etapa');
select throws_ok(format($$ select public.archive_stage(%L, %L) $$, tests.stage_id('F', 'Novo'), tests.stage_id('F', 'Negociação')),
  'P0001', 'crm:stage_is_default', 'etapa padrão não pode ser arquivada');
select throws_ok(format($$ select public.reorder_stages(%L, array[%L]::uuid[]) $$, tests.id('F'), tests.stage_id('F', 'Novo')),
  'P0001', 'crm:invalid_stage_order', 'reordenação exige todas as etapas abertas');

select * from finish();
rollback;
