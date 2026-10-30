# 📦 Mini Catálogo Digital Inteligente

## 1. Visão Geral e Proposta de Valor

Sistema de vitrine/catálogo digital simplificado para pequenos lojistas (moda, semijoias e acessórios), focado em substituir o envio caótico de fotos e PDFs em conversas no WhatsApp.

O sistema tem **duas formas de gerenciamento, com as mesmas capacidades**:

1. **Painel Administrativo Web:** cadastro, edição, organização de fotos, promoções e configurações da loja, no modelo tradicional.
2. **Backoffice Conversacional (diferencial competitivo):** o lojista pode fazer tudo por mensagens de texto, áudio e foto em linguagem natural, sem precisar abrir o painel. É uma facilidade, não a única porta de entrada.

O cliente final acessa uma vitrine web leve e rápida, com botão "Pedir pelo WhatsApp" (link `wa.me`).

> **Princípio:** toda regra de negócio fica numa única camada de serviços (`catalog`). O painel e o bot são apenas interfaces diferentes que chamam os mesmos serviços. Nada é possível só por um dos lados.

---

## 2. Estratégia de Canal: Telegram primeiro, WhatsApp depois

Para reduzir custos e riscos durante o desenvolvimento, **o backoffice conversacional será desenvolvido e validado primeiro no Telegram**:

- A Bot API do Telegram é gratuita e oficial, sem risco de banimento de número e sem infraestrutura extra (não precisa da Evolution API).
- Ela suporta texto, áudio (voice) e fotos/álbuns, que é tudo o que o fluxo precisa.

**Só depois de o fluxo estar validado** (critérios na seção 11) o WhatsApp é integrado como um segundo canal.

Para que essa troca seja barata, **o núcleo do sistema não conhece o canal**. Cada canal é um _adapter_ que converte as mensagens recebidas para um formato normalizado e envia as respostas (seção 6). Integrar o WhatsApp deve ser só escrever um novo adapter, sem mexer em IA, catálogo ou storage.

> O botão "Pedir pelo WhatsApp" da vitrine (lado do **cliente final**) é só um link `wa.me` para o `telefone_pedidos` da loja. Ele não depende de gateway e funciona desde o primeiro dia. A estratégia acima vale apenas para o **backoffice do lojista**.

---

## 3. Arquitetura do Sistema

```text
[ Lojista ]
   ├── Telegram (fase de validação) ──┐
   ├── WhatsApp (pós-validação) ──────┤  Webhook (texto, áudio, foto)
   │                                  ▼
   │                    [ Channel Adapters ]
   │                    telegram/ (grammY)  |  whatsapp/ (Evolution API)
   │                                  │  InboundMessage normalizada
   │                                  ▼
   │                    [ Fila de Jobs: pg-boss (Postgres) ]
   │                    processamento em ordem por remetente
   │                                  │
   │                                  ▼
   └── Painel Admin (web) ──► [ API Backend: Node.js + Fastify + TypeScript ]
                                      │
                                      ├── Transcrição: Groq Whisper (fallback: Gemini)
                                      ├── Imagens: Sharp (WebP, máx. 1200px, quality 80)
                                      ├── Agente IA: Vercel AI SDK (tool calling + Zod)
                                      │     └── Roteador de provedores: Gemini Flash ⇄ Groq
                                      ├── Serviços de Catálogo (regras de negócio únicas)
                                      │
                                      ├── Storage S3-compatible: MinIO (VPS Oracle)
                                      │     └── https://s3.seudominio.com/catalogo-produtos/...
                                      │
                                      └── Banco & Auth: Supabase (PostgreSQL + RLS)

[ App Web: Next.js (App Router) + Tailwind ]
   ├── Vitrine pública:  /{slug}  e  /{slug}/p/{numero}   (SSR + Open Graph)
   └── Painel Admin:     /admin/...                        (Supabase Auth)
```

---

