import { generateText, isStepCount, type LanguageModel, type ModelMessage, type ToolSet } from 'ai';
import { reconhecerAtalho } from './atalhos.js';
import { comRoteador, FalhaAposEfeitos, type Provedor } from './providers.js';
import {
  confirmacao,
  criarTools,
  executarTool,
  FERRAMENTAS_QUE_ALTERAM,
  resultadoComErro,
  type ContextoTools,
} from './tools/index.js';

export type EntradaAgente = {
  loja: { id: string; nome: string; slug: string };
  operadorId: string;
  texto: string;
  /** Últimas trocas da conversa, da mais antiga para a mais nova. */
  historico: ModelMessage[];
  fotosPendentes: number;
  ultimoProduto: { numero: number; nome: string; fotos?: number } | null;
};

export type RespostaAgente = {
  texto: string;
  provedor: Provedor | null;
  modelo: string | null;
  usouFallback: boolean;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  efeitos: string[];
};

export function instrucoes(e: EntradaAgente) {
  return `Você é o assistente da loja "${e.loja.nome}" num catálogo digital. Quem fala com você é o(a) lojista, pelo celular.
Seu trabalho: cadastrar e gerenciar os produtos do catálogo usando as ferramentas. Nada além disso.

Regras:
- Responda em português do Brasil, curto e direto, sem cumprimentar. Texto simples: nada de markdown (sem asteriscos, sem negrito), sem tabelas. Pode usar poucos emojis.
- Use as ferramentas para qualquer ação. Nunca diga que fez algo sem ter chamado a ferramenta e recebido sucesso.
- Número solto falando de produto ("a 3", "da 12", "o 7") é o código: #3, #12, #7.
- "Ela", "dele", "essa", "o mesmo" ou um pedido sem produto citado se referem ao último produto da conversa (abaixo): chame a ferramenta direto, sem o número e sem buscar.
- Um pedido pode ter várias ações ("tira a foto antiga e muda a cor"): chame todas as ferramentas necessárias de uma vez, na mesma resposta.
- Tudo o que muda num produto existente, inclusive fotos (anexar, remover, capa), vai numa única chamada de editar_produto.
- Nunca sugira excluir e recadastrar um produto para contornar algo. Se não houver ferramenta para o pedido, diga que pode ser feito pelo painel.
- Para cadastrar, o mínimo é nome e preço. Se faltar o preço, pergunte. Nunca invente preço, tamanho ou cor.
- Valores: "59,90" ou "59 e 90" = 59.9. "de 80 por 60" = preço 80 e promocional 60.
- Depois de uma ação bem-sucedida, o sistema envia a confirmação sozinho: não escreva confirmação.
- Se a ferramenta devolver "erro", explique o problema ao lojista com suas palavras e diga como resolver.
- Se a referência for ambígua ("a blusa azul") e houver mais de um produto possível, use buscar_produtos, liste as opções com o código (#) e pergunte qual. Nunca escolha sozinho.
- Excluir só com pedido claro e com o código do produto.
- Ações em vários produtos de uma vez (ex.: "20% em todas as calças", "apagar a coleção") ainda não estão disponíveis por aqui: explique que por enquanto devem ser feitas uma a uma ou pelo painel.
- Se a mensagem não tiver relação com o catálogo, diga gentilmente o que você sabe fazer.

Situação agora:
- Vitrine da loja: /${e.loja.slug}
- Fotos recebidas aguardando um produto: ${e.fotosPendentes}${e.fotosPendentes ? ' (serão anexadas ao criar o produto ou com adicionar_fotos)' : ''}
- Último produto da conversa: ${e.ultimoProduto ? `#${e.ultimoProduto.numero} ${e.ultimoProduto.nome}${e.ultimoProduto.fotos != null ? ` (${e.ultimoProduto.fotos} foto(s))` : ''}` : 'nenhum'}`;
}

