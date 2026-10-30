// Roda o conjunto de frases (test/frases.json) contra CADA provedor de IA configurado e compara
// se a IA escolheu a ferramenta e os dados certos. Não altera nada no banco: as ferramentas são simuladas.
// Uso: pnpm --filter @catalogo/api bot:frases [gemini|groq]      (direcao.md, seção 10)
// Nos planos gratuitos o limite é por minuto: ao bater nele, o script espera e repete a frase.
// Usa o mesmo fluxo do bot: atalhos sem IA (⚡) e, no resto, o agente com confirmação pelo código.
// Para testar outro modelo do Groq: AI_GROQ_MODEL=openai/gpt-oss-20b pnpm --filter @catalogo/api bot:frases groq
import { readFileSync } from 'node:fs';
import type { ToolSet } from 'ai';
import { executarAgente } from '../src/modules/ai/agent.js';
import { reconhecerAtalho } from '../src/modules/ai/atalhos.js';
import { FERRAMENTAS_QUE_ALTERAM as ALTERAM } from '../src/modules/ai/tools/index.js';
import { modeloDoProvedor, type Provedor } from '../src/modules/ai/providers.js';
import { criarTools } from '../src/modules/ai/tools/index.js';

type Caso = {
  frase: string;
  fotos_pendentes?: number;
  /** Simula um produto já em conversa, ex.: { "numero": 1, "nome": "Bolsa de Crochê" }. */
  ultimo_produto?: { numero: number; nome: string; fotos?: number };
  observacao?: string;
  /** "tambem": outras ferramentas que precisam ser chamadas na mesma mensagem (pedidos com várias ações). */
  esperado: { tool?: string; args?: Record<string, unknown>; tambem?: string[]; nenhuma_alteracao?: boolean };
};
const casos: Caso[] = JSON.parse(readFileSync(new URL(process.env.FRASES_ARQUIVO ?? '../test/frases.json', import.meta.url), 'utf8'));

/** Mesmas descrições e schemas das tools reais, mas sem tocar no banco. */
function toolsSimuladas(chamadas: { tool: string; args: Record<string, unknown> }[]): ToolSet {
  const reais = criarTools({ lojaId: '-', lojaSlug: 'loja-teste', operadorId: '-', efeitos: [] });
  return Object.fromEntries(
    Object.entries(reais).map(([nome, t]) => [
      nome,
      {
        ...t,
        execute: async (args: Record<string, unknown>) => {
          chamadas.push({ tool: nome, args });
          if (nome === 'buscar_produtos') {
            return { total: 2, produtos: [{ numero: 4, nome: 'Blusa Azul Lisa', preco: 'R$ 49,90' }, { numero: 9, nome: 'Blusa Azul Listrada', preco: 'R$ 59,90' }] };
          }
          if (nome === 'resumo_loja') return { total: 20, ativos: 18, pausados: 2, em_promocao: 3, link_vitrine: 'http://localhost:3000/loja-teste' };
          return { numero: (args.numero as number) ?? 21, nome: (args.nome as string) ?? 'Produto', link: 'http://localhost:3000/loja-teste/p/21' };
        },
      },
    ]),
  );
}

const normalizar = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : v);
/** No JSON, "Preta|Preto" aceita qualquer uma das formas. */
const bate = (esperado: unknown, recebido: unknown) =>
  typeof esperado === 'string' ? esperado.split('|').some((e) => normalizar(e) === normalizar(recebido)) : normalizar(esperado) === normalizar(recebido);
function confere(esperado: unknown, recebido: unknown): boolean {
  if (Array.isArray(esperado)) {
    const lista = Array.isArray(recebido) ? recebido : [];
    return esperado.every((e) => lista.some((r) => bate(e, r)));
  }
  if (typeof esperado === 'number') return typeof recebido === 'number' && Math.abs(recebido - esperado) < 0.001;
  return bate(esperado, recebido);
}