## 4. Stack Tecnológica

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime | Node.js 20+, TypeScript (strict) | |
| Backend | **Fastify** | Tipagem melhor, validação por schema, logger (pino) embutido |
| Fila | **pg-boss** | Roda sobre o próprio Postgres do Supabase, sem Redis extra |
| Bot Telegram | **grammY** | Biblioteca TS-first, suporta webhook |
| Gateway WhatsApp (depois) | Evolution API | Ver riscos na seção 12 |
| Imagens | `sharp` | Processamento em memória antes do upload |
| Storage | MinIO via `@aws-sdk/client-s3` (`forcePathStyle: true`) | Isolado atrás de uma interface `StorageService` |
| Banco & Auth | Supabase (`@supabase/supabase-js`), PostgreSQL + JSONB | Auth também atende o painel |
| IA | Vercel AI SDK (`ai`) + `@ai-sdk/google` (Gemini Flash) + `@ai-sdk/groq`, validação com `zod` | Custo baixo ou gratuito na fase de testes e primeiros clientes. Ver a seção 4.1. |
| Transcrição | Groq (`whisper-large-v3`), com Gemini como fallback | Mais barato e mais rápido para áudios curtos |
| Web (vitrine + painel) | **Next.js App Router** + Tailwind CSS + Lucide Icons | SSR é necessário para o **preview de link (Open Graph)** com foto e preço ao compartilhar no WhatsApp |

Estrutura em **monorepo** (pnpm workspaces): `apps/api`, `apps/web`, `packages/shared` (schemas Zod e tipos compartilhados).

### 4.1 Estratégia de Provedores de IA (Gemini Flash + Groq)

Durante o desenvolvimento, os testes e os primeiros clientes, o sistema usa **apenas Gemini Flash e Groq**, balanceando os dois para ficar dentro das cotas gratuitas ou baratas. Provedores mais caros só entram quando houver receita para pagar por eles.

O código do agente **nunca chama um provedor diretamente**. Ele pede um modelo ao roteador (`ai/providers.ts`), que decide qual usar:

- **Modo `fallback` (padrão):** usa o provedor primário (`AI_PRIMARY_PROVIDER`). Se ele responder com erro de cota (HTTP 429), timeout ou erro 5xx, a mesma requisição é refeita no outro provedor.
- **Modo `round-robin`:** alterna os provedores a cada mensagem, para dividir o consumo das cotas. A troca por falha continua valendo.
- **Pausa temporária:** um provedor que falhar 3 vezes seguidas fica fora por 5 minutos e todo o tráfego vai para o outro.
- **Transcrição de áudio:** Groq Whisper como primário. Se falhar, o áudio é enviado ao Gemini, que também aceita áudio.
- **Rastreio:** cada mensagem registra em `mensagens` qual provedor e modelo respondeu, os tokens usados e se houve fallback. Assim dá para comparar qualidade e custo dos dois antes de decidir onde investir.
- **Modelos configuráveis:** os nomes dos modelos vêm do `.env` (`AI_GEMINI_MODEL`, `AI_GROQ_MODEL`). Trocar ou adicionar um provedor (ex.: OpenAI no futuro) não pode exigir mudança nas tools nem no agente.

> **Atenção:** no Groq, só usar modelos com bom suporte a tool calling. Validar isso com o conjunto de frases de teste (seção 10) antes de ligar o round-robin, porque os dois provedores precisam extrair os dados com a mesma qualidade.

---

## 5. Modelagem de Dados (Supabase / Postgres)

Convenções: toda tabela tem `criado_em timestamptz default now()`. As tabelas mutáveis também têm `atualizado_em`.

### `lojas`

- `id`: uuid (PK)
- `nome`: text
- `slug`: text (unique; ex.: `loja-da-ana` → `vitrine.com/loja-da-ana`). Slugs reservados: `admin`, `api`, `p`, `login`.
- `telefone_pedidos`: text (número que recebe os pedidos dos clientes via `wa.me`)
- `ativa`: boolean (default true)
- `proximo_numero_produto`: int (default 1; gera o código curto dos produtos)

### `loja_membros` (acesso ao painel)

- `loja_id`: uuid (FK → lojas.id)
- `user_id`: uuid (FK → auth.users.id)
- `papel`: text (`dono` | `operador`)
- PK composta (`loja_id`, `user_id`)

### `canal_operadores` (acesso pelo bot)

- `id`: uuid (PK)
- `loja_id`: uuid (FK → lojas.id)
- `canal`: text (`telegram` | `whatsapp`)
- `identificador_externo`: text (Telegram `user.id` ou telefone/`remoteJid` do WhatsApp)
- `nome`: text (nullable)
- unique (`canal`, `identificador_externo`)

