-- =============================================================================
-- Triggers e funções internas: perfis, updated_at, imutabilidade, auditoria,
-- histórico de leads, notificações, limites e validações.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções internas de escrita (chamadas apenas por RPCs/triggers)
-- -----------------------------------------------------------------------------
create function private.log_audit(
  p_company_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_data jsonb default '{}'::jsonb,
  p_actor_role text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := p_actor_role;
begin
  if v_role is null then
    if v_uid is null then
      v_role := 'system';
    else
      select m.role::text into v_role
      from public.company_members m
      where m.company_id = p_company_id and m.user_id = v_uid;
      v_role := coalesce(v_role, 'user');
    end if;
  end if;

  insert into public.audit_logs (company_id, actor_id, actor_role, action, entity_type, entity_id, data)
  values (p_company_id, v_uid, v_role, p_action, p_entity_type, p_entity_id, coalesce(p_data, '{}'::jsonb));
end;
$$;

create function private.add_lead_event(
  p_company_id uuid,
  p_lead_id uuid,
  p_event_type public.lead_event_type,
  p_from_stage_id uuid default null,
  p_to_stage_id uuid default null,
  p_from_assignee uuid default null,
  p_to_assignee uuid default null,
  p_lost_reason_id uuid default null,
  p_sale_id uuid default null,
  p_amount numeric default null,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_events (
    company_id, lead_id, event_type, actor_id, from_stage_id, to_stage_id,
    from_assignee, to_assignee, lost_reason_id, sale_id, amount, data
  ) values (
    p_company_id, p_lead_id, p_event_type, auth.uid(), p_from_stage_id, p_to_stage_id,
    p_from_assignee, p_to_assignee, p_lost_reason_id, p_sale_id, p_amount, coalesce(p_data, '{}'::jsonb)
  );
end;
$$;

-- Cria notificação idempotente. Não notifica o próprio autor da ação.
create function private.notify(
  p_company_id uuid,
  p_user_id uuid,
  p_type public.notification_type,
  p_entity_type text,
  p_entity_id uuid,
  p_dedupe_key text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_user_id is not distinct from auth.uid() then
    return;
  end if;
  insert into public.notifications (company_id, user_id, type, entity_type, entity_id, dedupe_key, data)
  values (p_company_id, p_user_id, p_type, p_entity_type, p_entity_id, p_dedupe_key, coalesce(p_data, '{}'::jsonb))
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfis sincronizados com auth.users
-- -----------------------------------------------------------------------------
create function private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120);
begin
  if v_name = '' then
    v_name := left(split_part(coalesce(new.email, 'usuario'), '@', 1), 120);
  end if;
  insert into public.profiles (id, full_name, email)
  values (new.id, v_name, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_auth_user_created();

create function private.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function private.handle_auth_user_updated();

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.companies
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.company_members
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.lead_distribution_state
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.pipeline_stages
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.lead_sources
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.lost_reasons
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.custom_fields
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.custom_field_options
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.leads
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.lead_custom_values
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.sales
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Histórico e auditoria imutáveis
-- -----------------------------------------------------------------------------
create trigger lead_events_immutable before update or delete on public.lead_events
  for each row execute function private.prevent_mutation();
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.prevent_mutation();
create trigger lead_events_no_truncate before truncate on public.lead_events
  for each statement execute function private.prevent_mutation();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.prevent_mutation();

-- -----------------------------------------------------------------------------
-- Empresas: fuso válido e slug não reservado
-- -----------------------------------------------------------------------------
create function private.validate_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    perform private.fail('invalid_timezone');
  end if;
  if exists (select 1 from public.reserved_slugs where slug = new.slug) then
    perform private.fail('slug_reserved');
  end if;
  return new;
end;
$$;

create trigger validate_company before insert or update of slug, timezone on public.companies
  for each row execute function private.validate_company();

-- -----------------------------------------------------------------------------
-- Pelo menos um administrador ativo por empresa (defesa em profundidade;
-- as RPCs também travam a empresa para evitar corrida).
-- -----------------------------------------------------------------------------
create function private.ensure_active_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.company_members
    where company_id = new.company_id and role = 'admin' and status = 'active'
  ) then
    perform private.fail('last_admin');
  end if;
  return null;
end;
$$;

create constraint trigger ensure_active_admin
  after update of role, status on public.company_members
  deferrable initially deferred
  for each row execute function private.ensure_active_admin();

-- -----------------------------------------------------------------------------
-- Etapas: tipo imutável; Ganho/Perdido/padrão não podem ser arquivadas
-- -----------------------------------------------------------------------------
create function private.protect_stage_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> old.kind then
    perform private.fail('stage_kind_immutable');
  end if;
  return new;
end;
$$;

create trigger protect_stage_kind before update of kind on public.pipeline_stages
  for each row execute function private.protect_stage_kind();

-- -----------------------------------------------------------------------------
-- Limites por empresa (D9)
-- -----------------------------------------------------------------------------
create function private.enforce_config_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_limit integer;
begin
  if tg_table_name = 'lead_sources' then
    select count(*) into v_count from public.lead_sources where company_id = new.company_id;
    v_limit := 100;
  elsif tg_table_name = 'lost_reasons' then
    select count(*) into v_count from public.lost_reasons where company_id = new.company_id;
    v_limit := 100;
  elsif tg_table_name = 'custom_fields' then
    select count(*) into v_count from public.custom_fields where company_id = new.company_id;
    v_limit := 50;
  elsif tg_table_name = 'custom_field_options' then
    select count(*) into v_count from public.custom_field_options where field_id = new.field_id;
    v_limit := 100;
  end if;
  if v_count >= v_limit then
    perform private.fail('limit_reached', 'P0001', tg_table_name);
  end if;
  return new;
end;
$$;

create trigger enforce_limits before insert on public.lead_sources
  for each row execute function private.enforce_config_limits();
create trigger enforce_limits before insert on public.lost_reasons
  for each row execute function private.enforce_config_limits();
create trigger enforce_limits before insert on public.custom_fields
  for each row execute function private.enforce_config_limits();
create trigger enforce_limits before insert on public.custom_field_options
  for each row execute function private.enforce_config_limits();

-- -----------------------------------------------------------------------------
-- Campos personalizados: tipo travado quando já há valores ou opções
-- -----------------------------------------------------------------------------
create function private.protect_custom_field_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.field_type <> old.field_type and (
    exists (select 1 from public.lead_custom_values where field_id = old.id)
    or exists (select 1 from public.custom_field_options where field_id = old.id)
  ) then
    perform private.fail('field_type_locked');
  end if;
  return new;
end;
$$;

create trigger protect_custom_field_type before update of field_type on public.custom_fields
  for each row execute function private.protect_custom_field_type();

-- -----------------------------------------------------------------------------
-- Auditoria das tabelas de configuração com escrita direta
-- -----------------------------------------------------------------------------
create function private.audit_config_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_company uuid;
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;
  v_company := (v_row ->> 'company_id')::uuid;
  v_id := (v_row ->> 'id')::uuid;

  perform private.log_audit(
    v_company,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_id,
    case tg_op
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old))
    end
  );
  return null;
