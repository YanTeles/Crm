-- Helpers de teste (persistem no banco de teste; idempotentes).
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create table if not exists tests.vars (k text primary key, v text);
grant select on tests.vars to anon, authenticated;

create or replace function tests.set_var(p_key text, p_value text)
returns text language sql security definer set search_path = '' as $$
  insert into tests.vars (k, v) values (p_key, p_value)
  on conflict (k) do update set v = excluded.v
  returning v
$$;

create or replace function tests.var(p_key text)
returns text language sql stable security definer set search_path = '' as $$
  select v from tests.vars where k = p_key
$$;

create or replace function tests.id(p_key text)
returns uuid language sql stable security definer set search_path = '' as $$
  select v::uuid from tests.vars where k = p_key
$$;

create or replace function tests.create_user(p_identifier text, p_confirmed boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (v_id, p_identifier || '@test.local', case when p_confirmed then now() end,
          jsonb_build_object('full_name', initcap(p_identifier), 'test_identifier', p_identifier));
  return v_id;
end;
$$;

create or replace function tests.uid(p_identifier text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where raw_user_meta_data ->> 'test_identifier' = p_identifier
$$;

create or replace function tests.authenticate_as(p_identifier text)
returns void language plpgsql set search_path = '' as $$
declare
  v_id uuid := tests.uid(p_identifier);
begin
  if v_id is null then
    raise exception 'test user % not found', p_identifier;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated', 'email', p_identifier || '@test.local')::text, true);
end;
$$;

create or replace function tests.as_anon()
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

create or replace function tests.as_postgres()
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end;
$$;

-- Cria empresa via fluxo real (bootstrap) e guarda o id em vars.
create or replace function tests.create_company(p_admin text, p_name text, p_key text)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  perform tests.authenticate_as(p_admin);
  select b.company_id into v_id from public.bootstrap_company(p_name) b;
  perform tests.as_postgres();
  perform tests.set_var(p_key, v_id::text);
  return v_id;
end;
$$;

-- Adiciona membro via fluxo real de convite e aceite.
create or replace function tests.add_member(p_company_key text, p_admin text, p_member text, p_role public.member_role)
returns void language plpgsql set search_path = '' as $$
declare
  v_token text;
begin
  perform tests.authenticate_as(p_admin);
  select i.token into v_token from public.create_invitation(tests.id(p_company_key), p_member || '@test.local', p_role) i;
  perform tests.authenticate_as(p_member);
  perform public.accept_invitation(v_token);
  perform tests.as_postgres();
end;
$$;

create or replace function tests.member_id(p_company_key text, p_identifier text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.company_members
  where company_id = tests.id(p_company_key) and user_id = tests.uid(p_identifier)
$$;

create or replace function tests.stage_id(p_company_key text, p_name text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.pipeline_stages where company_id = tests.id(p_company_key) and name = p_name
$$;

create or replace function tests.reason_id(p_company_key text, p_name text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.lost_reasons where company_id = tests.id(p_company_key) and name = p_name
$$;

create or replace function tests.source_id(p_company_key text, p_name text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.lead_sources where company_id = tests.id(p_company_key) and name = p_name
$$;

create or replace function tests.lead_payload(p_name text, p_phone text default '+5511999990000')
returns jsonb language sql immutable as $$
  select jsonb_build_object('name', p_name, 'phone_raw', p_phone, 'phone_normalized', p_phone)
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select ok(true, 'helpers de teste instalados');
select * from finish();