> Permite vários operadores por loja (ex.: dono e funcionária) e o mesmo lojista em dois canais.

### `produtos`

- `id`: uuid (PK)
- `loja_id`: uuid (FK → lojas.id)
- `numero`: int (código curto por loja, exibido como `#12`; unique (`loja_id`, `numero`))
- `nome`: text
- `descricao`: text (nullable)
- `preco_original`: numeric(10,2)
- `preco_promocional`: numeric(10,2) (nullable; `CHECK (preco_promocional < preco_original)`)
- `categoria`: text (nullable)
- `tamanhos`: jsonb (default `[]`; ex.: `["P", "M", "G"]`)
- `cores`: jsonb (default `[]`; ex.: `["Preto", "Azul"]`)
- `ativo`: boolean (default true)
- `excluido_em`: timestamptz (nullable; soft delete)

### `produto_imagens`

- `id`: uuid (PK)
- `loja_id`: uuid (FK → lojas.id; necessário para o RLS)
- `produto_id`: uuid (FK → produtos.id on delete cascade)
- `chave_storage`: text (chave do objeto no MinIO)
- `url`: text (URL pública)
- `ordem`: int (default 0)

### `mensagens` (idempotência + histórico)

- `id`: uuid (PK)
- `loja_id`: uuid (nullable; nulo quando o remetente não foi identificado)
- `canal`: text
- `id_externo`: text (ID da mensagem no canal; unique (`canal`, `id_externo`) evita processar reenvios)
- `remetente`: text
- `direcao`: text (`entrada` | `saida`)
- `tipo`: text (`texto` | `audio` | `imagem`)
- `conteudo`: text (texto ou transcrição)
- `status`: text (`recebida` | `processada` | `erro`)
- `provedor_ia`: text (nullable; ex.: `gemini`, `groq`)
- `modelo_ia`: text (nullable)
- `tokens_entrada` / `tokens_saida`: int (nullable)
- `usou_fallback`: boolean (default false)

### `conversas` (contexto curto do bot)

- `canal_operador_id`: uuid (PK, FK → canal_operadores.id)
- `ultimo_produto_id`: uuid (nullable; resolve "muda o preço **dela**")
- `atualizado_em`: timestamptz

### `midias_pendentes` (buffer de fotos)

- `id`: uuid (PK)
- `canal_operador_id`: uuid (FK)
- `chave_storage`: text (já convertida para WebP)
- `grupo_externo`: text (nullable; `media_group_id` do Telegram)
- `recebido_em`: timestamptz
- `consumida_em`: timestamptz (nullable)

### `acoes_pendentes` (confirmação de ações em lote)

- `id`: uuid (PK)
- `loja_id`: uuid (FK)
- `canal_operador_id`: uuid (nullable; nulo quando a ação vem do painel)
- `tipo`: text (ex.: `alterar_preco_lote`, `encerrar_promocao_lote`, `excluir_lote`)
- `parametros`: jsonb
- `produtos_afetados`: uuid[] (snapshot no momento da prévia)
- `status`: text (`aguardando` | `confirmada` | `cancelada` | `expirada`)
- `expira_em`: timestamptz (padrão: 10 minutos)

### Segurança (RLS)

- **Vitrine (anon):** leitura apenas de lojas `ativa = true` e produtos `ativo = true AND excluido_em IS NULL`, e das imagens desses produtos.
- **Painel (authenticated):** leitura e escrita limitadas às lojas em que o usuário está em `loja_membros`.
- **Backend (secret key, antiga service role):** **ignora o RLS**. O isolamento entre lojas no backend depende de **todo serviço de catálogo receber `loja_id` como parâmetro obrigatório** e filtrar por ele. Nenhuma query de catálogo pode existir sem esse filtro.

---

## 6. Camada de Canais (Adapters)

Todo canal implementa a mesma interface. O restante do sistema só conhece `InboundMessage`.

