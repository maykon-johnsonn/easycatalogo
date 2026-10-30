-- Administração geral da plataforma (dono do SaaS): vê todas as lojas, métricas e cria lojas novas.
-- Acesso feito só pela API (secret key); por isso RLS ligado e nenhuma política.

create table public.plataforma_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.plataforma_admins enable row level security;
revoke all on public.plataforma_admins from anon, authenticated;

-- Rotas do app web que não podem virar slug de loja:
--   /painel (lojista), /plataforma (admin geral), /entrar e /sair (login)
alter table public.lojas drop constraint lojas_slug_check1;
alter table public.lojas add constraint lojas_slug_reservado check (
  slug <> all (array['admin', 'api', 'p', 'login', 'auth', '_next', 'painel', 'plataforma', 'entrar', 'sair'])
);
