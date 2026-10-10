-- =============================================================================
-- RPCs: onboarding, empresa, equipe, convites e plataforma
-- Todas SECURITY DEFINER com search_path vazio e checagem explícita de
-- autorização no início.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Onboarding: cria empresa + admin + configurações iniciais (idempotente)
-- -----------------------------------------------------------------------------
create function public.bootstrap_company(p_name text)
returns table (company_id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_confirmed timestamptz;
  v_company uuid;
  v_slug text;
  v_base text;
  v_name text := btrim(coalesce(p_name, ''));
  v_attempt integer := 1;
begin
  if v_uid is null then
    perform private.fail('not_authenticated', '42501');
  end if;

  select u.email_confirmed_at into v_confirmed from auth.users u where u.id = v_uid;
  if v_confirmed is null then
    perform private.fail('email_not_confirmed', '42501');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bootstrap:' || v_uid::text, 0));

  select c.id, c.slug::text into v_company, v_slug from public.companies c where c.created_by = v_uid;
  if found then
    return query select v_company, v_slug;
    return;
  end if;

  if char_length(v_name) not between 2 and 120 then
    perform private.fail('invalid_company_name');
  end if;

  v_base := left(private.slugify(v_name), 40);
  v_base := btrim(v_base, '-');
  if char_length(v_base) < 3 then
    v_base := 'empresa';
  end if;

  loop
    v_slug := case when v_attempt = 1 then v_base else v_base || '-' || v_attempt end;
    if not exists (select 1 from public.reserved_slugs r where r.slug = v_slug)
       and not exists (select 1 from public.companies c where c.slug = v_slug) then
      begin
        insert into public.companies (name, slug, created_by)
        values (v_name, v_slug, v_uid)
        returning id into v_company;
        exit;
      exception when unique_violation then
        -- slug tomado em paralelo: tenta o próximo
        null;
      end;
    end if;
    v_attempt := v_attempt + 1;
    if v_attempt > 200 then
      perform private.fail('slug_unavailable');
    end if;
  end loop;

  insert into public.company_members (company_id, user_id, role) values (v_company, v_uid, 'admin');

  insert into public.pipeline_stages (company_id, name, kind, position, is_default) values
    (v_company, 'Novo', 'open', 1, true),
    (v_company, 'Em atendimento', 'open', 2, false),
    (v_company, 'Negociação', 'open', 3, false),
    (v_company, 'Ganho', 'won', 1000, false),
    (v_company, 'Perdido', 'lost', 1001, false);

  insert into public.lead_sources (company_id, name, position) values
    (v_company, 'Indicação', 1), (v_company, 'Site', 2), (v_company, 'Redes sociais', 3),
    (v_company, 'WhatsApp', 4), (v_company, 'Outro', 5);

  insert into public.lost_reasons (company_id, name, position) values
    (v_company, 'Preço', 1), (v_company, 'Sem interesse', 2), (v_company, 'Concorrente', 3),
    (v_company, 'Sem retorno', 4), (v_company, 'Outro', 5);

  insert into public.lead_distribution_state (company_id) values (v_company);

  perform private.log_audit(v_company, 'company.created', 'company', v_company,
    jsonb_build_object('name', v_name, 'slug', v_slug), 'admin');

  return query select v_company, v_slug;
end;
$$;

-- -----------------------------------------------------------------------------
-- Configurações da empresa
-- -----------------------------------------------------------------------------
create function public.update_company_settings(
  p_company_id uuid,
  p_name text,
  p_slug text,
  p_timezone text,
  p_auto_distribution boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.companies;
  v_new public.companies;
  v_changes jsonb := '{}'::jsonb;
begin
  perform private.require_admin(p_company_id);

  select * into v_old from public.companies where id = p_company_id for update;

  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    perform private.fail('invalid_company_name');
  end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$' then
    perform private.fail('invalid_slug');
  end if;
  if exists (select 1 from public.companies where slug = p_slug and id <> p_company_id) then
    perform private.fail('slug_taken');
  end if;

  update public.companies
  set name = btrim(p_name),
      slug = p_slug,
      timezone = p_timezone,
      auto_distribution_enabled = coalesce(p_auto_distribution, false)
  where id = p_company_id
  returning * into v_new;

  if v_old.name is distinct from v_new.name then
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', v_old.name, 'to', v_new.name));
  end if;
  if v_old.slug is distinct from v_new.slug then
    v_changes := v_changes || jsonb_build_object('slug', jsonb_build_object('from', v_old.slug, 'to', v_new.slug));
  end if;
  if v_old.timezone is distinct from v_new.timezone then
    v_changes := v_changes || jsonb_build_object('timezone', jsonb_build_object('from', v_old.timezone, 'to', v_new.timezone));
  end if;
  if v_old.auto_distribution_enabled is distinct from v_new.auto_distribution_enabled then
    v_changes := v_changes || jsonb_build_object('auto_distribution_enabled',
      jsonb_build_object('from', v_old.auto_distribution_enabled, 'to', v_new.auto_distribution_enabled));
  end if;

  if v_changes <> '{}'::jsonb then
    perform private.log_audit(p_company_id, 'company.settings_updated', 'company', p_company_id, v_changes);
  end if;

  return v_new.slug::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- Convites
-- -----------------------------------------------------------------------------
create function public.create_invitation(p_company_id uuid, p_email text, p_role public.member_role default 'seller')
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  perform private.require_admin(p_company_id);

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    perform private.fail('invalid_email');
  end if;

  if exists (
    select 1 from public.company_members m join public.profiles p on p.id = m.user_id
    where m.company_id = p_company_id and p.email = v_email::extensions.citext
  ) then
    perform private.fail('already_member');
  end if;

  update public.company_invitations
  set revoked_at = now(), revoked_by = auth.uid()
  where company_id = p_company_id and email = v_email::extensions.citext
    and accepted_at is null and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.company_invitations (company_id, email, role, token_hash, invited_by, expires_at)
  values (p_company_id, v_email, coalesce(p_role, 'seller'),
          extensions.digest(v_token, 'sha256'), auth.uid(), v_expires)
  returning id into v_id;

  perform private.log_audit(p_company_id, 'invitation.created', 'invitation', v_id,
    jsonb_build_object('email', v_email, 'role', coalesce(p_role, 'seller')));

  return query select v_id, v_token, v_expires;
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.company_invitations;
begin
  select * into v_inv from public.company_invitations where id = p_invitation_id for update;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;
  perform private.require_admin(v_inv.company_id);
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null then
    perform private.fail('invitation_not_pending');
  end if;

  update public.company_invitations set revoked_at = now(), revoked_by = auth.uid() where id = p_invitation_id;
  perform private.log_audit(v_inv.company_id, 'invitation.revoked', 'invitation', p_invitation_id,
    jsonb_build_object('email', v_inv.email));
end;
$$;

-- Dados públicos mínimos do convite (para a tela de aceite). Não revela o e-mail.
create function public.get_invitation(p_token text)
returns table (company_name text, role public.member_role, expires_at timestamptz, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    perform private.fail('not_authenticated', '42501');
  end if;
  return query
  select c.name,
         i.role,
         i.expires_at,
         case
           when i.accepted_at is not null then 'accepted'
           when i.revoked_at is not null then 'revoked'
           when i.expires_at < now() then 'expired'
           when c.status <> 'active' then 'company_suspended'
           else 'pending'
         end
  from public.company_invitations i
  join public.companies c on c.id = i.company_id
  where i.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256');
end;
$$;

create function public.accept_invitation(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.company_invitations;
  v_user_email text;
  v_confirmed timestamptz;
  v_slug text;
begin
  if v_uid is null then
    perform private.fail('not_authenticated', '42501');
  end if;

  select * into v_inv from public.company_invitations
  where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
  for update;

  if not found or v_inv.revoked_at is not null then
    perform private.fail('invitation_invalid');
  end if;
  if v_inv.accepted_at is not null then
    perform private.fail('invitation_used');
  end if;
  if v_inv.expires_at < now() then
    perform private.fail('invitation_expired');
  end if;

  select u.email, u.email_confirmed_at into v_user_email, v_confirmed from auth.users u where u.id = v_uid;
  if v_confirmed is null then
    perform private.fail('email_not_confirmed', '42501');
  end if;
  if lower(v_user_email) <> lower(v_inv.email::text) then
    perform private.fail('invitation_email_mismatch', '42501');
  end if;

  select c.slug::text into v_slug from public.companies c where c.id = v_inv.company_id and c.status = 'active';
  if v_slug is null then
    perform private.fail('company_suspended', '42501');
  end if;

  if exists (select 1 from public.company_members where company_id = v_inv.company_id and user_id = v_uid) then
    perform private.fail('already_member');
  end if;

  insert into public.company_members (company_id, user_id, role) values (v_inv.company_id, v_uid, v_inv.role);
  update public.company_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;

  perform private.log_audit(v_inv.company_id, 'invitation.accepted', 'invitation', v_inv.id,
    jsonb_build_object('user_id', v_uid, 'role', v_inv.role), v_inv.role::text);

  return v_slug;
end;
$$;

-- -----------------------------------------------------------------------------
-- Membros: papel e status
-- -----------------------------------------------------------------------------
create function public.set_member_role(p_member_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.company_members;
begin
  select * into v_member from public.company_members where id = p_member_id;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;
  perform private.require_admin(v_member.company_id);

  -- Serializa alterações de equipe da empresa (evita remover o último admin em corrida).
  perform 1 from public.companies where id = v_member.company_id for update;
  select * into v_member from public.company_members where id = p_member_id for update;

  if v_member.role = p_role then
    return;
  end if;

  if v_member.role = 'admin' and v_member.status = 'active' and not exists (
    select 1 from public.company_members
    where company_id = v_member.company_id and role = 'admin' and status = 'active' and id <> p_member_id
  ) then
    perform private.fail('last_admin');
  end if;

  -- D13: vendedor só é promovido depois de redistribuir seus leads.
  if p_role = 'admin' and exists (
    select 1 from public.leads where company_id = v_member.company_id and assigned_to = v_member.user_id
  ) then
    perform private.fail('member_has_leads');
  end if;

  update public.company_members set role = p_role where id = p_member_id;

  perform private.log_audit(v_member.company_id, 'member.role_changed', 'member', p_member_id,
    jsonb_build_object('user_id', v_member.user_id, 'from', v_member.role, 'to', p_role));
end;
$$;

create function public.set_member_status(p_member_id uuid, p_status public.member_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.company_members;
begin
  select * into v_member from public.company_members where id = p_member_id;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;
  perform private.require_admin(v_member.company_id);

  perform 1 from public.companies where id = v_member.company_id for update;
  select * into v_member from public.company_members where id = p_member_id for update;

  if v_member.status = p_status then
    return;
  end if;

  if p_status = 'inactive' then
    if v_member.user_id = auth.uid() then
      perform private.fail('cannot_deactivate_self');
    end if;
    if v_member.role = 'admin' and not exists (
      select 1 from public.company_members
      where company_id = v_member.company_id and role = 'admin' and status = 'active' and id <> p_member_id
    ) then
      perform private.fail('last_admin');
    end if;
    update public.company_members
    set status = 'inactive', deactivated_at = now(), deactivated_by = auth.uid()
    where id = p_member_id;
  else
    update public.company_members
    set status = 'active', deactivated_at = null, deactivated_by = null
    where id = p_member_id;
  end if;

  perform private.log_audit(v_member.company_id,
    case when p_status = 'inactive' then 'member.deactivated' else 'member.activated' end,
    'member', p_member_id, jsonb_build_object('user_id', v_member.user_id));
end;
$$;

-- Quantidade de leads por membro (inclui desativados), para a tela de equipe.
create function public.count_leads_by_member(p_company_id uuid)
returns table (user_id uuid, total bigint, open_total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin(p_company_id);
  return query
  select l.assigned_to, count(*), count(*) filter (where l.outcome = 'open' and l.archived_at is null)
  from public.leads l
  where l.company_id = p_company_id and l.assigned_to is not null
  group by l.assigned_to;
end;
$$;

-- -----------------------------------------------------------------------------
-- Plataforma (superadministrador)
-- -----------------------------------------------------------------------------
create function public.set_company_status(p_company_id uuid, p_status public.company_status, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.company_status;
begin
  if not private.is_platform_admin() then
    perform private.fail('forbidden', '42501');
  end if;

  select status into v_old from public.companies where id = p_company_id for update;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;
  if v_old = p_status then
    return;
  end if;

  if p_status = 'suspended' then
    update public.companies
    set status = 'suspended', suspended_at = now(), suspended_reason = left(btrim(p_reason), 500)
    where id = p_company_id;
  else
    update public.companies
    set status = 'active', suspended_at = null, suspended_reason = null
    where id = p_company_id;
  end if;

  perform private.log_audit(p_company_id,
    case when p_status = 'suspended' then 'company.suspended' else 'company.reactivated' end,
    'company', p_company_id, jsonb_build_object('reason', p_reason), 'platform_admin');
end;
$$;

-- Indicadores operacionais agregados (D8): sem nomes de leads, valores ou faturamento.
create function public.platform_overview(p_search text default null)
returns table (
  company_id uuid, name text, slug text, status public.company_status,
  suspended_reason text, created_at timestamptz, active_members bigint, leads_total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    perform private.fail('forbidden', '42501');
  end if;
  return query
  select c.id, c.name, c.slug::text, c.status, c.suspended_reason, c.created_at,
         (select count(*) from public.company_members m where m.company_id = c.id and m.status = 'active'),
         (select count(*) from public.leads l where l.company_id = c.id)
  from public.companies c
  where p_search is null
     or private.normalize_label(c.name) like '%' || private.normalize_label(p_search) || '%'
     or c.slug::text like '%' || lower(p_search) || '%'
  order by c.created_at desc
  limit 500;
end;
$$;
