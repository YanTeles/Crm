-- =============================================================================
-- Base: extensões, schemas, privilégios padrão, tipos e utilitários
-- =============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Schema interno: funções auxiliares, triggers e jobs. Não é exposto pela API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Nada criado em public/private fica acessível sem GRANT explícito.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema private revoke execute on functions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.company_status as enum ('active', 'suspended');
create type public.member_role as enum ('admin', 'seller');
create type public.member_status as enum ('active', 'inactive');
create type public.lead_outcome as enum ('open', 'won', 'lost');
create type public.custom_field_type as enum ('text', 'number', 'date', 'select');
create type public.interaction_kind as enum ('note', 'contact');
create type public.contact_channel as enum ('phone', 'whatsapp', 'email', 'meeting', 'other');
create type public.task_status as enum ('pending', 'done');
create type public.sale_status as enum ('pending', 'completed', 'cancelled');
create type public.lead_event_type as enum (
  'created', 'updated', 'custom_fields_updated', 'assigned', 'stage_changed',
  'won', 'lost', 'reopened', 'archived', 'unarchived',
  'sale_created', 'sale_updated', 'sale_completed', 'sale_cancelled'
);
create type public.notification_type as enum ('lead_assigned', 'task_assigned', 'task_overdue');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------

-- Normaliza rótulos para unicidade/busca: minúsculas, sem acento, espaços colapsados.
create function private.normalize_label(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(
    extensions.unaccent(
      'extensions.unaccent'::regdictionary,
      regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g')
    )
  )
$$;

-- Gera slug ASCII a partir de um texto livre.
create function private.slugify(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(private.normalize_label(p_value), '[^a-z0-9]+', '-', 'g'),
    '-'
  )
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bloqueia UPDATE/DELETE em tabelas somente-inserção (histórico e auditoria).
create function private.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'crm:immutable_record' using errcode = '42501';
end;
$$;

-- Lança erro padronizado. O código após "crm:" é traduzido na aplicação.
create function private.fail(p_code text, p_errcode text default 'P0001', p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'crm:%', p_code using errcode = p_errcode, detail = coalesce(p_detail, '');
end;
$$;
