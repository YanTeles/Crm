-- Seed local (executado por `supabase db reset`).
-- Intencionalmente vazio: empresas, usuários e dados de demonstração são criados
-- pelo fluxo real da aplicação (cadastro → confirmação → onboarding), sem
-- credenciais fixas versionadas e sem dados pessoais reais.
--
-- Para promover um usuário existente a superadministrador (somente via SQL):
--   insert into public.platform_admins (user_id, note)
--   select id, 'Operação' from auth.users where email = 'voce@exemplo.com';
select 1;
