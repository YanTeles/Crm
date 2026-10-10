-- Campos personalizados tipados: validação, obrigatoriedade, opções e isolamento.
begin;
select plan(18);

select tests.create_user('adm');
select tests.create_user('vend');
select tests.create_user('outro_adm');
select tests.create_company('adm', 'Campos SA', 'K');
select tests.create_company('outro_adm', 'Outra SA', 'O');
select tests.add_member('K', 'adm', 'vend', 'seller');

select tests.authenticate_as('adm');
insert into public.custom_fields (company_id, label, key, field_type) values
  (tests.id('K'), 'Cargo', 'cargo', 'text'),
  (tests.id('K'), 'Funcionários', 'funcionarios', 'number'),
  (tests.id('K'), 'Aniversário', 'aniversario', 'date'),
  (tests.id('K'), 'Segmento', 'segmento', 'select');
select tests.set_var('f_text', (select id::text from public.custom_fields where key = 'cargo'));
select tests.set_var('f_num', (select id::text from public.custom_fields where key = 'funcionarios'));
select tests.set_var('f_date', (select id::text from public.custom_fields where key = 'aniversario'));
select tests.set_var('f_sel', (select id::text from public.custom_fields where key = 'segmento'));
insert into public.custom_field_options (company_id, field_id, label) values
  (tests.id('K'), tests.id('f_sel'), 'Varejo'), (tests.id('K'), tests.id('f_sel'), 'Indústria');
select tests.set_var('opt_varejo', (select id::text from public.custom_field_options where label = 'Varejo'));
select tests.set_var('opt_ind', (select id::text from public.custom_field_options where label = 'Indústria'));

select tests.set_var('lead', public.create_lead(tests.id('K'), tests.lead_payload('Com campos'),
  jsonb_build_object(tests.var('f_text'), 'Diretor', tests.var('f_num'), 42, tests.var('f_date'), '2020-05-10',
                     tests.var('f_sel'), tests.var('opt_varejo'))) ->> 'lead_id');
select is((select count(*)::int from public.lead_custom_values where lead_id = tests.id('lead')), 4, 'valores tipados gravados');
select is((select value_number from public.lead_custom_values where lead_id = tests.id('lead') and field_id = tests.id('f_num')),
  42.0000::numeric, 'número gravado na coluna numérica');

select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('X'), jsonb_build_object(%L, 'abc')) $$,
  tests.id('K'), tests.var('f_num')), 'P0001', 'crm:custom_field_invalid', 'texto em campo numérico rejeitado');
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('X'), jsonb_build_object(%L, '10/05/2020')) $$,
  tests.id('K'), tests.var('f_date')), 'P0001', 'crm:custom_field_invalid', 'data fora do formato ISO rejeitada');
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('X'), jsonb_build_object(%L, %L)) $$,
  tests.id('K'), tests.var('f_sel'), gen_random_uuid()), 'P0001', 'crm:custom_field_invalid', 'opção inexistente rejeitada');
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('X'), jsonb_build_object(%L, 'x')) $$,
  tests.id('K'), gen_random_uuid()), 'P0001', 'crm:invalid_custom_field', 'campo inexistente rejeitado');

-- Opção desativada não pode ser escolhida em novos valores, mas o valor antigo permanece
update public.custom_field_options set is_active = false where id = tests.id('opt_varejo');
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('X'), jsonb_build_object(%L, %L)) $$,
  tests.id('K'), tests.var('f_sel'), tests.var('opt_varejo')), 'P0001', 'crm:custom_field_invalid', 'opção desativada não é selecionável');
select lives_ok(format($$ select public.update_lead(%L, tests.lead_payload('Com campos'), jsonb_build_object(%L, %L)) $$,
  tests.id('lead'), tests.var('f_sel'), tests.var('opt_varejo')), 'valor antigo com opção desativada é preservado na edição');

-- Integridade estrutural
select throws_ok(format($$ delete from public.custom_field_options where id = %L $$, tests.id('opt_varejo')),
  '23001', null, 'opção em uso não pode ser excluída');
select throws_ok(format($$ update public.custom_fields set field_type = 'text' where id = %L $$, tests.id('f_num')),
  'P0001', 'crm:field_type_locked', 'tipo de campo com valores não pode mudar');
select lives_ok(format($$ delete from public.custom_field_options where id = %L $$, tests.id('opt_ind')),
  'opção sem uso pode ser excluída');

-- Obrigatoriedade: vale para criação e edição, sem invalidar leads antigos
update public.custom_fields set is_required = true where id = tests.id('f_text');
select tests.set_var('lead_old', public.create_lead(tests.id('K'), tests.lead_payload('Antigo'),
  jsonb_build_object(tests.var('f_text'), 'Gerente')) ->> 'lead_id');
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('Sem cargo')) $$, tests.id('K')),
  'P0001', 'crm:custom_field_required', 'campo obrigatório exigido na criação');
select throws_ok(format($$ select public.update_lead(%L, tests.lead_payload('Antigo'), jsonb_build_object(%L, null)) $$,
  tests.id('lead_old'), tests.var('f_text')), 'P0001', 'crm:custom_field_required', 'campo obrigatório exigido na edição');

-- Campo desativado: mantém valor existente, rejeita valor novo
update public.custom_fields set is_active = false where id = tests.id('f_num');
select lives_ok(format($$ select public.update_lead(%L, tests.lead_payload('Com campos'), jsonb_build_object(%L, 'Diretor', %L, 42)) $$,
  tests.id('lead'), tests.var('f_text'), tests.var('f_num')), 'valor inalterado em campo desativado não bloqueia a edição');
select throws_ok(format($$ select public.update_lead(%L, tests.lead_payload('Com campos'), jsonb_build_object(%L, 'Diretor', %L, 43)) $$,
  tests.id('lead'), tests.var('f_text'), tests.var('f_num')), 'P0001', 'crm:custom_field_inactive', 'campo desativado não aceita valor novo');

-- Isolamento
select tests.authenticate_as('vend');
select throws_ok(format($$ insert into public.custom_fields (company_id, label, key, field_type) values (%L, 'X', 'x', 'text') $$, tests.id('K')),
  '42501', null, 'vendedor não cria campos');
select tests.authenticate_as('outro_adm');
select is((select count(*)::int from public.custom_fields where company_id = tests.id('K')), 0, 'outra empresa não vê os campos');
select throws_ok(format($$ insert into public.custom_field_options (company_id, field_id, label) values (%L, %L, 'Invasão') $$,
  tests.id('O'), tests.id('f_sel')), '23503', null, 'opção não pode apontar para campo de outra empresa');

select * from finish();
rollback;
