-- Fase 2: backoffice conversacional (bot). Ver direcao.md, seções 5 a 7.
-- Todas estas tabelas são acessadas só pela API (secret key). RLS ligado e sem políticas:
-- anon e authenticated não leem nem escrevem nada aqui.

-- Quem pode operar uma loja pelo bot (Telegram hoje, WhatsApp depois).
create table public.canal_operadores (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id) on delete cascade,
  canal text not null check (canal in ('telegram', 'whatsapp')),
  identificador_externo text not null check (length(identificador_externo) between 1 and 64),
  nome text check (nome is null or length(nome) <= 120),
  criado_em timestamptz not null default now(),
  unique (canal, identificador_externo)
);
create index canal_operadores_loja_idx on public.canal_operadores (loja_id);

-- Códigos de uso único gerados no painel para vincular uma conta do canal à loja.
create table public.vinculos_canal (
  codigo text primary key check (codigo ~ '^[A-Z0-9]{8}$'),
  loja_id uuid not null references public.lojas (id) on delete cascade,
  canal text not null check (canal in ('telegram', 'whatsapp')),
  criado_por uuid references auth.users (id) on delete set null,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index vinculos_canal_loja_idx on public.vinculos_canal (loja_id);

-- Histórico das conversas, idempotência (unique canal + id_externo) e rastreio de IA.
create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas (id) on delete cascade,
  canal_operador_id uuid references public.canal_operadores (id) on delete set null,
  canal text not null check (canal in ('telegram', 'whatsapp')),
  id_externo text,
  remetente text not null,
  direcao text not null check (direcao in ('entrada', 'saida')),
  tipo text not null check (tipo in ('texto', 'audio', 'imagem', 'outro')),
  conteudo text,
  status text not null default 'recebida' check (status in ('recebida', 'processada', 'ignorada', 'erro')),
  erro text,
  provedor_ia text,
  modelo_ia text,
  tokens_entrada integer,
  tokens_saida integer,
  usou_fallback boolean not null default false,
  criado_em timestamptz not null default now(),
  processado_em timestamptz
);
create unique index mensagens_idempotencia_idx on public.mensagens (canal, id_externo) where id_externo is not null;
create index mensagens_loja_criado_idx on public.mensagens (loja_id, criado_em);
create index mensagens_operador_criado_idx on public.mensagens (canal_operador_id, criado_em);

-- Contexto curto: último produto mencionado ("muda o preço dela").
create table public.conversas (
  canal_operador_id uuid primary key references public.canal_operadores (id) on delete cascade,
  ultimo_produto_id uuid references public.produtos (id) on delete set null,
  atualizado_em timestamptz not null default now()
);

-- Fotos recebidas pelo bot que ainda não foram usadas em um produto.
create table public.midias_pendentes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id) on delete cascade,
  canal_operador_id uuid not null references public.canal_operadores (id) on delete cascade,
  chave_storage text not null unique,
  url text not null,
  grupo_externo text,
  recebido_em timestamptz not null default now(),
  consumida_em timestamptz
);
create index midias_pendentes_operador_idx on public.midias_pendentes (canal_operador_id, recebido_em)
  where consumida_em is null;

create trigger conversas_atualizado_em
  before update on public.conversas
  for each row execute function private.set_atualizado_em();

alter table public.canal_operadores enable row level security;
alter table public.vinculos_canal enable row level security;
alter table public.mensagens enable row level security;
alter table public.conversas enable row level security;
alter table public.midias_pendentes enable row level security;

revoke all on public.canal_operadores, public.vinculos_canal, public.mensagens, public.conversas, public.midias_pendentes
  from anon, authenticated;
