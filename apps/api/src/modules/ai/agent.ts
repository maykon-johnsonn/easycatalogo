import { generateText, isStepCount, type ModelMessage } from 'ai';
import { comRoteador, FalhaAposEfeitos, type Provedor } from './providers.js';
import { criarTools, type ContextoTools } from './tools/index.js';

export type EntradaAgente = {
  loja: { id: string; nome: string; slug: string };
  operadorId: string;
  texto: string;
  /** Últimas trocas da conversa, da mais antiga para a mais nova. */
  historico: ModelMessage[];
  fotosPendentes: number;
  ultimoProduto: { numero: number; nome: string } | null;
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
- "Ela", "dele", "essa", "o mesmo" ou um pedido sem produto citado se referem ao último produto da conversa (abaixo): chame a ferramenta direto, sem o número e sem buscar.
- Um pedido pode ter várias ações ("tira a foto antiga e muda a cor"): chame uma ferramenta para cada uma, na mesma resposta.
- Fotos: "deixa só a última foto" = remover_fotos com manter_ultimas 1; "tira a 2ª foto" = remover_fotos com posicoes [2]; "essa foto como capa" = definir_foto_principal.
- Nunca sugira excluir e recadastrar um produto para contornar algo. Se não houver ferramenta para o pedido, diga que pode ser feito pelo painel.
- Para cadastrar, o mínimo é nome e preço. Se faltar o preço, pergunte. Nunca invente preço, tamanho ou cor.
- Valores: "59,90" ou "59 e 90" = 59.9. "de 80 por 60" = preço 80 e promocional 60.
- Ao criar ou editar, confirme com uma linha no formato "✅ #12 Blusa Canelada, R$ 59,90, P/M/G" e o link do produto.
- Se a ferramenta devolver "erro", explique o problema ao lojista com suas palavras e diga como resolver.
- Se a referência for ambígua ("a blusa azul") e houver mais de um produto possível, use buscar_produtos, liste as opções com o código (#) e pergunte qual. Nunca escolha sozinho.
- Excluir só com pedido claro e com o código do produto.
- Ações em vários produtos de uma vez (ex.: "20% em todas as calças", "apagar a coleção") ainda não estão disponíveis por aqui: explique que por enquanto devem ser feitas uma a uma ou pelo painel.
- Se a mensagem não tiver relação com o catálogo, diga gentilmente o que você sabe fazer.

Situação agora:
- Vitrine da loja: /${e.loja.slug}
- Fotos recebidas aguardando um produto: ${e.fotosPendentes}${e.fotosPendentes ? ' (serão anexadas ao criar o produto ou com adicionar_fotos)' : ''}
- Último produto da conversa: ${e.ultimoProduto ? `#${e.ultimoProduto.numero} ${e.ultimoProduto.nome}` : 'nenhum'}`;
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

/** Resposta com cara de confirmação ("✅") sem nenhuma ferramenta executada: a IA inventou a ação. */
const confirmouSemFazer = (texto: string, efeitos: string[]) => !efeitos.length && texto.includes('✅');

const LEMBRETE_SEM_ACAO =
  '[aviso do sistema] Sua resposta confirma uma alteração, mas nenhuma ferramenta foi chamada, então nada mudou. ' +
  'Se o lojista pediu uma alteração, chame a ferramenta agora. Se não, responda sem usar ✅.';

export async function responder(e: EntradaAgente): Promise<RespostaAgente> {
  const ctx: ContextoTools = { lojaId: e.loja.id, lojaSlug: e.loja.slug, operadorId: e.operadorId, efeitos: [] };
  const tools = criarTools(ctx);

  try {
    const r = await comRoteador(async ({ modelo }) => {
      const gerar = (messages: ModelMessage[]) =>
        generateText({
          model: modelo,
          instructions: instrucoes(e),
          messages,
          tools,
          stopWhen: isStepCount(6),
          maxRetries: 0, // quem refaz em outro provedor é o roteador
          timeout: 60_000,
        });
      try {
        const mensagens: ModelMessage[] = [...e.historico, { role: 'user', content: e.texto }];
        const primeira = await gerar(mensagens);
        if (!confirmouSemFazer(primeira.text, ctx.efeitos)) return primeira;
        // Uma chance de corrigir: a IA vê a própria resposta e o aviso.
        const segunda = await gerar([...mensagens, ...primeira.response.messages, { role: 'user', content: LEMBRETE_SEM_ACAO }]);
        const somar = (a?: number, b?: number) => (a ?? 0) + (b ?? 0);
        return {
          text: confirmouSemFazer(segunda.text, ctx.efeitos)
            ? 'Não consegui fazer essa alteração. Pode repetir o pedido com o código do produto? Ex.: "muda a cor da #1 para vermelho".'
            : segunda.text,
          totalUsage: {
            inputTokens: somar(primeira.totalUsage.inputTokens, segunda.totalUsage.inputTokens),
            outputTokens: somar(primeira.totalUsage.outputTokens, segunda.totalUsage.outputTokens),
          },
        };
      } catch (erro) {
        if (ctx.efeitos.length) throw new FalhaAposEfeitos(erro);
        throw erro;
      }
    });

    const texto =
      limparTexto(r.resultado.text) ||
      (ctx.efeitos.length
        ? `✅ Pronto:\n${ctx.efeitos.join('\n')}`
        : 'Não consegui entender. Pode repetir de outro jeito? Ex.: "Blusa canelada, 59,90, P M G, preta".');

    return {
      texto,
      provedor: r.provedor,
      modelo: r.nomeModelo,
      usouFallback: r.usouFallback,
      tokensEntrada: r.resultado.totalUsage.inputTokens ?? null,
      tokensSaida: r.resultado.totalUsage.outputTokens ?? null,
      efeitos: ctx.efeitos,
    };
  } catch (erro) {
    if (!(erro instanceof FalhaAposEfeitos)) throw erro;
    // Algo já foi alterado: avisa o que foi feito em vez de tentar de novo e duplicar.
    return {
      texto: `✅ Feito:\n${ctx.efeitos.join('\n')}\n\nTive um problema para concluir a resposta. Confira no painel se ficou tudo certo.`,
      provedor: null,
      modelo: null,
      usouFallback: false,
      tokensEntrada: null,
      tokensSaida: null,
      efeitos: ctx.efeitos,
    };
  }
}