```ts
type InboundMessage = {
  canal: 'telegram' | 'whatsapp';
  idExterno: string;            // para idempotência
  remetente: string;            // Telegram user.id / telefone WhatsApp
  tipo: 'texto' | 'audio' | 'imagem';
  texto?: string;               // texto ou legenda
  grupoMidia?: string;          // media_group_id (álbuns)
  baixarMidia?: () => Promise<Buffer>;
  recebidoEm: Date;
};

interface ChannelAdapter {
  parseWebhook(req: FastifyRequest): InboundMessage[];
  verificarAssinatura(req: FastifyRequest): boolean;
  enviarTexto(destinatario: string, texto: string): Promise<void>;
}
```

**Telegram:**

- Webhook validado pelo header `X-Telegram-Bot-Api-Secret-Token`.
- Fotos chegam em vários tamanhos: usar o maior.
- Álbuns chegam como updates separados com o mesmo `media_group_id`.
- Áudio (voice) vem em OGG/Opus e é baixado via `getFile`.

**WhatsApp (Evolution API):**

- Validar a `apikey` do webhook.
- Identificar o remetente pelo `remoteJid`.

---

## 7. Regras de Negócio e Comportamento da IA

1. **Resposta imediata e processamento em fila:** o webhook valida a assinatura, grava a mensagem (descartando duplicatas pelo `id_externo`), enfileira um job no pg-boss e responde HTTP 200. Os jobs de um mesmo remetente são **processados em ordem**, porque foto, foto e depois áudio precisam ser tratados na sequência.
2. **Identificação do operador:** todo job resolve o `canal_operadores` pelo (`canal`, `remetente`). Se o remetente não estiver cadastrado, o sistema responde amigavelmente que o número ou conta não está vinculado a nenhuma loja e não executa nada.
3. **Buffer de fotos:** o lojista pode enviar de 1 a 5 fotos antes da legenda ou do áudio. Cada foto é convertida e salva em `midias_pendentes`. O próximo comando de cadastro **consome as mídias pendentes dos últimos 3 minutos** do mesmo operador. Se não chegar nenhum comando nesse tempo, o bot pergunta: _"Recebi 3 fotos. Quer cadastrar um produto com elas?"_. As mídias não consumidas são limpas após 24h.
4. **Conversão obrigatória de imagem:** nenhuma imagem é salva no formato original. Toda imagem passa pelo `sharp` (largura máxima 1200px, `.webp`, qualidade 80), venha do bot ou do painel.
5. **Ações unitárias são diretas:** cadastrar, editar, pausar, reativar e excluir **um** produto são executados imediatamente. O bot responde com o resumo e o link (ex.: _"✅ #12 Blusa Canelada, R$ 59,90, P/M/G. vitrine.com/loja-da-ana/p/12"_).
6. **Ações em lote exigem confirmação (bot e painel):** ações como _"aplicar 20% em todas as calças jeans"_, _"zerar promoções de natal"_ ou _"excluir coleção"_ **nunca** são executadas diretamente. O fluxo é:
   - A IA chama `preparar_acao_lote`, que cria uma `acoes_pendentes` com o snapshot dos produtos afetados.
   - O bot responde com o impacto: _"Isso altera o preço de 12 produtos (ex.: #3, #7, #9…). Confirma? (sim/não)"_.
   - Só uma confirmação explícita ("sim", "confirmo", "pode") **dentro de 10 minutos** executa a ação, sempre sobre o snapshot e não sobre uma nova busca.
   - Qualquer outro comando, ou o prazo expirado, cancela a ação pendente e o bot avisa.
7. **Desambiguação:** se uma referência ("pausa a blusa azul") corresponder a mais de um produto, o bot lista as opções com o código curto e pergunta qual é. Nunca escolhe sozinho.
8. **Contexto curto:** o último produto criado ou mencionado fica em `conversas.ultimo_produto_id`, para permitir correções como _"na verdade é 89,90"_.
9. **Falhas visíveis:** se a IA não entender, a transcrição falhar ou o upload der erro, o lojista **sempre** recebe uma resposta, com uma sugestão do que tentar. Nenhuma mensagem fica sem resposta.
10. **Limite de uso:** limite configurável de mensagens processadas pela IA por loja por dia, para controlar o custo.

### Tools do Agente

Todas as tools recebem o `loja_id` do contexto do operador (nunca da IA) e chamam os serviços de `catalog`.

