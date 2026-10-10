-- Ambiente mínimo compatível com Supabase para rodar migrações e testes pgTAP
-- no PGlite (sem Docker). NÃO é aplicado em projetos Supabase reais.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  aud text default 'authenticated',
  role text default 'authenticated',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function auth.role() returns text
language sql stable
as $$
  select auth.jwt() ->> 'role'
$$;

grant execute on function auth.uid(), auth.jwt(), auth.role() to anon, authenticated, service_role;
