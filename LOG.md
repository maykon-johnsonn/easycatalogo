# 📓 Diário de Desenvolvimento

Registro de cada ação relevante do projeto: o que foi feito, quando e por quê.
Entradas mais recentes no topo. Formato e regras na seção 10 do [direcao.md](direcao.md).

---

## 2026-10-30: Fase 1, Passo 2: telas do painel do lojista e da administração geral

- **O que foi feito (branch `feat/painel-web`):**
  - **Login** (`/entrar`):
    - senha ou link de acesso por e-mail;
    - "esqueci minha senha";
    - tela `/conta/senha` para definir ou trocar a senha;
    - o convite de uma loja nova leva direto à tela de criar senha.
  - **Entrada do painel** (`/painel`): leva direto à loja quando o usuário só tem uma. Admin sem loja vai para `/plataforma`.
  - **Painel do lojista** (`/painel/{slug}`):
    - lista de produtos em grade, com capa, `#número`, preço e promoção;
    - busca por nome ou `#número` (espera o usuário parar de digitar), filtro por status (todos/ativos/pausados) e por categoria;
    - botão para pausar ou ativar direto na lista.
  - **Cadastro e edição de produto:**
    - preço no formato brasileiro (59,90), com validação de promoção menor que o preço;
    - categoria com sugestões das já usadas;
    - tamanhos e cores como etiquetas, com atalhos (P, M, G… / Preto, Branco…);
    - até 8 fotos com capa, reordenação por setas e remoção;
    - exclusão com confirmação.
  - **Configurações da loja:** nome, endereço da vitrine (com aviso de que o link antigo para de funcionar) e WhatsApp de pedidos.
  - **Administração geral** (`/plataforma`):
    - indicadores de lojas, produtos e usuários;
    - tabela de lojas com produtos, última atividade e data de cadastro;
    - busca e criação de loja com convite do dono;
    - ativar e desativar loja;
    - atalho para abrir o painel ou a vitrine de cada loja.
  - Hook `useDados`: carrega da API e descarta respostas antigas. Uma busca lenta não sobrescreve uma mais recente.
  - Página inicial simples com o botão "Acessar meu painel".
  - `admin:promover` agora cria a conta com senha temporária quando o e-mail não existe, sem depender de envio de e-mail.
- **Por quê:** a Fase 1 exige que tudo funcione pelo painel antes da IA e do bot.
- **Decisões:**
  - As áreas restritas são renderizadas no navegador: a sessão fica no localStorage e as chamadas vão à API com o token. A vitrine pública (próximo passo) será renderizada no servidor, por causa do SEO e do preview no WhatsApp.
  - Visual com fonte Geist, neutros "stone" e cor da marca rosé (`marca-600 #9c3f5b`), pensado primeiro para o celular.
- **Testes:** lint, typecheck e build de produção passando. Teste de integração da API (26 verificações) passando. Todas as páginas respondem 200 no `next dev`.
- **Pendências:**
  - O Next 16 mostra, só em desenvolvimento, o aviso "Could not validate instant navigation" nas áreas restritas. É esperado, porque o conteúdo depende da sessão no navegador, e não bloqueia o build. Revisitar se quisermos navegação instantânea nessas telas.
  - Desligar o cadastro público no Supabase e configurar as URLs de redirecionamento do login.
  - Criar a conta de administrador geral.
  - Próximo passo: vitrine pública.

## 2026-10-30: Fase 1, Passo 1: API do painel do lojista e da administração geral

- **O que foi feito:**
  - Três níveis de acesso:
    - vitrine pública;
    - painel do lojista (`/painel/lojas/:lojaId/...`, só membros da loja);
    - administração geral (`/plataforma/...`, só admins).
  - Tabela `plataforma_admins` e script `admin:promover <email>` para conceder o acesso geral.
  - Slugs reservados ampliados: `painel`, `plataforma`, `entrar`, `sair`.
  - Função `usuario_id_por_email` (só service_role), para vincular ou convidar o dono ao criar uma loja.
  - Serviços de catálogo:
    - listar, com busca por nome ou `#número`, filtro por categoria e status;
    - criar, editar, excluir (lógico) e listar categorias;
    - fotos: enviar (até 8, convertidas para WebP), reordenar e remover.
  - Serviços da administração geral:
    - métricas (lojas, produtos, usuários, novos em 30 dias);
    - lista de lojas com contagem de produtos, membros e última atividade;
    - criar loja convidando o dono por e-mail;
    - ativar e desativar loja.
  - Autenticação por JWT do Supabase (`getClaims`). Erros do Postgres traduzidos em mensagens claras (ex.: promoção maior que o preço vira 400).
  - Teste de integração `pnpm --filter @catalogo/api teste:integracao`: 26 verificações contra o Supabase real, que apagam os dados no fim.