/** O Telegram (e o WhatsApp) mostram markdown cru: "**Vermelho**" chegaria com os asteriscos. */
export function limparTexto(texto: string) {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

type Passo = { toolCalls: { toolName: string }[]; toolResults: { toolName: string; output: unknown }[] };

/**
 * Passo em que a IA só chamou ferramentas de alteração e todas deram certo. Num pedido simples
 * o agente para aí: a confirmação é montada pelo código, sem a segunda chamada à IA.
 */
function soAcoesBemSucedidas(passo: Passo | undefined) {
  if (!passo?.toolCalls.length || !passo.toolCalls.every((c) => FERRAMENTAS_QUE_ALTERAM.has(c.toolName))) return false;
  return passo.toolResults.length === passo.toolCalls.length && !passo.toolResults.some((r) => resultadoComErro(r.output));
}

const alterouAlgo = (passos: Passo[]) =>
  passos.some((p) => p.toolResults.some((r) => FERRAMENTAS_QUE_ALTERAM.has(r.toolName) && !resultadoComErro(r.output)));

/** Texto com cara de confirmação ("✅") sem nenhuma alteração feita: a IA inventou a ação. */
const confirmouSemFazer = (r: { text: string; steps: Passo[] }) => !alterouAlgo(r.steps) && r.text.includes('✅');

const LEMBRETE_SEM_ACAO =
  '[aviso do sistema] Sua resposta confirma uma alteração, mas nenhuma ferramenta foi chamada, então nada mudou. ' +
  'Se o lojista pediu uma alteração, chame a ferramenta agora. Se não, responda sem usar ✅.';

const NAO_CONSEGUI_ALTERAR =
  'Não consegui fazer essa alteração. Pode repetir o pedido com o código do produto? Ex.: "muda a cor da #1 para vermelho".';
const NAO_ENTENDI = 'Não consegui entender. Pode repetir de outro jeito? Ex.: "Blusa canelada, 59,90, P M G, preta".';

/**
 * Pedido que pode ter mais de uma ação ("pausa a 3 e a 4", "muda o preço e também a cor").
 * Nele a IA ganha mais um passo depois das ações, caso tenha feito uma de cada vez.
 */
const pareceTerVariasAcoes = (texto: string) => /\s(e|tamb[eé]m|depois)\s|;/i.test(texto);

export type ResultadoExecucao = { texto: string; tokensEntrada: number; tokensSaida: number };

/** Uma rodada do agente num modelo. Usada pelo bot (via roteador) e pelas frases de teste. */
export async function executarAgente(
  modelo: LanguageModel,
  e: EntradaAgente,
  tools: ToolSet,
  efeitos: string[],
): Promise<ResultadoExecucao> {
  let tokensEntrada = 0;
  let tokensSaida = 0;
  const pararAposAcao = !pareceTerVariasAcoes(e.texto);
  const gerar = async (messages: ModelMessage[]) => {
    const r = await generateText({
      model: modelo,
      instructions: instrucoes(e),
      messages,
      tools,
      stopWhen: [isStepCount(6), ({ steps }) => pararAposAcao && soAcoesBemSucedidas(steps.at(-1))],
      maxRetries: 0, // quem refaz em outro provedor é o roteador
      timeout: 60_000,
    });
    tokensEntrada += r.totalUsage.inputTokens ?? 0;
    tokensSaida += r.totalUsage.outputTokens ?? 0;
    return r;
  };

  try {
    const mensagens: ModelMessage[] = [...e.historico, { role: 'user', content: e.texto }];
    // Às vezes o modelo monta parâmetros fora do schema e o provedor recusa a chamada. Se nada foi
    // alterado ainda, vale uma nova tentativa no mesmo modelo antes de cair para o outro provedor.
    let r = await gerar(mensagens).catch((erro: unknown) => {
      const invalida = erro instanceof Error && /tool call validation failed|tool_use_failed/i.test(erro.message);
      if (!invalida || efeitos.length) throw erro;
      return gerar(mensagens);
    });
    if (confirmouSemFazer(r)) {
      // Uma chance de corrigir: a IA vê a própria resposta e o aviso.
      r = await gerar([...mensagens, ...r.response.messages, { role: 'user', content: LEMBRETE_SEM_ACAO }]);
      if (confirmouSemFazer(r)) return { texto: NAO_CONSEGUI_ALTERAR, tokensEntrada, tokensSaida };
    }
    // Toda ação que deu certo é confirmada pelo código. O texto da IA só entra se não houve ação
    // ou se alguma deu erro (aí ela explica o que faltou).
    const resultados = r.steps.flatMap((p) => p.toolResults).filter((x) => FERRAMENTAS_QUE_ALTERAM.has(x.toolName));
    const confirmadas = resultados.filter((x) => !resultadoComErro(x.output)).map((x) => confirmacao(x.toolName, x.output));
    const houveErro = resultados.some((x) => resultadoComErro(x.output));
    const textoIa = limparTexto(r.text);
    const texto = !confirmadas.length
      ? textoIa
      : [confirmadas.join('\n\n'), houveErro ? textoIa : ''].filter(Boolean).join('\n\n');
    return { texto: texto || NAO_ENTENDI, tokensEntrada, tokensSaida };
  } catch (erro) {
    if (efeitos.length) throw new FalhaAposEfeitos(erro);
    throw erro;
  }
}

export async function responder(e: EntradaAgente): Promise<RespostaAgente> {
  const ctx: ContextoTools = { lojaId: e.loja.id, lojaSlug: e.loja.slug, operadorId: e.operadorId, efeitos: [] };
  const tools = criarTools(ctx);
  const semIa = { provedor: null, usouFallback: false, tokensEntrada: 0, tokensSaida: 0 };

  // Com fotos aguardando, quem decide o destino delas é a IA; sem fotos, comandos fixos vão direto.
  const atalho = e.fotosPendentes ? null : reconhecerAtalho(e.texto);
  if (atalho) {
    const saida = await executarTool(tools, atalho.tool, atalho.args);
    const texto = resultadoComErro(saida)
      ? `⚠️ ${(saida as { erro?: string } | null)?.erro ?? 'Não consegui fazer isso.'}`
      : confirmacao(atalho.tool, saida);
    return { ...semIa, texto, modelo: 'atalho', efeitos: ctx.efeitos };
  }

  try {
    const r = await comRoteador(({ modelo }) => executarAgente(modelo, e, tools, ctx.efeitos));
    return {
      texto: r.resultado.texto,
      provedor: r.provedor,
      modelo: r.nomeModelo,
      usouFallback: r.usouFallback,
      tokensEntrada: r.resultado.tokensEntrada,
      tokensSaida: r.resultado.tokensSaida,
      efeitos: ctx.efeitos,
    };
  } catch (erro) {
    if (!(erro instanceof FalhaAposEfeitos)) throw erro;
    // Algo já foi alterado: avisa o que foi feito em vez de tentar de novo e duplicar.
    return {
      ...semIa,
      tokensEntrada: null,
      tokensSaida: null,
      texto: `✅ Feito:\n${ctx.efeitos.join('\n')}\n\nTive um problema para concluir a resposta. Confira no painel se ficou tudo certo.`,
      modelo: null,
      efeitos: ctx.efeitos,
    };
  }
}