| Tool | Tipo | Descrição |
|---|---|---|
| `criar_produto` | direta | Cria um produto com nome, preço, tamanhos, cores, categoria e descrição, e consome as mídias pendentes |
| `editar_produto` | direta | Altera campos de um produto (por `numero` ou pelo último do contexto) |
| `adicionar_fotos` | direta | Anexa as mídias pendentes a um produto existente |
| `pausar_produto` / `reativar_produto` | direta | Alterna `ativo` |
| `excluir_produto` | direta | Soft delete de **um** produto |
| `buscar_produtos` | leitura | Busca por nome, categoria ou faixa de preço (usada para desambiguar) |
| `resumo_loja` | leitura | Quantidade de produtos ativos, em promoção e link da vitrine |
| `preparar_acao_lote` | lote | Cria a ação pendente e retorna o impacto. **Não altera dados.** |
| `confirmar_acao` / `cancelar_acao` | lote | Executa ou descarta a ação pendente do operador |

---

## 8. Painel Administrativo

Vive em `apps/web` em `/admin`, com login pelo Supabase Auth (e-mail com magic link).

- **Leituras:** direto do Supabase com o RLS de `loja_membros`.
- **Escritas:** pela API backend (`/admin-api/*`), autenticadas com o JWT do Supabase, chamando os **mesmos serviços de catálogo** usados pelas tools. Isso garante as mesmas regras (conversão de imagem, confirmação de lote, validações).

Telas do MVP:

- Lista de produtos (busca, filtro por categoria e status)
- Criar/editar produto (upload e reordenação de fotos)
- Ações em lote com tela de prévia e confirmação
- Configurações da loja (nome, slug, telefone de pedidos)
- Operadores do bot (vincular contas Telegram/WhatsApp)

---

## 9. Estrutura de Pastas

```text
apps/
├── api/src/
│   ├── config/
│   │   ├── env.ts            # Schema Zod das variáveis de ambiente
│   │   ├── storage.ts        # S3Client apontando para o MinIO
│   │   └── supabase.ts       # Supabase client (secret key)
│   ├── modules/
│   │   ├── channels/
│   │   │   ├── types.ts      # InboundMessage, ChannelAdapter
│   │   │   ├── telegram/     # Adapter Telegram (grammY)
│   │   │   └── whatsapp/     # Adapter Evolution API (fase pós-validação)
│   │   ├── inbound/          # Webhook → idempotência → fila → pipeline
│   │   ├── jobs/             # Workers pg-boss e limpezas agendadas
│   │   ├── ai/
│   │   │   ├── agent.ts      # Orquestração LLM + tool calling
│   │   │   ├── providers.ts  # Roteador Gemini ⇄ Groq (fallback, round-robin, pausa)
│   │   │   ├── tools/        # Tools (Zod) → serviços de catalog
│   │   │   └── transcricao.ts
│   │   ├── catalog/          # Regras de negócio de produtos e ações em lote
│   │   ├── storage/          # Sharp + upload/exclusão no MinIO
│   │   ├── store/            # Lojas e operadores
│   │   └── admin-api/        # Rotas REST usadas pelo painel
│   ├── app.ts
│   └── server.ts
└── web/app/
    ├── [slug]/               # Vitrine da loja
    │   └── p/[numero]/       # Página do produto (Open Graph)
    └── admin/                # Painel administrativo
packages/
└── shared/                   # Schemas Zod e tipos compartilhados
direcao.md                    # Este documento (direção do projeto)
LOG.md                        # Diário de desenvolvimento (seção 10)
.env.example
.gitignore
```

---

## 10. Processo de Desenvolvimento

### Versionamento (Git)

- O repositório Git é criado **antes de qualquer código**, com um `.gitignore` que exclui `node_modules/`, `.env`, `.env.*` (exceto `.env.example`), `dist/`, `.next/` e arquivos de sistema.
- **Nunca commitar segredos.** Só o `.env.example` vai para o repositório, com valores de exemplo.
- Branch principal: `main`. Cada funcionalidade é feita numa branch própria (ex.: `feat/telegram-adapter`) e entra na `main` quando estiver funcionando.
- Mensagens de commit no padrão _Conventional Commits_, em português: `feat: cadastro de produto pelo Telegram`, `fix: buffer de fotos ignorava álbum`, `docs: atualiza direcao.md`.
- Commits pequenos e frequentes: um commit por passo concluído.
- Repositório remoto privado (GitHub) como backup a partir da Fase 0.

