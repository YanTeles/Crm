-- =============================================================================
-- Autorização: funções auxiliares, RLS e GRANTs
-- Premissa: todo acesso comercial exige membro ATIVO de empresa ATIVA.
-- Papel e status são sempre lidos do banco, nunca de claims do JWT.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções auxiliares (SECURITY DEFINER para evitar recursão de RLS)
-- Usadas nas políticas como `company_id in (select private.x())`, avaliadas uma
-- única vez por consulta.
-- -----------------------------------------------------------------------------
create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

-- Empresas ativas em que o usuário é membro ativo.
create function private.active_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.company_id
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and c.status = 'active'
$$;

-- Empresas ativas em que o usuário é administrador ativo.
create function private.admin_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.company_id
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.role = 'admin'
    and c.status = 'active'
$$;

-- Leads atribuídos ao usuário em empresas onde ele está ativo (escopo do vendedor).
create function private.assigned_lead_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
  from public.leads l
  where l.assigned_to = (select auth.uid())
    and l.company_id in (select private.active_company_ids())
$$;

-- Usuários que compartilham empresa ativa com o usuário atual.
create function private.coworker_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id
  from public.company_members m
  where m.company_id in (select private.active_company_ids())
$$;

-- Papel do usuário na empresa (somente membro ativo de empresa ativa), ou NULL.
create function private.member_role(p_company_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.company_id = p_company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and c.status = 'active'
$$;

-- Exige membro ativo; retorna o papel. Usada no início de todas as RPCs.
create function private.require_member(p_company_id uuid)
returns public.member_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
begin
  if auth.uid() is null then
    perform private.fail('not_authenticated', '42501');
  end if;
  v_role := private.member_role(p_company_id);
  if v_role is null then
    perform private.fail('forbidden', '42501');
  end if;
  return v_role;
end;
$$;

create function private.require_admin(p_company_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.require_member(p_company_id) <> 'admin' then
    perform private.fail('forbidden', '42501');
  end if;
end;
$$;

-- Admin da empresa ou vendedor responsável pelo lead.
create function private.can_manage_lead(p_company_id uuid, p_assigned_to uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.member_role := private.member_role(p_company_id);
begin
  return v_role = 'admin' or (v_role = 'seller' and p_assigned_to = auth.uid());
end;
$$;

grant execute on function
  private.is_platform_admin(),
  private.active_company_ids(),
  private.admin_company_ids(),
  private.assigned_lead_ids(),
  private.coworker_ids(),
  private.member_role(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- RLS habilitada em todas as tabelas
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.reserved_slugs enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invitations enable row level security;
alter table public.lead_distribution_state enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.lead_sources enable row level security;
alter table public.lost_reasons enable row level security;
alter table public.custom_fields enable row level security;
alter table public.custom_field_options enable row level security;
alter table public.leads enable row level security;
alter table public.lead_custom_values enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.lead_events enable row level security;
alter table public.tasks enable row level security;
alter table public.sales enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- -----------------------------------------------------------------------------
-- GRANTs: anon não acessa nada; authenticated recebe o mínimo.
-- Escrita em entidades centrais acontece só por RPC.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  public.profiles, public.platform_admins, public.companies, public.company_members,
  public.company_invitations, public.lead_distribution_state, public.pipeline_stages,
  public.lead_sources, public.lost_reasons, public.custom_fields, public.custom_field_options,
  public.leads, public.lead_custom_values, public.lead_interactions, public.lead_events,
  public.tasks, public.sales, public.notifications, public.audit_logs
to authenticated;

grant update (full_name) on public.profiles to authenticated;

grant insert (company_id, name, is_active, position), update (name, is_active, position), delete
  on public.lead_sources to authenticated;
grant insert (company_id, name, is_active, position), update (name, is_active, position), delete
  on public.lost_reasons to authenticated;
grant insert (company_id, label, key, field_type, is_required, is_active, position),
  update (label, field_type, is_required, is_active, position), delete
  on public.custom_fields to authenticated;
grant insert (company_id, field_id, label, is_active, position), update (label, is_active, position), delete
  on public.custom_field_options to authenticated;

grant insert (company_id, lead_id, kind, channel, content, occurred_at)
  on public.lead_interactions to authenticated;

grant insert (company_id, lead_id, title, description, assigned_to, due_at, status),
  update (lead_id, title, description, assigned_to, due_at, status), delete
  on public.tasks to authenticated;

grant update (read_at, dismissed_at) on public.notifications to authenticated;

-- -----------------------------------------------------------------------------
-- Políticas
-- -----------------------------------------------------------------------------

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select private.coworker_ids()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- platform_admins
create policy platform_admins_select_own on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- companies: membro ativo vê a própria empresa mesmo suspensa (para exibir o aviso).
create policy companies_select on public.companies for select to authenticated
  using (
    id in (
      select m.company_id from public.company_members m
      where m.user_id = (select auth.uid()) and m.status = 'active'
    )
    or (select private.is_platform_admin())
  );

-- company_members
create policy company_members_select on public.company_members for select to authenticated
  using (
    company_id in (select private.active_company_ids())
    or user_id = (select auth.uid())
  );

-- company_invitations / lead_distribution_state: só admins
create policy company_invitations_select on public.company_invitations for select to authenticated
  using (company_id in (select private.admin_company_ids()));
create policy lead_distribution_state_select on public.lead_distribution_state for select to authenticated
  using (company_id in (select private.admin_company_ids()));

-- Configuração: membros leem; admins escrevem (onde houver GRANT).
create policy pipeline_stages_select on public.pipeline_stages for select to authenticated
  using (company_id in (select private.active_company_ids()));

create policy lead_sources_select on public.lead_sources for select to authenticated
  using (company_id in (select private.active_company_ids()));
create policy lead_sources_insert on public.lead_sources for insert to authenticated
  with check (company_id in (select private.admin_company_ids()));
create policy lead_sources_update on public.lead_sources for update to authenticated
  using (company_id in (select private.admin_company_ids()))
  with check (company_id in (select private.admin_company_ids()));
create policy lead_sources_delete on public.lead_sources for delete to authenticated
  using (company_id in (select private.admin_company_ids()));

create policy lost_reasons_select on public.lost_reasons for select to authenticated
  using (company_id in (select private.active_company_ids()));
create policy lost_reasons_insert on public.lost_reasons for insert to authenticated
  with check (company_id in (select private.admin_company_ids()));
create policy lost_reasons_update on public.lost_reasons for update to authenticated
  using (company_id in (select private.admin_company_ids()))
  with check (company_id in (select private.admin_company_ids()));
create policy lost_reasons_delete on public.lost_reasons for delete to authenticated
  using (company_id in (select private.admin_company_ids()));

create policy custom_fields_select on public.custom_fields for select to authenticated
  using (company_id in (select private.active_company_ids()));
create policy custom_fields_insert on public.custom_fields for insert to authenticated
  with check (company_id in (select private.admin_company_ids()));
create policy custom_fields_update on public.custom_fields for update to authenticated
  using (company_id in (select private.admin_company_ids()))
  with check (company_id in (select private.admin_company_ids()));
create policy custom_fields_delete on public.custom_fields for delete to authenticated
  using (company_id in (select private.admin_company_ids()));

create policy custom_field_options_select on public.custom_field_options for select to authenticated
  using (company_id in (select private.active_company_ids()));
create policy custom_field_options_insert on public.custom_field_options for insert to authenticated
  with check (company_id in (select private.admin_company_ids()));
create policy custom_field_options_update on public.custom_field_options for update to authenticated
  using (company_id in (select private.admin_company_ids()))
  with check (company_id in (select private.admin_company_ids()));
create policy custom_field_options_delete on public.custom_field_options for delete to authenticated
  using (company_id in (select private.admin_company_ids()));

-- leads: admin vê todos da empresa; vendedor vê os atribuídos a ele.
create policy leads_select on public.leads for select to authenticated
  using (
    company_id in (select private.admin_company_ids())
    or id in (select private.assigned_lead_ids())
  );

-- Tabelas filhas de lead seguem o mesmo escopo.
create policy lead_custom_values_select on public.lead_custom_values for select to authenticated
  using (
    company_id in (select private.admin_company_ids())
    or lead_id in (select private.assigned_lead_ids())
  );

create policy lead_events_select on public.lead_events for select to authenticated
  using (
    company_id in (select private.admin_company_ids())
    or lead_id in (select private.assigned_lead_ids())
  );

create policy lead_interactions_select on public.lead_interactions for select to authenticated
  using (
    company_id in (select private.admin_company_ids())
    or lead_id in (select private.assigned_lead_ids())
  );
create policy lead_interactions_insert on public.lead_interactions for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      company_id in (select private.admin_company_ids())
      or lead_id in (select private.assigned_lead_ids())
    )
  );

-- tasks
create policy tasks_select on public.tasks for select to authenticated
  using (
    company_id in (select private.admin_company_ids())
    or (
      company_id in (select private.active_company_ids())
      and (assigned_to = (select auth.uid()) or created_by = (select auth.uid()))
    )
  );
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      company_id in (select private.admin_company_ids())
      or (
        company_id in (select private.active_company_ids())
        and assigned_to = (select auth.uid())
        and (lead_id is null or lead_id in (select private.assigned_lead_ids()))
      )
    )
  );
