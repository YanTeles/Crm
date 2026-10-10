-- =============================================================================
-- Tabelas, chaves, restrições de integridade e índices
-- Regra geral: toda tabela comercial tem company_id e as filhas usam FK composta
-- (company_id, x_id) para impedir vínculos entre empresas diferentes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Plataforma e identidade
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email extensions.citext not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles (id) on delete restrict,
  note text
);

create table public.reserved_slugs (
  slug extensions.citext primary key
);

insert into public.reserved_slugs (slug) values
  ('app'), ('admin'), ('api'), ('auth'), ('login'), ('entrar'), ('logout'), ('sair'),
  ('cadastro'), ('signup'), ('convite'), ('invite'), ('onboarding'), ('novo'), ('new'),
  ('configuracoes'), ('settings'), ('suporte'), ('support'), ('www'), ('plataforma'),
  ('platform'), ('perfil'), ('profile'), ('dashboard'), ('static'), ('public'), ('assets'),
  ('empresa'), ('empresas'), ('sistema'), ('system'), ('root'), ('null'), ('undefined');

-- -----------------------------------------------------------------------------
-- Empresas e membros
-- -----------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug extensions.citext not null unique
    check (slug::text ~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$'),
  status public.company_status not null default 'active',
  suspended_at timestamptz,
  suspended_reason text check (char_length(suspended_reason) <= 500),
  timezone text not null default 'America/Sao_Paulo',
  auto_distribution_enabled boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_one_per_creator unique (created_by),
  constraint companies_suspension_coherent check ((status = 'suspended') = (suspended_at is not null))
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.member_role not null,
  status public.member_status not null default 'active',
  distribution_seq bigint generated always as identity,
  joined_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_company_user_key unique (company_id, user_id),
  constraint company_members_status_coherent check ((status = 'inactive') = (deactivated_at is not null))
);
create index company_members_user_active_idx on public.company_members (user_id) where status = 'active';
create index company_members_rotation_idx on public.company_members (company_id, distribution_seq)
  where role = 'seller' and status = 'active';

create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  email extensions.citext not null check (email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role not null default 'seller',
  token_hash bytea not null unique,
  invited_by uuid not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint company_invitations_inviter_fk foreign key (company_id, invited_by)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint company_invitations_final_state check (not (accepted_at is not null and revoked_at is not null))
);
create unique index company_invitations_pending_email_key on public.company_invitations (company_id, email)
  where accepted_at is null and revoked_at is null;

create table public.lead_distribution_state (
  company_id uuid primary key references public.companies (id) on delete restrict,
  last_member_seq bigint,
  last_assigned_to uuid references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Configuração comercial
-- -----------------------------------------------------------------------------
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  name_key text generated always as (private.normalize_label(name)) stored,
  kind public.lead_outcome not null,
  position integer not null,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_stages_company_id_key unique (company_id, id),
  constraint pipeline_stages_company_id_kind_key unique (company_id, id, kind),
  constraint pipeline_stages_default_is_open check (not is_default or kind = 'open'),
  constraint pipeline_stages_archive_only_open check (
    archived_at is null or (kind = 'open' and not is_default)
  )
);
create unique index pipeline_stages_one_won on public.pipeline_stages (company_id) where kind = 'won';
create unique index pipeline_stages_one_lost on public.pipeline_stages (company_id) where kind = 'lost';
create unique index pipeline_stages_one_default on public.pipeline_stages (company_id) where is_default;
create unique index pipeline_stages_name_key on public.pipeline_stages (company_id, name_key)
  where archived_at is null;

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  name_key text generated always as (private.normalize_label(name)) stored,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_sources_company_id_key unique (company_id, id),
  constraint lead_sources_name_key unique (company_id, name_key)
);

create table public.lost_reasons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  name_key text generated always as (private.normalize_label(name)) stored,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lost_reasons_company_id_key unique (company_id, id),
  constraint lost_reasons_name_key unique (company_id, name_key)
);

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  field_type public.custom_field_type not null,
  is_required boolean not null default false,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_fields_company_id_key unique (company_id, id),
  constraint custom_fields_company_id_type_key unique (company_id, id, field_type),
  constraint custom_fields_key_key unique (company_id, key)
);

create table public.custom_field_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  field_id uuid not null,
  field_type public.custom_field_type not null default 'select' check (field_type = 'select'),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  label_key text generated always as (private.normalize_label(label)) stored,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_field_options_field_fk foreign key (company_id, field_id, field_type)
    references public.custom_fields (company_id, id, field_type) on delete restrict on update restrict,
  constraint custom_field_options_company_field_id_key unique (company_id, field_id, id),
  constraint custom_field_options_label_key unique (field_id, label_key)
);