- **Por quê:** cada lojista precisa acessar só o próprio painel e catálogo, e o dono da plataforma precisa acompanhar quantos clientes usam o sistema.
- **Decisões:**
  - Acesso a outra loja responde 404, e não 403, para não revelar quais lojas existem.
  - O admin da plataforma pode abrir o painel de qualquer loja, para dar suporte.
  - Admins só são criados pelo terminal. Não há rota para isso, o que reduz a superfície de ataque.
  - Painel web em `/painel/{slug}` e administração em `/plataforma`. Substitui o `/admin` do plano original.
  - Listagem de lojas agrega a contagem de produtos em memória (suficiente no MVP; virar view/RPC quando crescer).
- **Pendências:** promover o seu e-mail a admin. Fase 1, Passo 2: login e telas do painel no app web.

## 2026-10-30: Fase 0, Passo 4: banco aplicado, segurança revisada e storage funcionando

- **O que foi feito:**
  - Migrations da Fase 1 e do bucket aplicadas no projeto `catalogo` via `pnpm db:push`. Tipos gerados em `packages/shared/src/database.types.ts`.
  - O `supabase db advisors` apontou dois pontos, corrigidos na migration `20261030000300_ajustes_advisors.sql`:
    - Revogado o EXECUTE de `public.rls_auto_enable()`, a função do Supabase que liga o RLS automaticamente, para anon/authenticated.
    - Políticas de SELECT consolidadas em uma por papel, porque políticas duplicadas pesam no desempenho.
  - O advisors agora volta sem nenhum aviso.
  - Storage com dois drivers (`STORAGE_DRIVER=supabase|s3`). Conversão WebP com Sharp: máx. 1200px, qualidade 80, respeitando a rotação EXIF das fotos de celular.
  - Chave publicável configurada no `apps/web/.env.local`.
- **Testes feitos (dados apagados depois):**
  - Numeração por loja (1, 2, 3).
  - CHECK de promoção maior que o preço barrando o insert.
  - Vitrine anônima vendo só produtos ativos.
  - Insert anônimo negado.
  - Exclusão em cascata.
  - Upload real: PNG 3000×2000 (83 KB) virou WebP 1200×800 (1,8 KB), e a exclusão foi confirmada no bucket.
- **Por quê:** o Supabase Storage aceita a secret key que a API já usa, então o desenvolvimento não precisa de chaves S3 extras. O driver `s3` fica pronto para o MinIO.
- **Observação:** depois de excluir uma imagem, a URL pública ainda responde por um tempo (cache da CDN). Não é problema, porque cada imagem nova recebe um nome único (UUID).

## 2026-10-30: Fase 0, Passo 3: Supabase CLI e storage de desenvolvimento

- **O que foi feito:** Supabase CLI instalada como dependência do projeto. Rodado `supabase init` (`supabase/config.toml`) e adicionados os scripts `db:status`, `db:new`, `db:push` e `db:types`. Criada a migration do bucket público `catalogo-produtos` (aceita só WebP, até 2 MB). Variáveis `S3_*` apontadas para o endpoint S3 do Supabase Storage.
- **Por quê:** gerenciar o banco por migrations versionadas, pela CLI, em vez de mudanças manuais no painel. O MinIO ainda não está pronto, e o Supabase Storage é S3-compatible, então o mesmo código serve. Para trocar para o MinIO depois, basta mudar as `S3_*` no `.env`.
- **Pendências:** login e vínculo da CLI (`supabase login` / `supabase link`), gerar as chaves S3 do Storage e rodar `pnpm db:push`.