### Banco de Dados (Supabase CLI)

- Toda mudança de schema é uma migration em `supabase/migrations/`, criada com `pnpm db:new <nome>` e aplicada com `pnpm db:push`. **Nunca alterar tabelas pelo painel do Supabase**, para o repositório continuar sendo a fonte da verdade.
- Depois de cada migration, rodar `pnpm db:types` para regenerar os tipos TypeScript do banco.
- A CLI fica como dependência do projeto (`pnpm exec supabase`). O login e o vínculo com o projeto são feitos uma vez por máquina.

### Diário de Desenvolvimento (`LOG.md`)

Todo passo relevante (decisão, funcionalidade, mudança de estrutura, correção importante, troca de ferramenta) gera uma entrada no `LOG.md`, **no mesmo commit da mudança**. As entradas mais recentes ficam no topo.

Formato de cada entrada:

```markdown
## 2026-10-29: Título curto da ação

- **O que foi feito:** descrição objetiva da mudança.
- **Por quê:** motivo ou problema que levou à mudança.
- **Arquivos/Commits:** principais arquivos alterados ou hash do commit.
- **Pendências:** (opcional) o que ficou para depois.
```

O `direcao.md` diz **para onde** o projeto vai. O `LOG.md` diz **o que já foi feito e por quê**. Quando uma entrada do log mudar uma decisão do `direcao.md`, o `direcao.md` é atualizado no mesmo commit.

### Conjunto de frases de teste

Manter em `apps/api/test/frases.json` uma lista de mensagens reais de lojistas (texto e transcrições), com o resultado esperado de cada uma (ex.: _"vestido longo floral 129,90 tam P M"_ → nome, preço, tamanhos). Rodar essa lista contra **cada provedor de IA** sempre que mudar o prompt, as tools ou o modelo.

---

## 11. Escopo e Fases

### Fase 0: Fundação

- `git init`, `.gitignore`, `LOG.md` com a primeira entrada e repositório remoto privado.
- Monorepo, `env.ts`, schema do Supabase (migrations) com RLS, bucket no MinIO.
- Cadastro de lojas **manual** (via SQL ou seed) no início.

### Fase 1: Protótipo Base (Painel + Vitrine)

O sistema precisa funcionar **por completo pelo painel** antes de ter IA ou bot. Isso valida o modelo de dados, os serviços de catálogo e o storage sem depender de provedores externos.

- Serviços de `catalog` e `storage` (conversão WebP + MinIO) com `loja_id` obrigatório.
- Painel administrativo com login, CRUD de produtos (fotos, preços, promoção, tamanhos, cores, categoria), pausar/reativar/excluir e configurações da loja.
- Vitrine `/{slug}` responsiva, com grid, filtro por categoria e botão "Pedir no WhatsApp" (`wa.me` com o nome do produto pré-preenchido).
- Página do produto (`/{slug}/p/{numero}`) com Open Graph.

### Fase 2: IA + Telegram

Só começa com a Fase 1 funcionando. O bot passa a **chamar os serviços que já existem**, sem criar regras novas.

- Contas e chaves: Gemini (Google AI Studio), Groq e bot do Telegram (@BotFather).
- Roteador de provedores de IA (Gemini ⇄ Groq) e conjunto de frases de teste.
- Receber foto, texto e áudio pelo Telegram, com fila, idempotência e identificação do operador.
- Buffer de fotos, transcrição de áudio e extração dos dados via IA.
- Tools diretas: criar, editar, adicionar fotos, pausar/reativar, excluir e buscar, sobre os mesmos serviços usados pelo painel.
- Vincular operadores do Telegram pelo painel.

### Fase 3: Ações em Lote

- Tela de prévia e confirmação no painel.
- `preparar_acao_lote` e `confirmar_acao` no bot.
- Promoções em lote e exclusão de coleção.

### Fase 4: Integração WhatsApp

Começa **apenas quando os critérios de validação abaixo forem atingidos no Telegram**.