create policy tasks_update on public.tasks for update to authenticated
  using (
    company_id in (select private.admin_company_ids())
    or (company_id in (select private.active_company_ids()) and assigned_to = (select auth.uid()))
  )
  with check (
    company_id in (select private.admin_company_ids())
    or (
      company_id in (select private.active_company_ids())
      and assigned_to = (select auth.uid())
      and (lead_id is null or lead_id in (select private.assigned_lead_ids()))
    )
  );
create policy tasks_delete on public.tasks for delete to authenticated
  using (company_id in (select private.admin_company_ids()));

-- sales: admin vê todas; vendedor vê as próprias e as dos leads atribuídos a ele.
create policy sales_select on public.sales for select to authenticated
  using (
    company_id in (select private.admin_company_ids())
    or (
      company_id in (select private.active_company_ids())
      and (seller_id = (select auth.uid()) or lead_id in (select private.assigned_lead_ids()))
    )
  );

-- notifications: somente do próprio usuário, em empresa onde está ativo.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and company_id in (select private.active_company_ids()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and company_id in (select private.active_company_ids()))
  with check (user_id = (select auth.uid()));

-- audit_logs: admin vê os da empresa; superadmin vê os de plataforma e de status de empresa.
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (
    company_id in (select private.admin_company_ids())
    or (
      (select private.is_platform_admin())
      and (company_id is null or action like 'company.%')
    )
  );