## 2026-10-30: Fase 0, Passo 2: esqueleto do monorepo e migration da Fase 1

- **O que foi feito:**
  - Monorepo pnpm com `apps/api` (Fastify 5 + TypeScript strict + tsx), `apps/web` (Next.js 16 + Tailwind 4) e `packages/shared` (schemas Zod de produto e loja).
  - `env.ts` validado com Zod. Clientes do Supabase (secret key) e do S3/MinIO. Rota `/health`, que testa a conexão com o banco.
  - Migration `supabase/migrations/20261030000100_fase1_catalogo.sql` com `lojas`, `loja_membros`, `produtos` e `produto_imagens`. Inclui código curto sequencial por loja (trigger), `atualizado_em` automático, FK composta para garantir imagem e produto da mesma loja, e RLS só de leitura (vitrine pública + membros no painel).
  - `.env.example` em cada app. Os `.env` locais ficam fora do Git.
- **Por quê:** base para a Fase 1 (painel + vitrine). A migration fica versionada no repositório para o banco poder ser recriado do zero. O RLS não tem políticas de escrita porque todas as escritas passam pela API, onde ficam as regras de negócio (direcao.md, seção 8).
- **Decisões:**
  - Uso das chaves novas do Supabase (`sb_secret_` / `sb_publishable_`) no lugar de `service_role` / `anon`.
  - API na porta 3333 para não colidir com o Next.js (3000).
  - O `/health` não usa `select` com `head: true`, porque nesse modo uma tabela inexistente passa como ok (falso positivo encontrado no teste).
- **Pendências:** aplicar a migration no projeto Supabase (o MCP conectado é de outra conta). Definir o storage de desenvolvimento enquanto o MinIO não existe.

## 2026-10-30: Fase 0, Passo 1: versionamento e diário de desenvolvimento

- **O que foi feito:** inicializado o repositório Git (branch `main`). Criados o `.gitignore` (bloqueia `.env`, `node_modules`, builds e arquivos de sistema), o `.gitattributes` (finais de linha LF) e este `LOG.md`.
- **Por quê:** ter histórico e backup de tudo desde o primeiro arquivo e registrar as decisões junto com as mudanças. O `.gitignore` vem antes de qualquer código para impedir que chaves de API sejam commitadas.
- **Arquivos/Commits:** `.gitignore`, `.gitattributes`, `LOG.md`, `direcao.md`.
- **Pendências:** criar o repositório privado no GitHub e fazer o primeiro push.

## 2026-10-30: Ordem das fases: protótipo pelo painel antes da IA

- **O que foi feito:** reordenadas as fases no `direcao.md`. A Fase 1 passa a ser o protótipo base (painel + vitrine) e a Fase 2 passa a ser IA (Gemini/Groq) + Telegram.
- **Por quê:** validar o modelo de dados, os serviços de catálogo e o storage sem depender de provedores externos. O bot depois só chama os serviços que já existem e funcionam.
- **Arquivos/Commits:** `direcao.md` (seção 11).

## 2026-10-29: Provedores de IA, processo de desenvolvimento

- **O que foi feito:** definido o uso de Gemini Flash + Groq com roteador (fallback e round-robin) no lugar da OpenAI. Adicionada a seção "Processo de Desenvolvimento" (Git, `LOG.md`, frases de teste).
- **Por quê:** acesso mais fácil e custo baixo ou gratuito durante os testes e os primeiros clientes, até haver receita para provedores mais caros.
- **Arquivos/Commits:** `direcao.md` (seções 4.1, 10 e 13).

## 2026-10-29: Reescrita do documento de direção

- **O que foi feito:** reescrito o `direcao.md`. Painel administrativo como parte do produto (com o bot como facilidade), estratégia Telegram → WhatsApp com adapters de canal, tabelas novas (buffer de fotos, ações pendentes, mensagens, operadores), lista de tools da IA, critérios de validação e riscos.
- **Por quê:** a versão original tinha decisões em aberto, lacunas no modelo de dados e problemas de formatação. O Telegram no início reduz o custo e o risco de banimento enquanto o fluxo é validado.
- **Arquivos/Commits:** `direcao.md`.
