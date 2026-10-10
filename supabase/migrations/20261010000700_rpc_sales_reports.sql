-- =============================================================================
-- RPCs: vendas, relatórios, agendamento e permissões de execução
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vendas (independentes do resultado do lead)
-- -----------------------------------------------------------------------------
create function private.validate_sale_amount(p_amount numeric)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999.99 or p_amount <> round(p_amount, 2) then
    perform private.fail('invalid_amount');
  end if;
end;
$$;

create function private.validate_completed_at(p_value timestamptz)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_value is null or p_value > now() + interval '5 minutes' or p_value < '2000-01-01'::timestamptz then
    perform private.fail('invalid_completed_at');
  end if;
end;
$$;

create function public.create_sale(
  p_lead_id uuid,
  p_description text,
  p_amount numeric,
  p_status public.sale_status default 'pending',
  p_completed_at timestamptz default null,
  p_seller_id uuid default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_role public.member_role;
  v_seller uuid;
  v_completed timestamptz;
  v_id uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id for share;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;
  v_role := private.require_member(v_lead.company_id);
  if not private.can_manage_lead(v_lead.company_id, v_lead.assigned_to) then
    perform private.fail('not_found', 'P0002');
  end if;

  if p_client_request_id is not null then
    select id into v_id from public.sales
    where company_id = v_lead.company_id and client_request_id = p_client_request_id;
    if found then
      return v_id;
    end if;
  end if;

  if v_lead.archived_at is not null then
    perform private.fail('lead_archived');
  end if;
  if char_length(btrim(coalesce(p_description, ''))) not between 1 and 500 then
    perform private.fail('invalid_description');
  end if;
  perform private.validate_sale_amount(p_amount);

  if coalesce(p_status, 'pending') = 'cancelled' then
    perform private.fail('invalid_status');
  end if;
  if p_status = 'completed' then
    v_completed := coalesce(p_completed_at, now());
    perform private.validate_completed_at(v_completed);
  end if;

  if v_role = 'seller' then
    v_seller := auth.uid();
  else
    v_seller := coalesce(p_seller_id, v_lead.assigned_to, auth.uid());
    if not exists (select 1 from public.company_members
                   where company_id = v_lead.company_id and user_id = v_seller and status = 'active') then
      perform private.fail('seller_not_active');
    end if;
  end if;

  insert into public.sales (company_id, lead_id, seller_id, description, amount, status, completed_at,
                            created_by, client_request_id)
  values (v_lead.company_id, p_lead_id, v_seller, btrim(p_description), p_amount, coalesce(p_status, 'pending'),
          v_completed, auth.uid(), p_client_request_id)
  returning id into v_id;

  perform private.add_lead_event(v_lead.company_id, p_lead_id, 'sale_created',
    p_sale_id => v_id, p_amount => p_amount,
    p_data => jsonb_build_object('status', coalesce(p_status, 'pending'), 'seller_id', v_seller));
  perform private.log_audit(v_lead.company_id, 'sale.created', 'sale', v_id,
    jsonb_build_object('lead_id', p_lead_id, 'amount', p_amount, 'status', coalesce(p_status, 'pending'),
                       'seller_id', v_seller, 'completed_at', v_completed));
  return v_id;
end;
$$;

-- Trava a venda e aplica a regra D2: admin altera qualquer venda não cancelada;
-- vendedor altera apenas as próprias vendas pendentes de leads atribuídos a ele.
create function private.lock_sale(p_sale_id uuid, p_expected_version integer)
returns public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_role public.member_role;
  v_lead_owner uuid;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    perform private.fail('not_found', 'P0002');
  end if;
  v_role := private.require_member(v_sale.company_id);

  if v_role = 'seller' then
    select assigned_to into v_lead_owner from public.leads where id = v_sale.lead_id;
    if v_sale.seller_id <> auth.uid() and v_lead_owner is distinct from auth.uid() then
      perform private.fail('not_found', 'P0002');
    end if;
    if v_sale.seller_id <> auth.uid() or v_sale.status <> 'pending' then
      perform private.fail('forbidden', '42501');
    end if;
  end if;

  if v_sale.status = 'cancelled' then
    perform private.fail('sale_cancelled');
  end if;
  if p_expected_version is not null and v_sale.row_version <> p_expected_version then
    perform private.fail('version_conflict', '40001');
  end if;
  return v_sale;
end;
$$;

create function public.update_sale(
  p_sale_id uuid,
  p_description text,
  p_amount numeric,
  p_completed_at timestamptz default null,
  p_seller_id uuid default null,
  p_expected_version integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_new public.sales;
  v_role public.member_role;
  v_changes jsonb := '{}'::jsonb;
  v_col text;
begin
  v_sale := private.lock_sale(p_sale_id, p_expected_version);
  v_role := private.member_role(v_sale.company_id);

  if char_length(btrim(coalesce(p_description, ''))) not between 1 and 500 then
    perform private.fail('invalid_description');
  end if;
  perform private.validate_sale_amount(p_amount);

  if p_seller_id is not null and p_seller_id <> v_sale.seller_id then
    if v_role <> 'admin' then
      perform private.fail('forbidden', '42501');
    end if;
    if not exists (select 1 from public.company_members
                   where company_id = v_sale.company_id and user_id = p_seller_id and status = 'active') then
      perform private.fail('seller_not_active');
    end if;
  end if;
  if v_sale.status = 'completed' and p_completed_at is not null then
    perform private.validate_completed_at(p_completed_at);
  end if;

  update public.sales
  set description = btrim(p_description),
      amount = p_amount,
      seller_id = coalesce(p_seller_id, seller_id),
      completed_at = case when status = 'completed' then coalesce(p_completed_at, completed_at) end
  where id = p_sale_id
  returning * into v_new;

  foreach v_col in array array['description', 'amount', 'seller_id', 'completed_at'] loop
    if (to_jsonb(v_sale) -> v_col) is distinct from (to_jsonb(v_new) -> v_col) then
      v_changes := v_changes || jsonb_build_object(v_col,
        jsonb_build_object('from', to_jsonb(v_sale) -> v_col, 'to', to_jsonb(v_new) -> v_col));
    end if;
  end loop;

  if v_changes = '{}'::jsonb then
    return v_sale.row_version;
  end if;

  update public.sales set row_version = row_version + 1 where id = p_sale_id;
  perform private.add_lead_event(v_sale.company_id, v_sale.lead_id, 'sale_updated',
    p_sale_id => p_sale_id, p_amount => v_new.amount, p_data => jsonb_build_object('changes', v_changes));
  perform private.log_audit(v_sale.company_id, 'sale.updated', 'sale', p_sale_id, v_changes);
  return v_sale.row_version + 1;
end;
$$;

create function public.complete_sale(p_sale_id uuid, p_completed_at timestamptz default null, p_expected_version integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_completed timestamptz := coalesce(p_completed_at, now());
begin
  v_sale := private.lock_sale(p_sale_id, p_expected_version);
  if v_sale.status <> 'pending' then
    perform private.fail('sale_not_pending');
  end if;
  perform private.validate_completed_at(v_completed);

  update public.sales set status = 'completed', completed_at = v_completed, row_version = row_version + 1
  where id = p_sale_id;

  perform private.add_lead_event(v_sale.company_id, v_sale.lead_id, 'sale_completed',
    p_sale_id => p_sale_id, p_amount => v_sale.amount, p_data => jsonb_build_object('completed_at', v_completed));
  perform private.log_audit(v_sale.company_id, 'sale.completed', 'sale', p_sale_id,
    jsonb_build_object('completed_at', v_completed, 'amount', v_sale.amount));
  return v_sale.row_version + 1;
end;
$$;

create function public.cancel_sale(p_sale_id uuid, p_reason text, p_expected_version integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  v_sale := private.lock_sale(p_sale_id, p_expected_version);
  if char_length(v_reason) not between 1 and 1000 then
    perform private.fail('cancel_reason_required');
  end if;

  update public.sales
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = v_reason,
      row_version = row_version + 1
  where id = p_sale_id;

  perform private.add_lead_event(v_sale.company_id, v_sale.lead_id, 'sale_cancelled',
    p_sale_id => p_sale_id, p_amount => v_sale.amount,
    p_data => jsonb_build_object('previous_status', v_sale.status, 'reason', v_reason));
  perform private.log_audit(v_sale.company_id, 'sale.cancelled', 'sale', p_sale_id,
    jsonb_build_object('previous_status', v_sale.status, 'amount', v_sale.amount, 'reason', v_reason));
  return v_sale.row_version + 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- Relatórios (SECURITY INVOKER: a RLS do usuário se aplica).
-- Períodos são instantes absolutos [p_from, p_to); agrupamentos mensais usam o
-- fuso da empresa. Vendedor sempre vê apenas os próprios indicadores.
-- -----------------------------------------------------------------------------
create function private.report_scope(p_company_id uuid, p_seller_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.member_role := private.require_member(p_company_id);
begin
  if v_role = 'seller' then
    return auth.uid();
  end if;
  return p_seller_id;
end;
$$;

grant execute on function private.report_scope(uuid, uuid) to authenticated;

create function public.report_summary(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_seller_id uuid default null,
  p_source_id uuid default null,
  p_stage_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_seller uuid := private.report_scope(p_company_id, p_seller_id);
  v_leads bigint;
  v_converted bigint;
  v_sales bigint;
  v_revenue numeric;
  v_won bigint;
  v_won_amount numeric;
  v_lost bigint;
  v_pending bigint;
  v_pending_amount numeric;
begin
  -- Leads criados no período e conversão (D1: criados no período e atualmente ganhos).
  select count(*), count(*) filter (where l.outcome = 'won')
  into v_leads, v_converted
  from public.leads l
  where l.company_id = p_company_id
    and l.created_at >= p_from and l.created_at < p_to
    and (v_seller is null or l.assigned_to = v_seller)
    and (p_source_id is null or l.source_id = p_source_id)
    and (p_stage_id is null or l.stage_id = p_stage_id);

  -- Oportunidades fechadas no período (data de fechamento).
  select count(*) filter (where l.outcome = 'won'),
         coalesce(sum(l.won_amount) filter (where l.outcome = 'won'), 0),
         count(*) filter (where l.outcome = 'lost')
  into v_won, v_won_amount, v_lost
  from public.leads l
  where l.company_id = p_company_id
    and l.closed_at >= p_from and l.closed_at < p_to
    and (v_seller is null or l.assigned_to = v_seller)
    and (p_source_id is null or l.source_id = p_source_id);

  -- Faturamento: somente vendas concluídas, pela data de conclusão.
  select count(*), coalesce(sum(s.amount), 0)
  into v_sales, v_revenue
  from public.sales s
  left join public.leads l on l.id = s.lead_id
  where s.company_id = p_company_id
    and s.status = 'completed'
    and s.completed_at >= p_from and s.completed_at < p_to
    and (v_seller is null or s.seller_id = v_seller)
    and (p_source_id is null or l.source_id = p_source_id);

  -- Vendas pendentes (sem filtro de período): carteira a concluir.
  select count(*), coalesce(sum(s.amount), 0)
  into v_pending, v_pending_amount
  from public.sales s
  where s.company_id = p_company_id
    and s.status = 'pending'
    and (v_seller is null or s.seller_id = v_seller);

  return jsonb_build_object(
    'pending_count', v_pending,
    'pending_amount', v_pending_amount,
    'leads_created', v_leads,
    'leads_converted', v_converted,
    'conversion_rate', case when v_leads > 0 then round(v_converted::numeric / v_leads, 4) else null end,
    'sales_count', v_sales,
    'revenue', v_revenue,
    'average_ticket', case when v_sales > 0 then round(v_revenue / v_sales, 2) else null end,
    'won_count', v_won,
    'won_amount', v_won_amount,
    'lost_count', v_lost
  );
end;
$$;

create function public.report_monthly(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_seller_id uuid default null
)
returns table (month date, revenue numeric, sales_count bigint, leads_created bigint, leads_won bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_seller uuid := private.report_scope(p_company_id, p_seller_id);
  v_tz text;
begin
  select c.timezone into v_tz from public.companies c where c.id = p_company_id;

  return query
  with months as (
    select generate_series(
      date_trunc('month', p_from at time zone v_tz),
      date_trunc('month', (p_to - interval '1 microsecond') at time zone v_tz),
      interval '1 month'
    )::date as m
  ),
  s as (
    select date_trunc('month', x.completed_at at time zone v_tz)::date as m, sum(x.amount) as rev, count(*) as cnt
    from public.sales x
    where x.company_id = p_company_id and x.status = 'completed'
      and x.completed_at >= p_from and x.completed_at < p_to
      and (v_seller is null or x.seller_id = v_seller)
    group by 1
  ),
  lc as (
    select date_trunc('month', x.created_at at time zone v_tz)::date as m, count(*) as cnt
    from public.leads x
    where x.company_id = p_company_id and x.created_at >= p_from and x.created_at < p_to
      and (v_seller is null or x.assigned_to = v_seller)
    group by 1
  ),
  lw as (
    select date_trunc('month', x.won_at at time zone v_tz)::date as m, count(*) as cnt
    from public.leads x
    where x.company_id = p_company_id and x.outcome = 'won' and x.won_at >= p_from and x.won_at < p_to
      and (v_seller is null or x.assigned_to = v_seller)
    group by 1
  )
  select months.m, coalesce(s.rev, 0), coalesce(s.cnt, 0), coalesce(lc.cnt, 0), coalesce(lw.cnt, 0)
  from months
  left join s on s.m = months.m
  left join lc on lc.m = months.m
  left join lw on lw.m = months.m
  order by months.m;
end;
$$;

create function public.report_by_seller(p_company_id uuid, p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, full_name text, member_status public.member_status, revenue numeric,
               sales_count bigint, leads_assigned bigint, leads_won bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_seller uuid := private.report_scope(p_company_id, null);
begin
  return query
  select m.user_id, p.full_name, m.status,
         coalesce((select sum(s.amount) from public.sales s
                   where s.company_id = p_company_id and s.seller_id = m.user_id and s.status = 'completed'
                     and s.completed_at >= p_from and s.completed_at < p_to), 0),
         (select count(*) from public.sales s
          where s.company_id = p_company_id and s.seller_id = m.user_id and s.status = 'completed'
            and s.completed_at >= p_from and s.completed_at < p_to),
         (select count(*) from public.leads l
          where l.company_id = p_company_id and l.assigned_to = m.user_id
            and l.created_at >= p_from and l.created_at < p_to),
         (select count(*) from public.leads l
          where l.company_id = p_company_id and l.assigned_to = m.user_id and l.outcome = 'won'
            and l.won_at >= p_from and l.won_at < p_to)
  from public.company_members m
  join public.profiles p on p.id = m.user_id
  where m.company_id = p_company_id
    and (v_seller is null or m.user_id = v_seller)
  order by 4 desc, 5 desc, p.full_name;
end;
$$;

create function public.report_by_source(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_seller_id uuid default null
)
returns table (source_id uuid, source_name text, leads_created bigint, leads_won bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_seller uuid := private.report_scope(p_company_id, p_seller_id);
begin
  return query
  select l.source_id, coalesce(src.name, 'Sem origem'), count(*), count(*) filter (where l.outcome = 'won')
  from public.leads l
  left join public.lead_sources src on src.id = l.source_id
  where l.company_id = p_company_id and l.created_at >= p_from and l.created_at < p_to
    and (v_seller is null or l.assigned_to = v_seller)
  group by l.source_id, src.name
  order by 3 desc;
end;
$$;

create function public.report_lost_reasons(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_seller_id uuid default null
)
returns table (reason_id uuid, reason_name text, total bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_seller uuid := private.report_scope(p_company_id, p_seller_id);
begin
  return query
  select l.lost_reason_id, r.name, count(*)
  from public.leads l
  join public.lost_reasons r on r.id = l.lost_reason_id
  where l.company_id = p_company_id and l.outcome = 'lost'
    and l.closed_at >= p_from and l.closed_at < p_to
    and (v_seller is null or l.assigned_to = v_seller)
  group by l.lost_reason_id, r.name
  order by 3 desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões de execução: nada para anon/public; RPCs para authenticated.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;

grant execute on function
  public.bootstrap_company(text),
  public.update_company_settings(uuid, text, text, text, boolean),
  public.create_invitation(uuid, text, public.member_role),
  public.revoke_invitation(uuid),
  public.get_invitation(text),
  public.accept_invitation(text),
  public.set_member_role(uuid, public.member_role),
  public.set_member_status(uuid, public.member_status),
  public.count_leads_by_member(uuid),
  public.set_company_status(uuid, public.company_status, text),
  public.platform_overview(text),
  public.create_lead(uuid, jsonb, jsonb, text, uuid, uuid),
  public.update_lead(uuid, jsonb, jsonb, integer),
  public.find_possible_duplicates(uuid, text, uuid),
  public.assign_lead(uuid, uuid, integer, boolean),
  public.transfer_member_leads(uuid, uuid, uuid, boolean),
  public.move_lead_stage(uuid, uuid, integer),
  public.mark_lead_won(uuid, numeric, integer),
  public.mark_lead_lost(uuid, uuid, text, integer),
  public.reopen_lead(uuid, uuid, integer),
  public.set_lead_archived(uuid, boolean, integer),
  public.create_stage(uuid, text),
  public.rename_stage(uuid, text),
  public.reorder_stages(uuid, uuid[]),
  public.set_default_stage(uuid),
  public.archive_stage(uuid, uuid),
  public.create_sale(uuid, text, numeric, public.sale_status, timestamptz, uuid, uuid),
  public.update_sale(uuid, text, numeric, timestamptz, uuid, integer),
  public.complete_sale(uuid, timestamptz, integer),
  public.cancel_sale(uuid, text, integer),
  public.report_summary(uuid, timestamptz, timestamptz, uuid, uuid, uuid),
  public.report_monthly(uuid, timestamptz, timestamptz, uuid),
  public.report_by_seller(uuid, timestamptz, timestamptz),
  public.report_by_source(uuid, timestamptz, timestamptz, uuid),
  public.report_lost_reasons(uuid, timestamptz, timestamptz, uuid)
to authenticated;

-- Funções auxiliares usadas por políticas e relatórios (schema não exposto pela API).
grant execute on function
  private.is_platform_admin(),
  private.active_company_ids(),
  private.admin_company_ids(),
  private.assigned_lead_ids(),
  private.coworker_ids(),
  private.member_role(uuid),
  private.report_scope(uuid, uuid),
  private.require_member(uuid),
  private.fail(text, text, text),
  private.normalize_label(text),
  private.slugify(text)
to authenticated;

-- -----------------------------------------------------------------------------
-- Agendamento (pg_cron): notificações de tarefas vencidas a cada 5 minutos.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'crm-overdue-task-notifications',
      '*/5 * * * *',
      'select private.generate_overdue_task_notifications()'
    );
  end if;
end;
$$;