-- -----------------------------------------------------------------------------
-- Leads
-- -----------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  phone_raw text not null check (char_length(btrim(phone_raw)) between 1 and 40),
  phone_normalized text not null check (phone_normalized ~ '^\+[1-9][0-9]{7,14}$'),
  email extensions.citext check (email is null or email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_company text check (char_length(customer_company) <= 200),
  source_id uuid,
  assigned_to uuid,
  stage_id uuid not null,
  outcome public.lead_outcome not null default 'open',
  won_amount numeric(14, 2) check (won_amount >= 0),
  won_at timestamptz,
  lost_reason_id uuid,
  lost_note text check (char_length(lost_note) <= 1000),
  closed_at timestamptz,
  notes text check (char_length(notes) <= 5000),
  search_text text generated always as (
    private.normalize_label(
      name || ' ' || phone_normalized || ' ' || coalesce(email::text, '') || ' ' || coalesce(customer_company, '')
    )
  ) stored,
  created_by uuid not null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete restrict,
  row_version integer not null default 1,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_company_id_key unique (company_id, id),
  constraint leads_client_request_key unique (company_id, client_request_id),
  constraint leads_stage_fk foreign key (company_id, stage_id, outcome)
    references public.pipeline_stages (company_id, id, kind) on delete restrict,
  constraint leads_source_fk foreign key (company_id, source_id)
    references public.lead_sources (company_id, id) on delete restrict,
  constraint leads_lost_reason_fk foreign key (company_id, lost_reason_id)
    references public.lost_reasons (company_id, id) on delete restrict,
  constraint leads_assigned_fk foreign key (company_id, assigned_to)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint leads_created_by_fk foreign key (company_id, created_by)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint leads_outcome_coherent check (
    case outcome
      when 'open' then won_amount is null and won_at is null and lost_reason_id is null
        and lost_note is null and closed_at is null
      when 'won' then won_amount is not null and won_at is not null and closed_at is not null
        and lost_reason_id is null and lost_note is null
      when 'lost' then lost_reason_id is not null and closed_at is not null
        and won_amount is null and won_at is null
    end
  )
);
create index leads_assigned_idx on public.leads (company_id, assigned_to) where archived_at is null;
create index leads_assigned_all_idx on public.leads (assigned_to);
create index leads_kanban_idx on public.leads (company_id, stage_id, updated_at desc) where archived_at is null;
create index leads_created_idx on public.leads (company_id, created_at);
create index leads_closed_idx on public.leads (company_id, closed_at) where outcome <> 'open';
create index leads_won_idx on public.leads (company_id, won_at) where outcome = 'won';
create index leads_phone_idx on public.leads (company_id, phone_normalized);
create index leads_source_idx on public.leads (company_id, source_id);
create index leads_lost_reason_idx on public.leads (company_id, lost_reason_id);
create index leads_stage_fk_idx on public.leads (stage_id);
create index leads_search_trgm_idx on public.leads using gin (search_text extensions.gin_trgm_ops);

create table public.lead_custom_values (
  company_id uuid not null,
  lead_id uuid not null,
  field_id uuid not null,
  field_type public.custom_field_type not null,
  value_text text check (char_length(value_text) <= 2000),
  value_number numeric(18, 4),
  value_date date,
  option_id uuid,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (lead_id, field_id),
  constraint lead_custom_values_lead_fk foreign key (company_id, lead_id)
    references public.leads (company_id, id) on delete cascade,
  constraint lead_custom_values_field_fk foreign key (company_id, field_id, field_type)
    references public.custom_fields (company_id, id, field_type) on delete restrict on update restrict,
  constraint lead_custom_values_option_fk foreign key (company_id, field_id, option_id)
    references public.custom_field_options (company_id, field_id, id) on delete restrict,
  constraint lead_custom_values_typed check (
    case field_type
      when 'text' then value_text is not null and value_number is null and value_date is null and option_id is null
      when 'number' then value_number is not null and value_text is null and value_date is null and option_id is null
      when 'date' then value_date is not null and value_text is null and value_number is null and option_id is null
      when 'select' then option_id is not null and value_text is null and value_number is null and value_date is null
    end
  )
);
create index lead_custom_values_field_idx on public.lead_custom_values (field_id);
create index lead_custom_values_option_idx on public.lead_custom_values (field_id, option_id);
create index lead_custom_values_number_idx on public.lead_custom_values (field_id, value_number);
create index lead_custom_values_date_idx on public.lead_custom_values (field_id, value_date);
create index lead_custom_values_text_trgm_idx on public.lead_custom_values
  using gin (value_text extensions.gin_trgm_ops);

create table public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  lead_id uuid not null,
  kind public.interaction_kind not null,
  channel public.contact_channel,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  occurred_at timestamptz not null default now(),
  author_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint lead_interactions_lead_fk foreign key (company_id, lead_id)
    references public.leads (company_id, id) on delete restrict,
  constraint lead_interactions_author_fk foreign key (company_id, author_id)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint lead_interactions_channel_only_contact check (kind = 'contact' or channel is null),
  constraint lead_interactions_not_future check (occurred_at <= created_at + interval '5 minutes')
);
create index lead_interactions_lead_idx on public.lead_interactions (company_id, lead_id, occurred_at desc);
create index lead_interactions_lead_fk_idx on public.lead_interactions (lead_id);

