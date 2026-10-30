// Roda o conjunto de frases (test/frases.json) contra CADA provedor de IA configurado e compara
// se a IA escolheu a ferramenta e os dados certos. Não altera nada no banco: as ferramentas são simuladas.
// Uso: pnpm --filter @catalogo/api bot:frases      (direcao.md, seção 10)
import { readFileSync } from 'node:fs';
import { generateText, isStepCount, type ToolSet } from 'ai';
import { instrucoes } from '../src/modules/ai/agent.js';
import { modeloDoProvedor, type Provedor } from '../src/modules/ai/providers.js';
import { criarTools } from '../src/modules/ai/tools/index.js';

type Caso = {
  frase: string;
  fotos_pendentes?: number;
  observacao?: string;
  esperado: { tool?: string; args?: Record<string, unknown>; nenhuma_alteracao?: boolean };
};
const casos: Caso[] = JSON.parse(readFileSync(new URL('../test/frases.json', import.meta.url), 'utf8'));
const ALTERAM = new Set(['criar_produto', 'editar_produto', 'adicionar_fotos', 'pausar_produto', 'reativar_produto', 'excluir_produto']);

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
function confere(esperado: unknown, recebido: unknown): boolean {
  if (Array.isArray(esperado)) {
    const lista = Array.isArray(recebido) ? recebido.map(normalizar) : [];
    return esperado.every((e) => lista.includes(normalizar(e)));
  }
  if (typeof esperado === 'number') return typeof recebido === 'number' && Math.abs(recebido - esperado) < 0.001;
  return normalizar(esperado) === normalizar(recebido);
}

function avaliar(caso: Caso, chamadas: { tool: string; args: Record<string, unknown> }[]) {
  const { esperado } = caso;
  if (esperado.nenhuma_alteracao) {
    const alterou = chamadas.find((c) => ALTERAM.has(c.tool));
    return alterou ? `chamou ${alterou.tool} (não devia alterar nada)` : null;
  }
  const primeira = chamadas[0];
  if (!primeira) return `nenhuma ferramenta (esperado ${esperado.tool})`;
  if (primeira.tool !== esperado.tool) return `chamou ${primeira.tool} (esperado ${esperado.tool})`;
  for (const [campo, valor] of Object.entries(esperado.args ?? {})) {
    if (!confere(valor, primeira.args[campo])) return `${campo}=${JSON.stringify(primeira.args[campo])} (esperado ${JSON.stringify(valor)})`;
  }
  return null;
}

const provedores = (['gemini', 'groq'] as Provedor[]).map(modeloDoProvedor).filter((m) => m !== null);
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
  for (const caso of casos) {
    const chamadas: { tool: string; args: Record<string, unknown> }[] = [];
    const inicio = Date.now();
    let problema: string | null;
    try {
      const r = await generateText({
        model: p.modelo,
        instructions: instrucoes({
          loja: { id: '-', nome: 'Loja Teste', slug: 'loja-teste' },
          operadorId: '-',
          texto: caso.frase,
          historico: [],
          fotosPendentes: caso.fotos_pendentes ?? 0,
          ultimoProduto: null,
        }),
        messages: [{ role: 'user', content: caso.frase }],
        tools: toolsSimuladas(chamadas),
        stopWhen: isStepCount(4),
        maxRetries: 1,
      });
      tokens += (r.totalUsage.inputTokens ?? 0) + (r.totalUsage.outputTokens ?? 0);
      problema = avaliar(caso, chamadas);
    } catch (erro) {
      problema = `erro: ${erro instanceof Error ? erro.message.slice(0, 120) : String(erro)}`;
    }
    tempo += Date.now() - inicio;
    if (!problema) acertos++;
    console.log(`${problema ? '❌' : '✅'} ${caso.frase}${problema ? `\n     → ${problema}` : ''}`);
  }
  const linha = `${p.provedor} (${p.nomeModelo}): ${acertos}/${casos.length} certas · ${tokens} tokens · ${Math.round(tempo / casos.length)} ms/frase`;
  resumo.push(linha);
}

console.log(`\n=== Resumo ===\n${resumo.join('\n')}`);
