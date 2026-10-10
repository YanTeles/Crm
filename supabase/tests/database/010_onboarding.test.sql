-- Cadastro de empresa: confirmação, idempotência, configurações iniciais e slugs.
begin;
select plan(16);

select tests.create_user('alice');
select tests.create_user('bruno', false);
select tests.create_user('carla');
select tests.create_user('diego');

select ok(exists (select 1 from public.profiles where id = tests.uid('alice') and full_name = 'Alice'),
  'perfil criado automaticamente a partir de auth.users');

-- Usuário sem e-mail confirmado não cria empresa
select tests.authenticate_as('bruno');
select throws_ok($$ select * from public.bootstrap_company('Empresa do Bruno') $$,
  '42501', 'crm:email_not_confirmed', 'e-mail não confirmado bloqueia criação da empresa');

-- Anônimo não executa
select tests.as_anon();
select throws_ok($$ select * from public.bootstrap_company('X') $$, '42501', null,
  'anon não executa bootstrap_company');

-- Criação e idempotência
select tests.authenticate_as('alice');
select tests.set_var('alice_company', (select company_id::text from public.bootstrap_company('Minha Empresa')));
select is((select slug from public.bootstrap_company('Outro Nome')), 'minha-empresa',
  'segunda execução devolve a mesma empresa (idempotente)');
select is((select count(*)::int from public.companies), 1, 'admin vê apenas a própria empresa');
select tests.as_postgres();

select is((select count(*)::int from public.companies where created_by = tests.uid('alice')), 1,
  'apenas uma empresa criada para o usuário');
select is((select role::text from public.company_members where company_id = tests.id('alice_company') and user_id = tests.uid('alice')),
  'admin', 'criador vira administrador');
select is((select count(*)::int from public.pipeline_stages where company_id = tests.id('alice_company')), 5,
  'cinco etapas padrão criadas');
select is((select name from public.pipeline_stages where company_id = tests.id('alice_company') and is_default),
  'Novo', 'etapa inicial padrão é Novo');
select is((select count(*)::int from public.pipeline_stages where company_id = tests.id('alice_company') and kind in ('won', 'lost')),
  2, 'uma etapa Ganho e uma Perdido');
select is((select count(*)::int from public.lead_sources where company_id = tests.id('alice_company')), 5,
  'origens padrão criadas');
select is((select count(*)::int from public.lost_reasons where company_id = tests.id('alice_company')), 5,
  'motivos de perda padrão criados');
select ok(exists (select 1 from public.lead_distribution_state where company_id = tests.id('alice_company')),
  'estado do rodízio inicializado');
select ok(exists (select 1 from public.audit_logs where company_id = tests.id('alice_company') and action = 'company.created'),
  'criação auditada');

-- Slugs únicos e reservados
select tests.authenticate_as('carla');
select is((select slug from public.bootstrap_company('Minha  Empresa')), 'minha-empresa-2',
  'slug repetido recebe sufixo');
select tests.authenticate_as('diego');
select is((select slug from public.bootstrap_company('Admin')), 'admin-2', 'slug reservado não é utilizado');

select * from finish();
rollback;
