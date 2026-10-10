-- =============================================================================
-- RPCs: leads, campos personalizados, distribuição e funil
-- Transições comerciais travam o lead (FOR UPDATE), conferem row_version e
-- registram o histórico na mesma transação.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auxiliares internos
-- -----------------------------------------------------------------------------

-- Trava o lead e confere versão/arquivamento/permissão. Retorna a linha.
create function private.lock_lead(p_lead_id uuid, p_expected_version integer, p_admin_only boolean default false)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_role public.member_role;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;

  v_role := private.require_member(v_lead.company_id);
  if p_admin_only and v_role <> 'admin' then
    perform private.fail('forbidden', '42501');
  end if;
  if not private.can_manage_lead(v_lead.company_id, v_lead.assigned_to) then
    -- Não revela a existência do lead para quem não tem acesso.
    perform private.fail('not_found', 'P0002');
  end if;
  if p_expected_version is not null and v_lead.row_version <> p_expected_version then
    perform private.fail('version_conflict', '40001');
  end if;
  return v_lead;
end;
$$;

-- Vendedor ativo da empresa (destino válido de atribuição).
create function private.is_active_seller(p_company_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = p_user_id and role = 'seller' and status = 'active'
  )
$$;

-- Rodízio: escolhe o próximo vendedor ativo, de forma atômica por empresa.
create function private.next_rotation_seller(p_company_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.lead_distribution_state;
  v_user uuid;
  v_seq bigint;
begin
  -- Serializa distribuições simultâneas da mesma empresa.
  select * into v_state from public.lead_distribution_state where company_id = p_company_id for update;
  if not found then
    insert into public.lead_distribution_state (company_id) values (p_company_id)
    on conflict (company_id) do nothing;
    select * into v_state from public.lead_distribution_state where company_id = p_company_id for update;
  end if;

  select m.user_id, m.distribution_seq into v_user, v_seq
  from public.company_members m
  where m.company_id = p_company_id and m.role = 'seller' and m.status = 'active'
    and m.distribution_seq > coalesce(v_state.last_member_seq, 0)
  order by m.distribution_seq
  limit 1;

  if v_user is null then
    select m.user_id, m.distribution_seq into v_user, v_seq
    from public.company_members m
    where m.company_id = p_company_id and m.role = 'seller' and m.status = 'active'
    order by m.distribution_seq
    limit 1;
  end if;

  if v_user is not null then
    update public.lead_distribution_state
    set last_member_seq = v_seq, last_assigned_to = v_user
    where company_id = p_company_id;
  end if;

  return v_user;
end;
$$;

-- Valida e grava valores de campos personalizados. Formato de p_values:
-- { "<field_id>": valor | null }. Retorna o diff aplicado.
create function private.apply_custom_values(
  p_company_id uuid,
  p_lead_id uuid,
  p_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_field public.custom_fields;
  v_field_id uuid;
  v_text text;
  v_number numeric;
  v_date date;
  v_option uuid;
  v_old public.lead_custom_values;
  v_diff jsonb := '{}'::jsonb;
  v_missing uuid;
begin
  if p_values is not null and jsonb_typeof(p_values) <> 'object' then
    perform private.fail('invalid_custom_values');
  end if;

  for v_key, v_value in select * from jsonb_each(coalesce(p_values, '{}'::jsonb)) loop
    begin
      v_field_id := v_key::uuid;
    exception when others then
      perform private.fail('invalid_custom_field');
    end;

    select * into v_field from public.custom_fields where id = v_field_id and company_id = p_company_id;
    if not found then
      perform private.fail('invalid_custom_field');
    end if;

    select * into v_old from public.lead_custom_values where lead_id = p_lead_id and field_id = v_field_id;

    v_text := null; v_number := null; v_date := null; v_option := null;

    if v_value is null or jsonb_typeof(v_value) = 'null'
       or (jsonb_typeof(v_value) = 'string' and btrim(v_value #>> '{}') = '') then
      if v_old.lead_id is not null then
        delete from public.lead_custom_values where lead_id = p_lead_id and field_id = v_field_id;
        v_diff := v_diff || jsonb_build_object(v_field.key, jsonb_build_object('from', to_jsonb(v_old), 'to', null));
      end if;
      continue;
    end if;

    begin
      case v_field.field_type
        when 'text' then
          v_text := btrim(v_value #>> '{}');
          if char_length(v_text) > 2000 then
            perform private.fail('custom_field_invalid', 'P0001', v_field.id::text);
          end if;
        when 'number' then
          v_number := (v_value #>> '{}')::numeric;
        when 'date' then
          if (v_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
            perform private.fail('custom_field_invalid', 'P0001', v_field.id::text);
          end if;
          v_date := (v_value #>> '{}')::date;
        when 'select' then
          v_option := (v_value #>> '{}')::uuid;
      end case;
    exception
      when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow
        or invalid_datetime_format then
        perform private.fail('custom_field_invalid', 'P0001', v_field.id::text);
    end;

    if v_field.field_type = 'select' and v_option is distinct from v_old.option_id then
      if not exists (
        select 1 from public.custom_field_options
        where id = v_option and field_id = v_field.id and company_id = p_company_id and is_active
      ) then
        perform private.fail('custom_field_invalid', 'P0001', v_field.id::text);
      end if;
    end if;

    if v_old.lead_id is not null
       and v_old.value_text is not distinct from v_text
       and v_old.value_number is not distinct from v_number
       and v_old.value_date is not distinct from v_date
       and v_old.option_id is not distinct from v_option then
      continue;
    end if;

    -- Campo desativado mantém o valor existente, mas não aceita valor novo.
    if not v_field.is_active then
      perform private.fail('custom_field_inactive', 'P0001', v_field.id::text);
    end if;

    insert into public.lead_custom_values (
      company_id, lead_id, field_id, field_type, value_text, value_number, value_date, option_id, updated_by
    ) values (
      p_company_id, p_lead_id, v_field.id, v_field.field_type, v_text, v_number, v_date, v_option, auth.uid()
    )
    on conflict (lead_id, field_id) do update
    set value_text = excluded.value_text,
        value_number = excluded.value_number,
        value_date = excluded.value_date,
        option_id = excluded.option_id,
        updated_by = excluded.updated_by;

    v_diff := v_diff || jsonb_build_object(v_field.key, jsonb_build_object(
      'from', case when v_old.lead_id is null then null
                   else coalesce(to_jsonb(v_old.value_text), to_jsonb(v_old.value_number),
                                 to_jsonb(v_old.value_date), to_jsonb(v_old.option_id)) end,
      'to', coalesce(to_jsonb(v_text), to_jsonb(v_number), to_jsonb(v_date), to_jsonb(v_option))
    ));
  end loop;

  -- Campos obrigatórios ativos precisam ter valor ao criar/editar o lead.
  select f.id into v_missing
  from public.custom_fields f
  where f.company_id = p_company_id and f.is_active and f.is_required
    and not exists (select 1 from public.lead_custom_values v where v.lead_id = p_lead_id and v.field_id = f.id)
  order by f.position
  limit 1;
  if v_missing is not null then
    perform private.fail('custom_field_required', 'P0001', v_missing::text);
  end if;

  return v_diff;
end;
$$;

-- Valida os campos padrão do lead vindos do formulário.
create function private.validate_lead_payload(p_company_id uuid, p_data jsonb, p_current_source uuid default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source uuid;
begin
  if char_length(btrim(coalesce(p_data ->> 'name', ''))) not between 1 and 200 then
    perform private.fail('invalid_lead_name');
  end if;
  if char_length(btrim(coalesce(p_data ->> 'phone_raw', ''))) not between 1 and 40
     or coalesce(p_data ->> 'phone_normalized', '') !~ '^\+[1-9][0-9]{7,14}$' then
    perform private.fail('invalid_phone');
  end if;
  if nullif(btrim(p_data ->> 'email'), '') is not null
     and (p_data ->> 'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.fail('invalid_email');
  end if;
  v_source := nullif(p_data ->> 'source_id', '')::uuid;
  if v_source is not null and v_source is distinct from p_current_source and not exists (
    select 1 from public.lead_sources where id = v_source and company_id = p_company_id and is_active
  ) then
    perform private.fail('invalid_source');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cadastro de lead (com rodízio atômico quando aplicável)
-- p_assignment_mode: 'auto' | 'manual' | 'none' (ignorado para vendedor)
-- -----------------------------------------------------------------------------
create function public.create_lead(
  p_company_id uuid,
  p_data jsonb,
  p_custom_values jsonb default '{}'::jsonb,
  p_assignment_mode text default 'none',
  p_assignee uuid default null,
  p_client_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
  v_existing public.leads;
  v_stage uuid;
  v_assignee uuid;
  v_method text;
  v_no_sellers boolean := false;
  v_lead_id uuid;
  v_auto boolean;
begin
  v_role := private.require_member(p_company_id);

  if p_client_request_id is not null then
    select * into v_existing from public.leads
    where company_id = p_company_id and client_request_id = p_client_request_id;
    if found then
      return jsonb_build_object('lead_id', v_existing.id, 'assigned_to', v_existing.assigned_to,
                                'method', null, 'no_active_sellers', false, 'replayed', true);
    end if;
  end if;

  perform private.validate_lead_payload(p_company_id, p_data);

  select id into v_stage from public.pipeline_stages
  where company_id = p_company_id and is_default and archived_at is null;
  if v_stage is null then
    perform private.fail('no_default_stage');
  end if;

  if v_role = 'seller' then
    v_assignee := auth.uid();
    v_method := 'self';
  elsif p_assignment_mode = 'auto' then
    select auto_distribution_enabled into v_auto from public.companies where id = p_company_id;
    if not v_auto then
      perform private.fail('auto_distribution_disabled');
    end if;
    v_assignee := private.next_rotation_seller(p_company_id);
    v_method := 'rotation';
    v_no_sellers := v_assignee is null;
  elsif p_assignment_mode = 'manual' then
    if p_assignee is null or not private.is_active_seller(p_company_id, p_assignee) then
      perform private.fail('assignee_not_active_seller');
    end if;
    v_assignee := p_assignee;
    v_method := 'manual';
  elsif p_assignment_mode = 'none' or p_assignment_mode is null then
    v_assignee := null;
    v_method := 'none';
  else
    perform private.fail('invalid_assignment_mode');
  end if;

  insert into public.leads (
    company_id, name, phone_raw, phone_normalized, email, customer_company, source_id, notes,
    assigned_to, stage_id, outcome, created_by, client_request_id
  ) values (
    p_company_id,
    btrim(p_data ->> 'name'),
    btrim(p_data ->> 'phone_raw'),
    p_data ->> 'phone_normalized',
    nullif(btrim(p_data ->> 'email'), ''),
    nullif(btrim(p_data ->> 'customer_company'), ''),
    nullif(p_data ->> 'source_id', '')::uuid,
    nullif(btrim(p_data ->> 'notes'), ''),
    v_assignee, v_stage, 'open', auth.uid(), p_client_request_id
  )
  returning id into v_lead_id;

  perform private.apply_custom_values(p_company_id, v_lead_id, p_custom_values);

  perform private.add_lead_event(p_company_id, v_lead_id, 'created',
    p_to_stage_id => v_stage, p_data => jsonb_build_object('method', v_method));

  if v_assignee is not null then
    perform private.add_lead_event(p_company_id, v_lead_id, 'assigned',
      p_to_assignee => v_assignee, p_data => jsonb_build_object('method', v_method));
    perform private.notify(p_company_id, v_assignee, 'lead_assigned', 'lead', v_lead_id,
      'lead_assigned:' || v_lead_id || ':' || v_assignee || ':' || extract(epoch from clock_timestamp())::text,
      jsonb_build_object('lead_name', btrim(p_data ->> 'name')));
  end if;

  return jsonb_build_object('lead_id', v_lead_id, 'assigned_to', v_assignee, 'method', v_method,
                            'no_active_sellers', v_no_sellers, 'replayed', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Edição de lead (dados + campos personalizados)
-- -----------------------------------------------------------------------------
create function public.update_lead(
  p_lead_id uuid,
  p_data jsonb,
  p_custom_values jsonb default '{}'::jsonb,
  p_expected_version integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_new public.leads;
  v_changes jsonb := '{}'::jsonb;
  v_custom_diff jsonb;
  v_col text;
begin
  v_lead := private.lock_lead(p_lead_id, p_expected_version);
  if v_lead.archived_at is not null then
    perform private.fail('lead_archived');
  end if;

  perform private.validate_lead_payload(v_lead.company_id, p_data, v_lead.source_id);

  update public.leads
  set name = btrim(p_data ->> 'name'),
      phone_raw = btrim(p_data ->> 'phone_raw'),
      phone_normalized = p_data ->> 'phone_normalized',
      email = nullif(btrim(p_data ->> 'email'), ''),
      customer_company = nullif(btrim(p_data ->> 'customer_company'), ''),
      source_id = nullif(p_data ->> 'source_id', '')::uuid,
      notes = nullif(btrim(p_data ->> 'notes'), '')
  where id = p_lead_id
  returning * into v_new;

  foreach v_col in array array['name', 'phone_raw', 'phone_normalized', 'email', 'customer_company', 'source_id', 'notes'] loop
    if (to_jsonb(v_lead) -> v_col) is distinct from (to_jsonb(v_new) -> v_col) then
      v_changes := v_changes || jsonb_build_object(v_col,
        jsonb_build_object('from', to_jsonb(v_lead) -> v_col, 'to', to_jsonb(v_new) -> v_col));
    end if;
  end loop;

  v_custom_diff := private.apply_custom_values(v_lead.company_id, p_lead_id, p_custom_values);

  if v_changes = '{}'::jsonb and v_custom_diff = '{}'::jsonb then
    return v_lead.row_version;
  end if;

  if v_changes <> '{}'::jsonb then
    perform private.add_lead_event(v_lead.company_id, p_lead_id, 'updated',
      p_data => jsonb_build_object('changes', v_changes));
  end if;
  if v_custom_diff <> '{}'::jsonb then
    perform private.add_lead_event(v_lead.company_id, p_lead_id, 'custom_fields_updated',
      p_data => jsonb_build_object('changes', v_custom_diff));
  end if;

  update public.leads set row_version = row_version + 1 where id = p_lead_id
  returning row_version into v_new.row_version;
  return v_new.row_version;
end;
$$;

-- -----------------------------------------------------------------------------
-- Duplicidade por telefone (aviso). Vendedor só vê detalhes dos próprios leads.
-- -----------------------------------------------------------------------------
create function public.find_possible_duplicates(
  p_company_id uuid,
  p_phone_normalized text,
  p_exclude_lead_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
  v_visible jsonb;
  v_hidden integer;
begin
  v_role := private.require_member(p_company_id);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'name', l.name, 'outcome', l.outcome, 'archived', l.archived_at is not null,
           'assigned_to', l.assigned_to, 'assigned_name', p.full_name, 'created_at', l.created_at)
           order by l.created_at desc), '[]'::jsonb)
  into v_visible
  from public.leads l
  left join public.profiles p on p.id = l.assigned_to
  where l.company_id = p_company_id
    and l.phone_normalized = p_phone_normalized
    and l.id is distinct from p_exclude_lead_id
    and (v_role = 'admin' or l.assigned_to = auth.uid());

  if v_role = 'admin' then
    v_hidden := 0;
  else
    select count(*) into v_hidden from public.leads l
    where l.company_id = p_company_id
      and l.phone_normalized = p_phone_normalized
      and l.id is distinct from p_exclude_lead_id
      and l.assigned_to is distinct from auth.uid();
  end if;

  return jsonb_build_object('visible', v_visible, 'hidden_count', v_hidden);
end;
$$;

-- -----------------------------------------------------------------------------
-- Atribuição / transferência (somente admin; não altera o rodízio)
-- -----------------------------------------------------------------------------
create function public.assign_lead(
  p_lead_id uuid,
  p_assignee uuid,
  p_expected_version integer default null,
  p_transfer_tasks boolean default true
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_tasks integer := 0;
begin
  v_lead := private.lock_lead(p_lead_id, p_expected_version, true);
  if v_lead.archived_at is not null then
    perform private.fail('lead_archived');
  end if;
  if p_assignee is not null and not private.is_active_seller(v_lead.company_id, p_assignee) then
    perform private.fail('assignee_not_active_seller');
  end if;
  if v_lead.assigned_to is not distinct from p_assignee then
    return v_lead.row_version;
  end if;

  update public.leads set assigned_to = p_assignee, row_version = row_version + 1 where id = p_lead_id;

  if p_transfer_tasks and v_lead.assigned_to is not null and p_assignee is not null then
    update public.tasks
    set assigned_to = p_assignee
    where lead_id = p_lead_id and status = 'pending' and assigned_to = v_lead.assigned_to;
    get diagnostics v_tasks = row_count;
  end if;

  perform private.add_lead_event(v_lead.company_id, p_lead_id, 'assigned',
    p_from_assignee => v_lead.assigned_to, p_to_assignee => p_assignee,
    p_data => jsonb_build_object('method', 'manual', 'tasks_transferred', v_tasks));

  perform private.notify(v_lead.company_id, p_assignee, 'lead_assigned', 'lead', p_lead_id,
    'lead_assigned:' || p_lead_id || ':' || coalesce(p_assignee::text, '') || ':' || extract(epoch from clock_timestamp())::text,
    jsonb_build_object('lead_name', v_lead.name));

  return v_lead.row_version + 1;
end;
$$;

-- Transfere todos os leads de um membro (ex.: vendedor desativado).
create function public.transfer_member_leads(
  p_company_id uuid,
  p_from_user uuid,
  p_to_user uuid,
  p_transfer_tasks boolean default true
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_count integer := 0;
  v_tasks integer;
  v_batch text := gen_random_uuid()::text;
begin
  perform private.require_admin(p_company_id);
  if p_to_user is not null and not private.is_active_seller(p_company_id, p_to_user) then
    perform private.fail('assignee_not_active_seller');
  end if;
  if p_from_user is not distinct from p_to_user then
    return 0;
  end if;

  for v_lead in
    select * from public.leads
    where company_id = p_company_id and assigned_to = p_from_user
    order by created_at
    for update
  loop
    update public.leads set assigned_to = p_to_user, row_version = row_version + 1 where id = v_lead.id;
    v_tasks := 0;
    if p_transfer_tasks and p_to_user is not null then
      update public.tasks set assigned_to = p_to_user
      where lead_id = v_lead.id and status = 'pending' and assigned_to = p_from_user;
      get diagnostics v_tasks = row_count;
    end if;
    perform private.add_lead_event(p_company_id, v_lead.id, 'assigned',
      p_from_assignee => p_from_user, p_to_assignee => p_to_user,
      p_data => jsonb_build_object('method', 'bulk_transfer', 'batch', v_batch, 'tasks_transferred', v_tasks));
    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    perform private.notify(p_company_id, p_to_user, 'lead_assigned', 'member', p_from_user,
      'bulk_transfer:' || v_batch, jsonb_build_object('count', v_count));
    perform private.log_audit(p_company_id, 'lead.bulk_transfer', 'member', p_from_user,
      jsonb_build_object('to_user', p_to_user, 'count', v_count, 'batch', v_batch));
  end if;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Funil: movimentação, ganho, perda, reabertura e arquivamento
-- -----------------------------------------------------------------------------
create function public.move_lead_stage(p_lead_id uuid, p_to_stage_id uuid, p_expected_version integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_stage public.pipeline_stages;
begin
  v_lead := private.lock_lead(p_lead_id, p_expected_version);
  if v_lead.archived_at is not null then
    perform private.fail('lead_archived');
  end if;
  if v_lead.outcome <> 'open' then
    perform private.fail('lead_not_open');
  end if;

  select * into v_stage from public.pipeline_stages where id = p_to_stage_id and company_id = v_lead.company_id;
  if not found or v_stage.archived_at is not null then
    perform private.fail('invalid_stage');
  end if;
  if v_stage.kind <> 'open' then
    perform private.fail('use_close_action');
  end if;
  if v_stage.id = v_lead.stage_id then
    return v_lead.row_version;
  end if;

  update public.leads set stage_id = p_to_stage_id, row_version = row_version + 1 where id = p_lead_id;
  perform private.add_lead_event(v_lead.company_id, p_lead_id, 'stage_changed',
    p_from_stage_id => v_lead.stage_id, p_to_stage_id => p_to_stage_id);
  return v_lead.row_version + 1;
end;
$$;

create function public.mark_lead_won(p_lead_id uuid, p_amount numeric, p_expected_version integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_stage uuid;
  v_now timestamptz := now();
begin
  v_lead := private.lock_lead(p_lead_id, p_expected_version);
  if v_lead.archived_at is not null then
    perform private.fail('lead_archived');
  end if;
  if v_lead.outcome <> 'open' then
    perform private.fail('lead_not_open');
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 999999999999.99 or p_amount <> round(p_amount, 2) then
    perform private.fail('invalid_amount');
  end if;

  select id into v_stage from public.pipeline_stages where company_id = v_lead.company_id and kind = 'won';

  update public.leads
  set stage_id = v_stage, outcome = 'won', won_amount = p_amount, won_at = v_now, closed_at = v_now,
      row_version = row_version + 1
  where id = p_lead_id;

  perform private.add_lead_event(v_lead.company_id, p_lead_id, 'won',
    p_from_stage_id => v_lead.stage_id, p_to_stage_id => v_stage, p_amount => p_amount);
  return v_lead.row_version + 1;
end;
$$;

create function public.mark_lead_lost(
  p_lead_id uuid,
  p_reason_id uuid,
  p_note text default null,
  p_expected_version integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_stage uuid;
  v_note text := nullif(btrim(p_note), '');
begin
  v_lead := private.lock_lead(p_lead_id, p_expected_version);
  if v_lead.archived_at is not null then
    perform private.fail('lead_archived');
  end if;
  if v_lead.outcome <> 'open' then
    perform private.fail('lead_not_open');
  end if;
  if p_reason_id is null or not exists (
    select 1 from public.lost_reasons where id = p_reason_id and company_id = v_lead.company_id and is_active
  ) then
    perform private.fail('invalid_lost_reason');
  end if;
  if char_length(v_note) > 1000 then
    perform private.fail('note_too_long');
  end if;

  select id into v_stage from public.pipeline_stages where company_id = v_lead.company_id and kind = 'lost';

  update public.leads
  set stage_id = v_stage, outcome = 'lost', lost_reason_id = p_reason_id, lost_note = v_note,
      closed_at = now(), row_version = row_version + 1
  where id = p_lead_id;

  perform private.add_lead_event(v_lead.company_id, p_lead_id, 'lost',
    p_from_stage_id => v_lead.stage_id, p_to_stage_id => v_stage, p_lost_reason_id => p_reason_id,
    p_data => jsonb_build_object('note', v_note));
  return v_lead.row_version + 1;
end;
$$;

create function public.reopen_lead(p_lead_id uuid, p_to_stage_id uuid default null, p_expected_version integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_stage public.pipeline_stages;
begin
  v_lead := private.lock_lead(p_lead_id, p_expected_version);
  if v_lead.archived_at is not null then
    perform private.fail('lead_archived');
  end if;
  if v_lead.outcome = 'open' then
    perform private.fail('lead_already_open');
  end if;

  if p_to_stage_id is null then
    select * into v_stage from public.pipeline_stages
    where company_id = v_lead.company_id and is_default and archived_at is null;
  else
    select * into v_stage from public.pipeline_stages
    where id = p_to_stage_id and company_id = v_lead.company_id and kind = 'open' and archived_at is null;
  end if;
  if v_stage.id is null then
    perform private.fail('invalid_stage');
  end if;

  update public.leads
  set stage_id = v_stage.id, outcome = 'open', won_amount = null, won_at = null,
      lost_reason_id = null, lost_note = null, closed_at = null, row_version = row_version + 1
  where id = p_lead_id;

  perform private.add_lead_event(v_lead.company_id, p_lead_id, 'reopened',
    p_from_stage_id => v_lead.stage_id, p_to_stage_id => v_stage.id,
    p_lost_reason_id => v_lead.lost_reason_id, p_amount => v_lead.won_amount,
    p_data => jsonb_build_object(
      'previous_outcome', v_lead.outcome, 'won_at', v_lead.won_at, 'lost_note', v_lead.lost_note,
      'closed_at', v_lead.closed_at));
  return v_lead.row_version + 1;
end;
$$;

create function public.set_lead_archived(p_lead_id uuid, p_archived boolean, p_expected_version integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  v_lead := private.lock_lead(p_lead_id, p_expected_version, true);
  if (v_lead.archived_at is not null) = p_archived then
    return v_lead.row_version;
  end if;

  update public.leads
  set archived_at = case when p_archived then now() end,
      archived_by = case when p_archived then auth.uid() end,
      row_version = row_version + 1
  where id = p_lead_id;

  perform private.add_lead_event(v_lead.company_id, p_lead_id,
    case when p_archived then 'archived'::public.lead_event_type else 'unarchived'::public.lead_event_type end);
  return v_lead.row_version + 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- Etapas do funil (admin)
-- -----------------------------------------------------------------------------
create function public.create_stage(p_company_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_pos integer;
begin
  perform private.require_admin(p_company_id);
  perform 1 from public.companies where id = p_company_id for update;

  if (select count(*) from public.pipeline_stages
      where company_id = p_company_id and kind = 'open' and archived_at is null) >= 20 then
    perform private.fail('limit_reached', 'P0001', 'pipeline_stages');
  end if;
  if exists (select 1 from public.pipeline_stages
             where company_id = p_company_id and archived_at is null
               and name_key = private.normalize_label(p_name)) then
    perform private.fail('stage_name_taken');
  end if;

  select coalesce(max(position), 0) + 1 into v_pos from public.pipeline_stages
  where company_id = p_company_id and kind = 'open' and archived_at is null;

  insert into public.pipeline_stages (company_id, name, kind, position)
  values (p_company_id, btrim(p_name), 'open', v_pos)
  returning id into v_id;

  perform private.log_audit(p_company_id, 'stage.created', 'stage', v_id, jsonb_build_object('name', btrim(p_name)));
  return v_id;
end;
$$;

create function public.rename_stage(p_stage_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.pipeline_stages;
begin
  select * into v_stage from public.pipeline_stages where id = p_stage_id;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;
  perform private.require_admin(v_stage.company_id);
  if v_stage.archived_at is not null then
    perform private.fail('invalid_stage');
  end if;
  if exists (select 1 from public.pipeline_stages
             where company_id = v_stage.company_id and archived_at is null and id <> p_stage_id
               and name_key = private.normalize_label(p_name)) then
    perform private.fail('stage_name_taken');
  end if;

  update public.pipeline_stages set name = btrim(p_name) where id = p_stage_id;
  perform private.log_audit(v_stage.company_id, 'stage.renamed', 'stage', p_stage_id,
    jsonb_build_object('from', v_stage.name, 'to', btrim(p_name)));
end;
$$;

-- Recebe todas as etapas abertas ativas na nova ordem.
create function public.reorder_stages(p_company_id uuid, p_stage_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected uuid[];
begin
  perform private.require_admin(p_company_id);
  perform 1 from public.companies where id = p_company_id for update;

  select array_agg(id order by id) into v_expected from public.pipeline_stages
  where company_id = p_company_id and kind = 'open' and archived_at is null;

  if v_expected is distinct from (select array_agg(x order by x) from unnest(p_stage_ids) x)
     or cardinality(p_stage_ids) <> (select count(distinct x) from unnest(p_stage_ids) x) then
    perform private.fail('invalid_stage_order');
  end if;

  update public.pipeline_stages s
  set position = o.ord
  from unnest(p_stage_ids) with ordinality as o(id, ord)
  where s.id = o.id and s.company_id = p_company_id;

  perform private.log_audit(p_company_id, 'stage.reordered', 'company', p_company_id,
    jsonb_build_object('order', to_jsonb(p_stage_ids)));
end;
$$;

create function public.set_default_stage(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.pipeline_stages;
begin
  select * into v_stage from public.pipeline_stages where id = p_stage_id;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;
  perform private.require_admin(v_stage.company_id);
  if v_stage.kind <> 'open' or v_stage.archived_at is not null then
    perform private.fail('invalid_stage');
  end if;

  update public.pipeline_stages set is_default = false where company_id = v_stage.company_id and is_default;
  update public.pipeline_stages set is_default = true where id = p_stage_id;
  perform private.log_audit(v_stage.company_id, 'stage.default_changed', 'stage', p_stage_id, '{}'::jsonb);
end;
$$;

-- "Excluir" etapa: move os leads para a etapa de destino e arquiva.
create function public.archive_stage(p_stage_id uuid, p_target_stage_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.pipeline_stages;
  v_target public.pipeline_stages;
  v_lead record;
  v_count integer := 0;
begin
  select * into v_stage from public.pipeline_stages where id = p_stage_id for update;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;
  perform private.require_admin(v_stage.company_id);

  if v_stage.kind <> 'open' or v_stage.archived_at is not null then
    perform private.fail('invalid_stage');
  end if;
  if v_stage.is_default then
    perform private.fail('stage_is_default');
  end if;

  select * into v_target from public.pipeline_stages
  where id = p_target_stage_id and company_id = v_stage.company_id;
  if exists (select 1 from public.leads where stage_id = p_stage_id) and (
    v_target.id is null or v_target.kind <> 'open' or v_target.archived_at is not null or v_target.id = p_stage_id
  ) then
    perform private.fail('invalid_target_stage');
  end if;

  for v_lead in select id from public.leads where stage_id = p_stage_id for update loop
    update public.leads set stage_id = v_target.id, row_version = row_version + 1 where id = v_lead.id;
    perform private.add_lead_event(v_stage.company_id, v_lead.id, 'stage_changed',
      p_from_stage_id => p_stage_id, p_to_stage_id => v_target.id,
      p_data => jsonb_build_object('method', 'stage_archived'));
    v_count := v_count + 1;
  end loop;

  update public.pipeline_stages set archived_at = now() where id = p_stage_id;
  perform private.log_audit(v_stage.company_id, 'stage.archived', 'stage', p_stage_id,
    jsonb_build_object('name', v_stage.name, 'target_stage_id', v_target.id, 'leads_moved', v_count));
  return v_count;
end;
$$;