-- -----------------------------------------------------------------------------
-- Tarefas e vendas
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  lead_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 5000),
  assigned_to uuid not null,
  created_by uuid not null default auth.uid(),
  due_at timestamptz not null,
  status public.task_status not null default 'pending',
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_lead_fk foreign key (company_id, lead_id)
    references public.leads (company_id, id) on delete restrict,
  constraint tasks_assigned_fk foreign key (company_id, assigned_to)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint tasks_created_by_fk foreign key (company_id, created_by)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint tasks_completion_coherent check ((status = 'done') = (completed_at is not null))
);
create index tasks_assignee_idx on public.tasks (company_id, assigned_to, status, due_at);
create index tasks_lead_idx on public.tasks (company_id, lead_id);
create index tasks_pending_due_idx on public.tasks (due_at) where status = 'pending';
create index tasks_created_by_idx on public.tasks (created_by);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  lead_id uuid not null,
  seller_id uuid not null,
  description text not null check (char_length(btrim(description)) between 1 and 500),
  amount numeric(14, 2) not null check (amount > 0),
  status public.sale_status not null default 'pending',
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete restrict,
  cancel_reason text check (char_length(cancel_reason) <= 1000),
  created_by uuid not null,
  row_version integer not null default 1,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_company_id_key unique (company_id, id),
  constraint sales_client_request_key unique (company_id, client_request_id),
  constraint sales_lead_fk foreign key (company_id, lead_id)
    references public.leads (company_id, id) on delete restrict,
  constraint sales_seller_fk foreign key (company_id, seller_id)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint sales_created_by_fk foreign key (company_id, created_by)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint sales_status_coherent check (
    case status
      when 'pending' then completed_at is null and cancelled_at is null
      when 'completed' then completed_at is not null and cancelled_at is null
      when 'cancelled' then cancelled_at is not null and cancel_reason is not null
    end
  )
);
create index sales_revenue_idx on public.sales (company_id, status, completed_at);
create index sales_seller_idx on public.sales (company_id, seller_id, status, completed_at);
create index sales_lead_idx on public.sales (company_id, lead_id);
create index sales_lead_fk_idx on public.sales (lead_id);

-- -----------------------------------------------------------------------------
-- Histórico, auditoria e notificações
-- -----------------------------------------------------------------------------
create table public.lead_events (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  lead_id uuid not null,
  event_type public.lead_event_type not null,
  actor_id uuid references public.profiles (id) on delete restrict,
  from_stage_id uuid,
  to_stage_id uuid,
  from_assignee uuid,
  to_assignee uuid,
  lost_reason_id uuid,
  sale_id uuid,
  amount numeric(14, 2),
  data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint lead_events_lead_fk foreign key (company_id, lead_id)
    references public.leads (company_id, id) on delete restrict,
  constraint lead_events_from_stage_fk foreign key (company_id, from_stage_id)
    references public.pipeline_stages (company_id, id) on delete restrict,
  constraint lead_events_to_stage_fk foreign key (company_id, to_stage_id)
    references public.pipeline_stages (company_id, id) on delete restrict,
  constraint lead_events_from_assignee_fk foreign key (company_id, from_assignee)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint lead_events_to_assignee_fk foreign key (company_id, to_assignee)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint lead_events_lost_reason_fk foreign key (company_id, lost_reason_id)
    references public.lost_reasons (company_id, id) on delete restrict,
  constraint lead_events_sale_fk foreign key (company_id, sale_id)
    references public.sales (company_id, id) on delete restrict
);
create index lead_events_timeline_idx on public.lead_events (company_id, lead_id, occurred_at desc);
create index lead_events_report_idx on public.lead_events (company_id, event_type, occurred_at);
create index lead_events_lead_fk_idx on public.lead_events (lead_id);
create index lead_events_from_stage_idx on public.lead_events (from_stage_id);
create index lead_events_to_stage_idx on public.lead_events (to_stage_id);
create index lead_events_lost_reason_idx on public.lead_events (lost_reason_id);
create index lead_events_sale_idx on public.lead_events (sale_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete restrict,
  actor_role text not null check (actor_role in ('platform_admin', 'admin', 'seller', 'system', 'user')),
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 60),
  entity_id uuid,
  data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_logs_company_idx on public.audit_logs (company_id, occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  user_id uuid not null,
  type public.notification_type not null,
  entity_type text not null,
  entity_id uuid not null,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_user_fk foreign key (company_id, user_id)
    references public.company_members (company_id, user_id) on delete restrict,
  constraint notifications_dedupe_key unique (user_id, dedupe_key)
);
create index notifications_inbox_idx on public.notifications (user_id, created_at desc) where dismissed_at is null;
create index notifications_company_idx on public.notifications (company_id);

-- Índices de FKs restantes
create index company_invitations_company_idx on public.company_invitations (company_id)
  where accepted_at is null and revoked_at is null;
create index leads_created_by_idx on public.leads (company_id, created_by);
create index custom_field_options_field_idx on public.custom_field_options (company_id, field_id);
create index lead_interactions_author_idx on public.lead_interactions (company_id, author_id);
create index sales_created_by_idx on public.sales (company_id, created_by);
