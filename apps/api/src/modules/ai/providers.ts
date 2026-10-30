import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { APICallError, RetryError, type LanguageModel } from 'ai';
import { env } from '../../config/env.js';

// Roteador de provedores (direcao.md, seção 4.1). O agente nunca escolhe o provedor:
// pede ao roteador, que aplica fallback, round-robin e pausa de quem está falhando.

export type Provedor = 'gemini' | 'groq';
export type ModeloEscolhido = { provedor: Provedor; nomeModelo: string; modelo: LanguageModel };

const FALHAS_PARA_PAUSAR = 3;
const PAUSA_MS = 5 * 60 * 1000;
const PAUSA_MAXIMA_MS = 24 * 60 * 60 * 1000;

export class IaIndisponivel extends Error {
  constructor(message = 'Nenhum provedor de IA configurado') {
    super(message);
  }
}

/** Erro depois de a IA já ter alterado dados: refazer em outro provedor duplicaria a ação. */
export class FalhaAposEfeitos extends Error {
  constructor(readonly causa: unknown) {
    super('Falha da IA depois de executar ações');
  }
}

const google = env.GOOGLE_GENERATIVE_AI_API_KEY ? createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY }) : null;
export const groq = env.GROQ_API_KEY ? createGroq({ apiKey: env.GROQ_API_KEY }) : null;

let modelos: Partial<Record<Provedor, ModeloEscolhido>> = {
  ...(google && { gemini: { provedor: 'gemini', nomeModelo: env.AI_GEMINI_MODEL, modelo: google(env.AI_GEMINI_MODEL) } }),
  ...(groq && { groq: { provedor: 'groq', nomeModelo: env.AI_GROQ_MODEL, modelo: groq(env.AI_GROQ_MODEL) } }),
};

const saude: Record<Provedor, { falhasSeguidas: number; pausadoAte: number }> = {
  gemini: { falhasSeguidas: 0, pausadoAte: 0 },
  groq: { falhasSeguidas: 0, pausadoAte: 0 },
};
let proximoRoundRobin = 0;

/** Só para testes: troca os modelos reais por modelos simulados. */
export function definirModelosParaTeste(substitutos: Partial<Record<Provedor, ModeloEscolhido>>) {
  modelos = substitutos;
  for (const s of Object.values(saude)) Object.assign(s, { falhasSeguidas: 0, pausadoAte: 0 });
}

export const iaConfigurada = () => Object.keys(modelos).length > 0;

export const modeloDoProvedor = (p: Provedor) => modelos[p] ?? null;

/** Ordem de tentativa para esta mensagem. */
function ordemDeTentativa(): ModeloEscolhido[] {
  const secundario: Provedor = env.AI_PRIMARY_PROVIDER === 'gemini' ? 'groq' : 'gemini';
  let ordem: Provedor[] = [env.AI_PRIMARY_PROVIDER, secundario];
  if (env.AI_ROUTING_MODE === 'round-robin' && proximoRoundRobin++ % 2 === 1) ordem = ordem.reverse();

  const configurados = ordem.filter((p) => modelos[p]);
  const agora = Date.now();
  const disponiveis = configurados.filter((p) => saude[p].pausadoAte <= agora);
  // Se todos estiverem pausados, tenta mesmo assim: melhor uma chance do que falhar direto.
  return (disponiveis.length ? disponiveis : configurados).map((p) => modelos[p]!);
}

function registrarSucesso(p: Provedor) {
  saude[p].falhasSeguidas = 0;
}

/**
 * Quando o provedor responde 429 (limite de uso), quanto tempo ele pede para esperar.
 * Ex.: a cota diária grátis do Gemini volta em horas; tentar antes só atrasa a resposta.
 */
function pausaPedida(erro: unknown): number | null {
  if (erro instanceof FalhaAposEfeitos) erro = erro.causa;
  if (RetryError.isInstance(erro)) erro = erro.lastError;
  if (!APICallError.isInstance(erro) || erro.statusCode !== 429) return null;
  const header = Number(erro.responseHeaders?.['retry-after']);
  const doCorpo = /"retryDelay":s*"(d+(?:.d+)?)s"/.exec(erro.responseBody ?? '')?.[1];
  const segundos = header > 0 ? header : doCorpo ? Number(doCorpo) : 60;
  return Math.min(Math.max(segundos * 1000, 60_000), PAUSA_MAXIMA_MS);
}

function registrarFalha(p: Provedor, erro: unknown) {
  const s = saude[p];
  const pausa = pausaPedida(erro);
  if (pausa) {
    s.pausadoAte = Date.now() + pausa;
    s.falhasSeguidas = 0;
    return;
  }
  s.falhasSeguidas += 1;
  if (s.falhasSeguidas >= FALHAS_PARA_PAUSAR) {
    s.pausadoAte = Date.now() + PAUSA_MS;
    s.falhasSeguidas = 0;
  }
}

export type ResultadoRoteado<T> = { resultado: T; provedor: Provedor; nomeModelo: string; usouFallback: boolean };

/**
 * Executa a tarefa no provedor da vez; se falhar, tenta o próximo.
 * A tarefa lança `FalhaAposEfeitos` quando já alterou dados: aí não há nova tentativa.
 */
export async function comRoteador<T>(tarefa: (m: ModeloEscolhido) => Promise<T>): Promise<ResultadoRoteado<T>> {
  const ordem = ordemDeTentativa();
  if (!ordem.length) throw new IaIndisponivel();

  let ultimoErro: unknown;
  for (const [i, escolhido] of ordem.entries()) {
    try {
      const resultado = await tarefa(escolhido);
      registrarSucesso(escolhido.provedor);
      return { resultado, provedor: escolhido.provedor, nomeModelo: escolhido.nomeModelo, usouFallback: i > 0 };
    } catch (erro) {
      registrarFalha(escolhido.provedor, erro);
      if (erro instanceof FalhaAposEfeitos) throw erro;
      ultimoErro = erro;
    }
  }
  throw ultimoErro;
}