// Limite por minuto: vale esperar. Limite diário (ex.: "tokens per day"): não adianta, falha direto.
const limiteDeUso = (erro: unknown) =>
  erro instanceof Error && /quota|rate limit|resource.?exhausted|429/i.test(erro.message) && !/per day|PerDay/i.test(erro.message);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function avaliar(caso: Caso, chamadas: { tool: string; args: Record<string, unknown> }[]) {
  const { esperado } = caso;
  if (esperado.nenhuma_alteracao) {
    const alterou = chamadas.find((c) => ALTERAM.has(c.tool));
    return alterou ? `chamou ${alterou.tool} (não devia alterar nada)` : null;
  }
  const principal = chamadas.find((c) => c.tool === esperado.tool);
  if (!principal) return `não chamou ${esperado.tool} (chamou: ${chamadas.map((c) => c.tool).join(", ") || "nenhuma"})`;
  for (const [campo, valor] of Object.entries(esperado.args ?? {})) {
    if (!confere(valor, principal.args[campo])) return `${campo}=${JSON.stringify(principal.args[campo])} (esperado ${JSON.stringify(valor)})`;
  }
  const faltou = (esperado.tambem ?? []).find((t) => !chamadas.some((c) => c.tool === t));
  return faltou ? `não chamou ${faltou}` : null;
}

const so = process.argv[2] as Provedor | undefined; // ex.: bot:frases groq
const provedores = (['gemini', 'groq'] as Provedor[])
  .filter((p) => !so || p === so)
  .map(modeloDoProvedor)
  .filter((m) => m !== null);
if (!provedores.length) {
  console.log('Nenhum provedor de IA configurado. Preencha GOOGLE_GENERATIVE_AI_API_KEY e/ou GROQ_API_KEY no apps/api/.env.');
  process.exit(0);
}

const resumo: string[] = [];
for (const p of provedores) {
  console.log(`\n=== ${p.provedor} (${p.nomeModelo}) ===`);
  let acertos = 0;
  let tokens = 0;
  let tempo = 0;
  let atalhos = 0;
  let comIa = 0;
  for (const caso of casos) {
    const chamadas: { tool: string; args: Record<string, unknown> }[] = [];
    let inicio = Date.now();
    let problema: string | null = null;
    let resposta = '';
    const atalho = caso.fotos_pendentes ? null : reconhecerAtalho(caso.frase);
    if (atalho) {
      chamadas.push({ tool: atalho.tool, args: atalho.args });
      problema = avaliar(caso, chamadas);
      atalhos++;
      if (!problema) acertos++;
      console.log(`${problema ? '❌' : '⚡'} ${caso.frase}  (atalho, sem IA)${problema ? `\n     → ${problema}` : ''}`);
      continue;
    }
    for (let tentativa = 1; ; tentativa++) {
    try {
      const r = await executarAgente(
        p.modelo,
        {
          loja: { id: '-', nome: 'Loja Teste', slug: 'loja-teste' },
          operadorId: '-',
          texto: caso.frase,
          historico: [],
          fotosPendentes: caso.fotos_pendentes ?? 0,
          ultimoProduto: caso.ultimo_produto ?? null,
        },
        toolsSimuladas(chamadas),
        [],
      );
      tokens += r.tokensEntrada + r.tokensSaida;
      resposta = r.texto;
      comIa++;
      problema = avaliar(caso, chamadas);
      break;
    } catch (erro) {
      if (limiteDeUso(erro) && tentativa < 4) {
        console.log(`   ⏳ limite por minuto do ${p.provedor}, aguardando 30s...`);
        await esperar(30_000);
        chamadas.length = 0;
        inicio = Date.now();
        continue;
      }
      problema = `erro: ${erro instanceof Error ? erro.message.slice(0, 120) : String(erro)}`;
      break;
    }
    }
    tempo += Date.now() - inicio;
    if (!problema) acertos++;
    console.log(`${problema ? '❌' : '✅'} ${caso.frase}${problema ? `\n     → ${problema}` : ''}`);
    if (problema && chamadas.length) console.log(`     ferramentas: ${JSON.stringify(chamadas)}`);
    if (problema && resposta) console.log(`     resposta: ${resposta.replace(/\n/g, ' ⏎ ').slice(0, 300)}`);
  }
  const linha =
    `${p.provedor} (${p.nomeModelo}): ${acertos}/${casos.length} certas · ${atalhos} por atalho · ` +
    `${tokens} tokens (${Math.round(tokens / Math.max(comIa, 1))}/frase com IA) · ${Math.round(tempo / Math.max(comIa, 1))} ms/frase com IA`;
  resumo.push(linha);
}

console.log(`\n=== Resumo ===\n${resumo.join('\n')}`);
