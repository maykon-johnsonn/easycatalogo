-- Apoio à API da Fase 1.

-- `numero` é sempre definido pelo trigger produtos_numero; o default só torna o campo
-- opcional no INSERT (e nos tipos gerados), sem efeito real.
alter table public.produtos alter column numero set default 0;

-- Busca o id de um usuário do Auth pelo e-mail (criação de loja e promoção de admin).
-- Executável apenas pela API (service_role/secret key); nunca por anon/authenticated.
create or replace function public.usuario_id_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke execute on function public.usuario_id_por_email(text) from public, anon, authenticated;
grant execute on function public.usuario_id_por_email(text) to service_role;
