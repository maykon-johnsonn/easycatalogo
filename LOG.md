# 📓 Diário de Desenvolvimento

Registro de cada ação relevante do projeto: o que foi feito, quando e por quê.
Entradas mais recentes no topo. Formato e regras na seção 10 do [direcao.md](direcao.md).

---

## 2026-10-30: Fase 2: chaves de IA e Telegram conectadas, Groq como primário

- **O que foi feito:**
  - Chaves validadas sem expor os valores: bot **@easy_catalogo_bot** respondendo por polling; Gemini e Groq aceitando as chaves, com os modelos configurados disponíveis.
  - Frases de teste (`bot:frases`) com as IAs reais: **Groq 16/16** (~2 s por frase); Gemini 7/16, e todos os erros vistos foram de cota, nenhum de interpretação.
  - O plano grátis do Gemini 2.5 Flash tem limite de **20 requisições/dia** por modelo (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Por isso `AI_PRIMARY_PROVIDER` passou a ser `groq` (padrão, `.env` e `.env.example`).
  - Roteador (`ai/providers.ts`): em erro 429, o provedor fica pausado pelo prazo que ele informa (`retry-after` ou `retryDelay`, de 1 min a 24 h), já na primeira falha.
  - `frases-teste.ts`: espera 30 s e repete quando bate no limite por minuto; aceita alternativas no esperado (`"Preta|Preto"`).
  - `teste-bot.ts`: simulação independente de qual provedor é o primário, mais a verificação nova do 429 (20/20).
- **Por quê:** com o Gemini como primário, o bot esgotaria a cota grátis em ~10 mensagens por dia e depois perderia tempo em toda mensagem tentando de novo antes de cair no Groq.
- **Pendências:**
  - Teste real no Telegram pelo usuário.
  - Merge na `main`.
  - Antes de ter vários lojistas: plano pago de pelo menos um provedor. O Groq grátis tem limite de tokens por minuto, e as frases bateram nele.

## 2026-10-30: Fase 2: estrutura do bot (IA + Telegram), pronta para receber as chaves

- **O que foi feito (branch `feat/fase2-bot`):**
  - **Banco** (migration `20261030000600_fase2_bot.sql`): tabelas `canal_operadores`, `vinculos_canal`, `mensagens`, `conversas` e `midias_pendentes`. RLS ligado e sem acesso para anon/authenticated: só a API lê e escreve.
  - **Canal Telegram** (`channels/telegram/`):
    - recebe texto, foto (inclusive como arquivo), álbum e áudio, só em conversa privada;
    - polling em desenvolvimento e webhook (com segredo) em produção;
    - a interface `ChannelAdapter` deixa o WhatsApp como mais um adapter.
  - **Pipeline** (`inbound/`):
    - grava a mensagem e descarta reenvios;
    - fila em ordem por remetente;
    - vínculo por código (`/start CODIGO` ou o código digitado);
    - fotos vão para o buffer e são anexadas ao próximo produto (janela de 3 minutos);
    - aviso "Recebi N fotos" quando não chega comando;
    - legenda de álbum espera as outras fotos;
    - limite diário de mensagens por loja;
    - limpeza de hora em hora das fotos não usadas (24h) e dos códigos vencidos;
    - toda mensagem recebe resposta, inclusive em erro.
  - **IA** (`ai/`):
    - roteador Gemini ⇄ Groq: fallback, round-robin e pausa de 5 minutos após 3 falhas;
    - transcrição com Groq Whisper e o Gemini como reserva;
    - agente com instruções em português e 8 tools (criar, editar, adicionar fotos, pausar, reativar, excluir, buscar, resumo) sobre os mesmos serviços do painel;
    - contexto curto (último produto e últimas mensagens);
    - rastreio de provedor, modelo, tokens e fallback em `mensagens`.
  - **Painel:** em "Loja", seção "Bot do Telegram" para conectar a conta (link ou código), ver as contas conectadas e remover acesso.
  - **Testes:**
    - `teste:bot`: 19 verificações ponta a ponta, sem chaves, com canal falso e IA simulada contra o banco real;
    - `bot:frases`: compara Gemini e Groq nas 16 frases de `test/frases.json`;
    - `teste:integracao` ganhou 4 verificações do bot (30 no total).
- **Por quê:** deixar a Fase 2 pronta para funcionar assim que as chaves forem configuradas, reaproveitando as regras de negócio do painel.
- **Decisões:**
  - **Fila em memória** em vez de pg-boss por enquanto. O pg-boss exigiria a senha direta do Postgres, e uma instância basta no MVP. Como as mensagens ficam gravadas antes de entrar na fila, a troca depois não muda o resto.
  - **Bot API direta** em vez da biblioteca grammY. Só 6 métodos são usados.
  - **Polling em desenvolvimento:** dá para testar no Telegram sem expor a máquina na internet.
  - **Sem retentativa depois de uma ação:** se a IA falhar depois de já criar ou alterar algo, o bot avisa o que foi feito em vez de tentar no outro provedor, o que duplicaria o produto.
  - Excluir exige o código do produto. As ações em lote continuam fora do bot até a Fase 3.
  - Modelos padrão: `gemini-2.5-flash` e `openai/gpt-oss-120b` (Groq), configuráveis no `.env`.
- **Não testado ainda:** o Telegram real e os provedores de IA reais. Faltam o token do bot e as chaves.
- **Pendências:** receber as chaves, rodar `bot:frases` nos dois provedores e testar no Telegram. O Supabase Advisors sugere ligar a proteção contra senhas vazadas, uma configuração do painel do Supabase.

## 2026-10-30: Fase 1 concluída e pendências organizadas

- **O que foi feito:** vitrine aprovada e branch `feat/vitrine` juntada na `main`. As pendências espalhadas pelo log foram reunidas no `direcao.md` (seção 11) em duas listas: "Antes de ter clientes reais" e "Melhorias pós-MVP".
- **Por quê:** os pontos de revisão ficam para depois da validação do MVP, sem se perderem no histórico.

## 2026-10-30: Fase 1, Passo 3: vitrine pública

- **O que foi feito (branch `feat/vitrine`):**
  - **Página da loja** `/{slug}`:
    - grade de produtos com foto, preço e selo de desconto;
    - filtro por categoria e busca por nome ou `#número`;
    - botão "Falar com a loja".
  - **Página do produto** `/{slug}/p/{numero}`:
    - galeria (deslizar no celular, setas e miniaturas no computador);
    - escolha de tamanho e cor;
    - botão **"Pedir no WhatsApp"**, que abre a conversa com nome, código, opções escolhidas, preço e link do produto;
    - "Mais em {categoria}".
  - **Preview no WhatsApp:** título, descrição e imagem em JPEG. Produto usa a foto de capa inteira, sem cortar. Loja ou produto sem foto usa um cartão com o nome.
  - Telas de carregamento e de "página não encontrada". Loja desativada e produto pausado ou excluído caem nessa tela.
  - Nova variável `NEXT_PUBLIC_SITE_URL` (links absolutos e previews).
- **Por quê:** é o que o cliente final vê e o que o lojista compartilha. Fecha o protótipo da Fase 1: cadastro no painel → link → pedido no WhatsApp.
- **Decisões:**
  - Renderizada no servidor com a chave publicável. O RLS garante que só aparece loja ativa e produto ativo. A secret key não é usada na vitrine.
  - Uma única leitura por loja (cache de poucos segundos), usada pela página, pelos metadados e pelo preview. Uma alteração no painel aparece na vitrine quase na hora.
  - Imagens otimizadas pelo Next (tamanho certo para cada tela). O host do storage está liberado no `next.config.ts`; incluir o do MinIO quando trocarmos.
  - O pacote `shared` passou a importar com extensão `.ts` (`rewriteRelativeImportExtensions`). O Turbopack não resolvia os imports `.js` quando a vitrine começou a usar código do `shared`, e não só tipos.
  - O `.env.example` do web não estava no Git: o `.gitignore` criado pelo Next ignorava todo `.env*`. Corrigido.
- **Testes:**
  - Loja temporária com 4 produtos (um pausado) e fotos reais. Verificados:
    - produto pausado não aparece;
    - filtro, busca por nome sem acento e busca por `#2`;
    - metadados com o user-agent do WhatsApp;
    - imagens de preview (conferidas visualmente);
    - link `wa.me`;
    - 404 de loja inexistente e de produto pausado.
  - Typecheck, lint, build de produção e teste de integração da API passando. A loja temporária e as fotos foram apagadas.
- **Pendências:**
  - "Página não encontrada" responde com status 200 (com `noindex`), porque a página é enviada em partes (streaming). Não afeta o uso. Rever junto com SEO.

## 2026-10-30: Ajustes após o primeiro teste do painel

- **O que foi feito:**
  - Corrigido o visual: fundo preto e botões invisíveis.
  - Administrador geral trocado para `maykonjohnsonn@gmail.com`, com senha temporária. A conta criada antes foi removida.
- **Por quê:**
  - O servidor de desenvolvimento estava servindo o CSS antigo do modelo do Next, que tem fundo escuro no modo escuro do sistema e não tem as cores da marca. O código estava certo: o build de produção já usava o CSS novo. A correção foi reiniciar o `next dev` com o cache `.next` apagado.
  - A loja de teste "Lu bolsas" foi criada no primeiro teste, com o mesmo e-mail como dono. Ela foi mantida.
- **Observação:** se o visual voltar a ficar estranho depois de mexer no `globals.css`, reinicie o `pnpm dev:web` apagando `apps/web/.next`.

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