end;
$$;

create trigger audit_change after insert or update or delete on public.lead_sources
  for each row execute function private.audit_config_change();
create trigger audit_change after insert or update or delete on public.lost_reasons
  for each row execute function private.audit_config_change();
create trigger audit_change after insert or update or delete on public.custom_fields
  for each row execute function private.audit_config_change();
create trigger audit_change after insert or update or delete on public.custom_field_options
  for each row execute function private.audit_config_change();

-- -----------------------------------------------------------------------------
-- Tarefas: responsável ativo, conclusão coerente e notificação
-- -----------------------------------------------------------------------------
create function private.before_task_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Chamadas da API: exige vínculo ativo antes de qualquer validação (não vaza dados).
  if auth.uid() is not null and private.member_role(new.company_id) is null then
    perform private.fail('forbidden', '42501');
  end if;

  if tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to then
    if not exists (
      select 1 from public.company_members
      where company_id = new.company_id and user_id = new.assigned_to and status = 'active'
    ) then
      perform private.fail('assignee_not_active');
    end if;
  end if;

  if new.lead_id is not null and (tg_op = 'INSERT' or new.lead_id is distinct from old.lead_id) then
    if exists (select 1 from public.leads where id = new.lead_id and archived_at is not null) then
      perform private.fail('lead_archived');
    end if;
  end if;

  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
    new.completed_by := auth.uid();
  elsif new.status = 'pending' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;

create trigger before_task_write before insert or update on public.tasks
  for each row execute function private.before_task_write();

create function private.after_task_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to then
    perform private.notify(
      new.company_id, new.assigned_to, 'task_assigned', 'task', new.id,
      'task_assigned:' || new.id || ':' || new.assigned_to,
      jsonb_build_object('title', new.title, 'due_at', new.due_at, 'lead_id', new.lead_id)
    );
  end if;
  return null;
end;
$$;

create trigger after_task_write after insert or update of assigned_to on public.tasks
  for each row execute function private.after_task_write();

-- Notificações de vencimento (executado pelo pg_cron; idempotente).
create function private.generate_overdue_task_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (company_id, user_id, type, entity_type, entity_id, dedupe_key, data)
  select t.company_id, t.assigned_to, 'task_overdue', 'task', t.id,
         'task_overdue:' || t.id || ':' || extract(epoch from t.due_at)::bigint,
         jsonb_build_object('title', t.title, 'due_at', t.due_at, 'lead_id', t.lead_id)
  from public.tasks t
  join public.company_members m on m.company_id = t.company_id and m.user_id = t.assigned_to
  join public.companies c on c.id = t.company_id
  where t.status = 'pending'
    and t.due_at < now()
    and t.due_at > now() - interval '30 days'
    and m.status = 'active'
    and c.status = 'active'
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Notificações em tempo real (somente quando a publicação do Realtime existe).
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
