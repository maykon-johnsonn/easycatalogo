# 📓 Diário de Desenvolvimento

Registro de cada ação relevante do projeto: o que foi feito, quando e por quê.
Entradas mais recentes no topo. Formato e regras na seção 10 do [direcao.md](direcao.md).

---

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