- Subir a Evolution API e implementar `channels/whatsapp/`.
- Vincular operadores pelo telefone.
- Nenhuma mudança esperada em `ai/`, `catalog/` ou `storage/`. Se for preciso mudar algo nessas pastas, a abstração de canal falhou e deve ser corrigida.

### Critérios de validação (Telegram → WhatsApp)

- [ ] Pelo menos 3 lojistas reais usando o bot por 2 semanas.
- [ ] Mais de 90% dos cadastros por mensagem corretos sem precisar de correção manual no painel.
- [ ] Cadastro de um produto (fotos + áudio) em menos de 1 minuto, do envio ao link.
- [ ] Nenhuma ação em lote executada sem confirmação.
- [ ] Custo médio de IA por produto cadastrado medido e aceitável (comparando Gemini e Groq).

### Fora do escopo do MVP

- Estoque e variações combinadas (ex.: "G Preto esgotado"). Por ora, `tamanhos` e `cores` são independentes.
- Pagamento online e carrinho.
- Cobrança/assinatura dos lojistas e autocadastro de lojas.

---

## 12. Riscos e Pontos de Atenção

- **Cotas gratuitas de IA:** os limites de uso do Gemini e do Groq podem mudar sem aviso. O roteador com fallback reduz o impacto, e o rastreio por mensagem mostra quando for hora de migrar para um plano pago.

- **Evolution API (não oficial):** se o número do bot for banido, **todos os lojistas** perdem o canal. Mitigações: o painel continua funcionando, evitar comportamento de spam (só responder a quem escreveu) e manter a WhatsApp Cloud API oficial como plano B. O adapter isolado facilita essa troca.
- **MinIO na VPS Oracle:** não tem CDN e o backup é responsabilidade nossa, além de a instância free poder ser reclamada. É obrigatório ter **backup agendado do bucket**. Como o storage fica atrás de `StorageService`, migrar para o Supabase Storage ou o Cloudflare R2 é uma troca de configuração.
- **Service role no backend:** ver a seção 5 (Segurança). Todo serviço de catálogo exige `loja_id`.
- **Segredos no Git:** uma chave commitada por engano deve ser considerada vazada e trocada imediatamente, mesmo que o commit seja apagado.
- **Observabilidade:** logs estruturados (pino) com `mensagem_id` e `loja_id` em todo job, para rastrear o caminho mensagem → IA → resultado.
- **LGPD:** documentar quais dados dos lojistas são guardados (telefone, mensagens, áudios transcritos), por quanto tempo (sugestão: `mensagens` por 90 dias) e como excluir tudo de uma loja a pedido.

---

## 13. Variáveis de Ambiente (`.env.example`)

```env
PORT=3333
NODE_ENV=development
PUBLIC_WEB_URL=https://vitrine.seudominio.com

# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...          # só na API, nunca no front
SUPABASE_PUBLISHABLE_KEY=sb_publishable_... # usada pelo app web
DATABASE_URL=postgresql://...        # conexão direta usada pelo pg-boss

# Storage (MinIO na VPS)
S3_ENDPOINT=https://s3.seudominio.com
S3_ACCESS_KEY=seu_access_key
S3_SECRET_KEY=seu_secret_key
S3_BUCKET=catalogo-produtos
S3_PUBLIC_URL=https://s3.seudominio.com/catalogo-produtos

# Canais
CHANNELS_ENABLED=telegram            # depois: telegram,whatsapp
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_WEBHOOK_SECRET=gere_um_valor_aleatorio

# WhatsApp (Fase 4)
# EVOLUTION_API_URL=https://evolution.seudominio.com
# EVOLUTION_API_KEY=sua_chave_evolution
# EVOLUTION_INSTANCE_NAME=catalogo_bot

# IA: provedores (ver seção 4.1)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
GROQ_API_KEY=gsk_...
AI_GEMINI_MODEL=nome-do-modelo-gemini-flash   # conferir o nome atual no Google AI Studio
AI_GROQ_MODEL=nome-do-modelo-groq             # escolher um com bom suporte a tool calling
AI_GROQ_TRANSCRIPTION_MODEL=whisper-large-v3
AI_PRIMARY_PROVIDER=gemini                    # gemini | groq
AI_ROUTING_MODE=fallback                      # fallback | round-robin
AI_DAILY_MESSAGE_LIMIT_PER_STORE=300
```
