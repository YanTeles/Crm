-- Convites, papéis, último admin, desativação e suspensão de empresa.
begin;
select plan(30);

select tests.create_user('adm');
select tests.create_user('vend');
select tests.create_user('vend2');
select tests.create_user('outro');
select tests.create_user('root');
select tests.create_company('adm', 'Equipe SA', 'C');

-- ---------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------
select tests.authenticate_as('adm');
select tests.set_var('token', (select token from public.create_invitation(tests.id('C'), 'vend@test.local')));
select throws_ok(format($$ select * from public.create_invitation(%L, 'adm@test.local') $$, tests.id('C')),
  'P0001', 'crm:already_member', 'não convida quem já é membro');
select throws_ok(format($$ select * from public.create_invitation(%L, 'invalido') $$, tests.id('C')),
  'P0001', 'crm:invalid_email', 'e-mail inválido rejeitado');
select is((select count(*)::int from public.company_invitations where token_hash is not null), 1,
  'convite registrado (somente hash do token)');

select tests.authenticate_as('outro');
select throws_ok(format($$ select public.accept_invitation(%L) $$, tests.var('token')),
  '42501', 'crm:invitation_email_mismatch', 'convite não pode ser usado por outro e-mail');
select throws_ok($$ select public.accept_invitation('token-invalido') $$,
  'P0001', 'crm:invitation_invalid', 'token inexistente rejeitado');
select is((select status from public.get_invitation(tests.var('token'))), 'pending', 'status do convite consultável');

select tests.authenticate_as('vend');
select is(public.accept_invitation(tests.var('token')), 'equipe-sa', 'convidado aceita e recebe o slug');
select throws_ok(format($$ select public.accept_invitation(%L) $$, tests.var('token')),
  'P0001', 'crm:invitation_used', 'token é de uso único');
select is((select role::text from public.company_members where company_id = tests.id('C') and user_id = tests.uid('vend')),
  'seller', 'convidado entra como vendedor');

-- Convite expirado e revogado
select tests.authenticate_as('adm');
select tests.set_var('token2', (select token from public.create_invitation(tests.id('C'), 'vend2@test.local')));
select tests.as_postgres();
update public.company_invitations set expires_at = now() - interval '1 minute' where email = 'vend2@test.local';
select tests.authenticate_as('vend2');
select throws_ok(format($$ select public.accept_invitation(%L) $$, tests.var('token2')),
  'P0001', 'crm:invitation_expired', 'convite expirado rejeitado');
select tests.authenticate_as('adm');
select public.revoke_invitation((select id from public.company_invitations where email = 'vend2@test.local' and accepted_at is null));
select tests.authenticate_as('vend2');
select throws_ok(format($$ select public.accept_invitation(%L) $$, tests.var('token2')),
  'P0001', 'crm:invitation_invalid', 'convite revogado rejeitado');

-- Vendedor não convida
select tests.authenticate_as('vend');
select throws_ok(format($$ select * from public.create_invitation(%L, 'x@test.local') $$, tests.id('C')),
  '42501', 'crm:forbidden', 'vendedor não convida');

-- ---------------------------------------------------------------------------
-- Último administrador e promoção (D13)
-- ---------------------------------------------------------------------------
select tests.authenticate_as('adm');
select throws_ok(format($$ select public.set_member_role(%L, 'seller') $$, tests.member_id('C', 'adm')),
  'P0001', 'crm:last_admin', 'último admin não pode ser rebaixado');
select throws_ok(format($$ select public.set_member_status(%L, 'inactive') $$, tests.member_id('C', 'adm')),
  'P0001', 'crm:cannot_deactivate_self', 'admin não desativa a si mesmo');

select tests.set_var('lead1', public.create_lead(tests.id('C'), tests.lead_payload('Cliente 1'), '{}', 'manual', tests.uid('vend')) ->> 'lead_id');
select throws_ok(format($$ select public.set_member_role(%L, 'admin') $$, tests.member_id('C', 'vend')),
  'P0001', 'crm:member_has_leads', 'promoção exige redistribuir leads antes');
select is(public.transfer_member_leads(tests.id('C'), tests.uid('vend'), null), 1, 'leads redistribuídos (sem responsável)');
select lives_ok(format($$ select public.set_member_role(%L, 'admin') $$, tests.member_id('C', 'vend')),
  'promoção permitida após redistribuição');
select lives_ok(format($$ select public.set_member_role(%L, 'seller') $$, tests.member_id('C', 'adm')),
  'com outro admin ativo, rebaixar é permitido');
select tests.authenticate_as('vend');
select lives_ok(format($$ select public.set_member_role(%L, 'admin') $$, tests.member_id('C', 'adm')),
  'novo admin devolve o papel');
select lives_ok(format($$ select public.set_member_role(%L, 'seller') $$, tests.member_id('C', 'vend')),
  'admin pode se rebaixar quando há outro admin');
select tests.authenticate_as('adm');
select is((select count(*)::int from public.audit_logs where action = 'member.role_changed'), 4,
  'mudanças de papel auditadas (visíveis ao admin)');

-- ---------------------------------------------------------------------------
-- Desativação bloqueia acesso imediatamente
-- ---------------------------------------------------------------------------
select public.assign_lead(tests.id('lead1'), tests.uid('vend'));
select public.set_member_status(tests.member_id('C', 'vend'), 'inactive');
select is((select open_total::int from public.count_leads_by_member(tests.id('C')) where user_id = tests.uid('vend')), 1,
  'admin vê quantos leads o desativado mantém');
select tests.authenticate_as('vend');
select is((select count(*)::int from public.leads), 0, 'desativado não vê leads');
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('X')) $$, tests.id('C')),
  '42501', 'crm:forbidden', 'desativado não cria leads');
select tests.authenticate_as('adm');
select throws_ok(format($$ select public.assign_lead(%L, %L) $$, tests.id('lead1'), tests.uid('adm')),
  'P0001', 'crm:assignee_not_active_seller', 'admin não recebe leads (somente vendedores ativos)');

-- ---------------------------------------------------------------------------
-- Suspensão de empresa (superadmin)
-- ---------------------------------------------------------------------------
select throws_ok(format($$ select public.set_company_status(%L, 'suspended') $$, tests.id('C')),
  '42501', 'crm:forbidden', 'admin de empresa não suspende empresas');
select tests.as_postgres();
insert into public.platform_admins (user_id) values (tests.uid('root'));
select tests.authenticate_as('root');
select public.set_company_status(tests.id('C'), 'suspended', 'Teste');
select is((select count(*)::int from public.leads), 0, 'superadmin não acessa leads das empresas');
select tests.authenticate_as('adm');
select is((select status::text from public.companies where id = tests.id('C')), 'suspended',
  'admin vê o status de suspensão');
select is((select count(*)::int from public.leads), 0, 'empresa suspensa não expõe dados comerciais');
select throws_ok(format($$ select public.create_lead(%L, tests.lead_payload('X')) $$, tests.id('C')),
  '42501', 'crm:forbidden', 'empresa suspensa não opera');

select * from finish();
rollback;
