-- Garantias estruturais de segurança: RLS, GRANTs e funções.
begin;
select plan(9);

select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
$$, 'todas as tabelas de public têm RLS habilitada');

select is_empty($$
  select table_name from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'
$$, 'anon não tem privilégio em nenhuma tabela');

select is_empty($$
  select t from unnest(array[
    'leads', 'sales', 'lead_events', 'audit_logs', 'companies', 'company_members',
    'company_invitations', 'pipeline_stages', 'lead_custom_values', 'lead_distribution_state',
    'platform_admins', 'reserved_slugs'
  ]) t
  where has_any_column_privilege('authenticated', 'public.' || t, 'INSERT')
     or has_any_column_privilege('authenticated', 'public.' || t, 'UPDATE')
     or has_table_privilege('authenticated', 'public.' || t, 'DELETE')
$$, 'authenticated não escreve diretamente em tabelas centrais (somente via RPC)');

select ok(
  not has_table_privilege('authenticated', 'public.reserved_slugs', 'SELECT'),
  'slugs reservados não são legíveis pela API'
);

select ok(
  not has_column_privilege('authenticated', 'public.lead_interactions', 'author_id', 'INSERT'),
  'autor da interação não pode ser informado pelo cliente'
);

select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'EXECUTE')
$$, 'anon não executa nenhuma função da aplicação');

select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
$$, 'toda função SECURITY DEFINER fixa search_path');

select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in ('add_lead_event', 'log_audit', 'notify', 'apply_custom_values', 'next_rotation_seller',
                      'lock_lead', 'lock_sale', 'generate_overdue_task_notifications')
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
$$, 'funções internas de escrita não são executáveis por authenticated');

select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce((select bool_or(o = 'security_invoker=true') from unnest(c.reloptions) o), false)
$$, 'views (se houver) usam security_invoker');

select * from finish();
rollback;
