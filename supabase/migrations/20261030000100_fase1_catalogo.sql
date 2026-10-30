-- Fase 1: catálogo base (lojas, membros do painel, produtos e imagens)
-- Tabelas do bot (canal_operadores, mensagens, conversas, midias_pendentes, acoes_pendentes) entram na Fase 2.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------

create or replace function private.set_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- lojas
-- ---------------------------------------------------------------------------

create table public.lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 80),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 50)
    check (slug not in ('admin', 'api', 'p', 'login', 'auth', '_next')),
  telefone_pedidos text not null check (telefone_pedidos ~ '^\d{10,15}$'),
  ativa boolean not null default true,
  proximo_numero_produto int not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger lojas_atualizado_em
  before update on public.lojas
  for each row execute function private.set_atualizado_em();

-- ---------------------------------------------------------------------------
-- loja_membros (acesso ao painel)
-- ---------------------------------------------------------------------------

create table public.loja_membros (
  loja_id uuid not null references public.lojas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null default 'dono' check (papel in ('dono', 'operador')),
  criado_em timestamptz not null default now(),
  primary key (loja_id, user_id)
);

create index loja_membros_user_id_idx on public.loja_membros (user_id);

-- ---------------------------------------------------------------------------
-- produtos
-- ---------------------------------------------------------------------------

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id) on delete cascade,
  numero int not null,
  nome text not null check (char_length(nome) between 1 and 120),
  descricao text check (char_length(descricao) <= 2000),
  preco_original numeric(10, 2) not null check (preco_original > 0),
  preco_promocional numeric(10, 2) check (preco_promocional > 0),
  categoria text check (char_length(categoria) <= 60),
  tamanhos jsonb not null default '[]'::jsonb check (jsonb_typeof(tamanhos) = 'array'),
  cores jsonb not null default '[]'::jsonb check (jsonb_typeof(cores) = 'array'),
  ativo boolean not null default true,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint produtos_promocao_menor check (preco_promocional is null or preco_promocional < preco_original),
  constraint produtos_numero_por_loja unique (loja_id, numero),
  -- alvo da FK composta de produto_imagens (garante imagem e produto da mesma loja)
  constraint produtos_id_loja unique (id, loja_id)
);

create index produtos_vitrine_idx on public.produtos (loja_id, criado_em desc)
  where ativo and excluido_em is null;
create index produtos_categoria_idx on public.produtos (loja_id, categoria)
  where excluido_em is null;

-- Código curto sequencial por loja (#1, #2, ...). O UPDATE trava a linha da loja,
-- então inserções concorrentes na mesma loja não geram números repetidos.
create or replace function private.atribuir_numero_produto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.lojas
     set proximo_numero_produto = proximo_numero_produto + 1
   where id = new.loja_id
  returning proximo_numero_produto - 1 into new.numero;
  return new;
end;
$$;

create trigger produtos_numero
  before insert on public.produtos
  for each row execute function private.atribuir_numero_produto();

create trigger produtos_atualizado_em
  before update on public.produtos
  for each row execute function private.set_atualizado_em();

-- ---------------------------------------------------------------------------
-- produto_imagens
-- ---------------------------------------------------------------------------

create table public.produto_imagens (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  produto_id uuid not null,
  chave_storage text not null unique,
  url text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  foreign key (produto_id, loja_id) references public.produtos (id, loja_id) on delete cascade
);

create index produto_imagens_produto_idx on public.produto_imagens (produto_id, ordem);

-- ---------------------------------------------------------------------------
-- RLS
-- Escritas acontecem só pela API (secret key, ignora RLS). Aqui ficam apenas leituras:
--   * anon/authenticated: vitrine pública (loja ativa, produto ativo e não excluído)
--   * authenticated: membros leem tudo da própria loja (painel)
-- ---------------------------------------------------------------------------

create or replace function private.eh_membro(p_loja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.loja_membros
     where loja_id = p_loja_id and user_id = (select auth.uid())
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.eh_membro(uuid) to authenticated;

alter table public.lojas enable row level security;
alter table public.loja_membros enable row level security;
alter table public.produtos enable row level security;
alter table public.produto_imagens enable row level security;

revoke all on public.lojas, public.loja_membros, public.produtos, public.produto_imagens from anon, authenticated;
grant select on public.lojas, public.produtos, public.produto_imagens to anon, authenticated;
grant select on public.loja_membros to authenticated;

-- lojas
create policy "vitrine: lojas ativas"
  on public.lojas for select to anon, authenticated
  using (ativa);

create policy "painel: membros veem a própria loja"
  on public.lojas for select to authenticated
  using ((select private.eh_membro(id)));

-- loja_membros
create policy "painel: usuário vê os próprios vínculos"
  on public.loja_membros for select to authenticated
  using (user_id = (select auth.uid()));

-- produtos
create policy "vitrine: produtos visíveis"
  on public.produtos for select to anon, authenticated
  using (
    ativo and excluido_em is null
    and exists (select 1 from public.lojas l where l.id = loja_id and l.ativa)
  );

create policy "painel: membros veem produtos da loja"
  on public.produtos for select to authenticated
  using ((select private.eh_membro(loja_id)));

-- produto_imagens
create policy "vitrine: imagens de produtos visíveis"
  on public.produto_imagens for select to anon, authenticated
  using (
    exists (
      select 1 from public.produtos p
        join public.lojas l on l.id = p.loja_id
       where p.id = produto_id and p.ativo and p.excluido_em is null and l.ativa
    )
  );

create policy "painel: membros veem imagens da loja"
  on public.produto_imagens for select to authenticated
  using ((select private.eh_membro(loja_id)));
