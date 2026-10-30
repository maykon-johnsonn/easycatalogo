import type { FastifyBaseLogger } from 'fastify';
import type { ModelMessage } from 'ai';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { erroDoBanco, HttpErro } from '../../lib/erros.js';
import { responder } from '../ai/agent.js';
import { iaConfigurada } from '../ai/providers.js';
import { transcrever } from '../ai/transcricao.js';
import { obterProduto } from '../catalog/produtos.service.js';
import { salvarImagemPendente } from '../storage/imagens.js';
import type { Canal, ChannelAdapter, InboundMessage } from '../channels/types.js';
import type { Fila } from './fila.js';
import {
  buscarOperador,
  contarMidiasPendentes,
  pareceCodigoVinculo,
  registrarMidiaPendente,
  ultimoProdutoId,
  usarCodigoVinculo,
  type Operador,
} from './estado.js';

// Pipeline do bot (direcao.md, seção 7): grava → enfileira por remetente → identifica o operador
// → foto vai para o buffer, áudio é transcrito, texto vai para o agente → sempre responde.

/** Espera para o restante de um álbum chegar antes de executar a legenda. */
const ESPERA_ALBUM_MS = 2500;
/** Depois da última foto sem legenda, quanto esperar para avisar o lojista. */
const ESPERA_AVISO_FOTOS_MS = 4000;
const HISTORICO_MENSAGENS = 6;
const HISTORICO_JANELA_MS = 30 * 60 * 1000;

const MSG = {
  naoVinculado:
    'Olá! 👋 Esta conta ainda não está ligada a nenhuma loja.\n\nNo painel da sua loja, abra "Loja" > "Bot do Telegram", gere um código e envie aqui (ou toque no link gerado).',
  codigoInvalido: 'Esse código não é válido ou já expirou. Gere um novo no painel da loja e tente de novo.',
  outraLoja: 'Esta conta já está ligada a outra loja. Para trocar, remova o acesso no painel da outra loja primeiro.',
  lojaDesativada: 'A sua loja está desativada no momento. Fale com o suporte para reativar.',
  ajuda: (loja: string) =>
    `Você está gerenciando a loja ${loja}. Exemplos do que posso fazer:\n\n` +
    '📸 Envie as fotos e depois: "Blusa canelada, 59,90, tamanhos P M G, cor preta"\n' +
    '✏️ "Muda o preço da #12 para 49,90"\n' +
    '🏷️ "Coloca a #12 em promoção por 39,90"\n' +
    '⏸️ "Pausa a #12" / "Reativa a #12"\n' +
    '🔎 "Quais vestidos eu tenho?"\n' +
    '🎙️ Pode mandar tudo por áudio também!',
  tipoNaoSuportado: 'Por enquanto eu entendo texto, fotos e áudios. 🙂',
  iaDesligada: 'Recebi! Mas o assistente ainda não está configurado (faltam as chaves de IA no servidor).',
  limiteDiario: 'A loja atingiu o limite de mensagens do assistente por hoje. Amanhã volta ao normal; enquanto isso, use o painel.',
  erro: 'Ops, tive um problema para processar isso. 😕 Tente de novo em instantes ou use o painel.',
  audioFalhou: 'Não consegui entender o áudio. Pode tentar de novo ou escrever a mensagem?',
  fotoFalhou: 'Não consegui salvar essa foto. Pode enviar de novo?',
};

type Registro = { id: string };

export function criarProcessador(opcoes: { canais: Map<Canal, ChannelAdapter>; fila: Fila; log: FastifyBaseLogger }) {
  const { canais, fila, log } = opcoes;
  const avisosFotos = new Map<string, NodeJS.Timeout>();
  const timers = new Set<NodeJS.Timeout>();

  const chaveRemetente = (m: InboundMessage) => `${m.canal}:${m.remetente}`;

  function agendar(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
    return t;
  }

  /** Grava (descartando reenvios) e enfileira. Rápido: é chamado dentro do webhook/polling. */
  async function receber(mensagens: InboundMessage[]) {
    for (const m of mensagens) {
      const { data, error } = await supabaseAdmin
        .from('mensagens')
        .insert({
          canal: m.canal,
          id_externo: m.idExterno,
          remetente: m.remetente,
          direcao: 'entrada',
          tipo: m.tipo,
          conteudo: m.texto ?? null,
        })
        .select('id')
        .single();
      if (error?.code === '23505') continue; // já recebida antes
      if (error) throw erroDoBanco(error);
      fila.enfileirar(chaveRemetente(m), () => processar(m, data));
    }
  }

  async function finalizar(registro: Registro, campos: Record<string, unknown>) {
    const { error } = await supabaseAdmin
      .from('mensagens')
      .update({ processado_em: new Date().toISOString(), ...campos })
      .eq('id', registro.id);
    if (error) log.error({ err: error }, 'Falha ao atualizar mensagem');
  }

  async function enviar(m: InboundMessage, texto: string, operador: Operador | null) {
    const canal = canais.get(m.canal);
    if (!canal) throw new Error(`Canal ${m.canal} não está ativo`);
    await canal.enviarTexto(m.remetente, texto);
    const { error } = await supabaseAdmin.from('mensagens').insert({
      canal: m.canal,
      remetente: m.remetente,
      direcao: 'saida',
      tipo: 'texto',
      conteudo: texto,
      status: 'processada',
      loja_id: operador?.loja_id ?? null,
      canal_operador_id: operador?.id ?? null,
    });
    if (error) log.error({ err: error }, 'Falha ao registrar resposta');
  }

  async function processar(m: InboundMessage, registro: Registro) {
    let operador: Operador | null = null;
    try {
      const texto = m.texto?.trim();
      const start = texto?.match(/^\/start(?:\s+(\S+))?$/i);
      operador = await buscarOperador(m.canal, m.remetente);

      // Vínculo: /start CODIGO (link do painel) ou o código digitado por quem ainda não está vinculado.
      const codigo = start?.[1] ?? (!operador && texto && pareceCodigoVinculo(texto) ? texto : null);
      if (codigo) {
        const r = await usarCodigoVinculo(m.canal, m.remetente, m.nomeRemetente, codigo);
        operador = await buscarOperador(m.canal, m.remetente);
        await finalizar(registro, { status: 'processada', loja_id: operador?.loja_id ?? null, canal_operador_id: operador?.id ?? null });
        if (!r.ok) return enviar(m, r.motivo === 'invalido' ? MSG.codigoInvalido : MSG.outraLoja, operador);
        const saudacao = r.jaVinculado
          ? `Esta conta já está ligada à loja ${r.lojaNome}. ✅`
          : `Pronto! ✅ Esta conta agora gerencia a loja ${r.lojaNome}.`;
        return enviar(m, `${saudacao}\n\n${MSG.ajuda(r.lojaNome)}`, operador);
      }

      if (!operador) {
        await finalizar(registro, { status: 'ignorada' });
        return enviar(m, MSG.naoVinculado, null);
      }
      await finalizar(registro, { status: 'recebida', loja_id: operador.loja_id, canal_operador_id: operador.id });
      if (!operador.loja.ativa) {
        await finalizar(registro, { status: 'ignorada' });
        return enviar(m, MSG.lojaDesativada, operador);
      }
      if (start || /^\/(ajuda|help)$/i.test(texto ?? '')) {
        await finalizar(registro, { status: 'processada' });
        return enviar(m, MSG.ajuda(operador.loja.nome), operador);
      }

      switch (m.tipo) {
        case 'outro':
          await finalizar(registro, { status: 'ignorada' });
          return enviar(m, MSG.tipoNaoSuportado, operador);

        case 'imagem':
          return receberFoto(m, registro, operador);

        case 'audio': {
          if (!(await dentroDoLimite(operador))) {
            await finalizar(registro, { status: 'ignorada' });
            return enviar(m, MSG.limiteDiario, operador);
          }
          let transcricao;
          try {
            transcricao = await transcrever(await m.baixarMidia!());
          } catch (erro) {
            log.warn({ err: erro }, 'Falha na transcrição');
            await finalizar(registro, { status: 'erro', erro: 'transcrição' });
            return enviar(m, MSG.audioFalhou, operador);
          }
          await finalizar(registro, { conteudo: transcricao.texto });
          return executarComando(m, registro, operador, transcricao.texto, `🎙️ "${transcricao.texto}"\n\n`);
        }

        case 'texto':
          return executarComando(m, registro, operador, texto ?? '');
      }
    } catch (erro) {
      log.error({ err: erro, idExterno: m.idExterno }, 'Falha ao processar mensagem do bot');
      await finalizar(registro, { status: 'erro', erro: erro instanceof Error ? erro.message.slice(0, 500) : 'desconhecido' });
      await enviar(m, MSG.erro, operador).catch((e) => log.error({ err: e }, 'Falha ao avisar o lojista do erro'));
    }
  }

  async function receberFoto(m: InboundMessage, registro: Registro, operador: Operador) {
    try {
      const imagem = await salvarImagemPendente(operador.loja_id, (await m.baixarMidia!()).conteudo);
      await registrarMidiaPendente(operador, imagem, m.grupoMidia);
    } catch (erro) {
      log.warn({ err: erro }, 'Falha ao salvar foto do bot');
      await finalizar(registro, { status: 'erro', erro: 'foto' });
      return enviar(m, MSG.fotoFalhou, operador);
    }

    const legenda = m.texto?.trim();
    if (!legenda) {
      await finalizar(registro, { status: 'processada' });
      return agendarAvisoFotos(m, operador);
    }
    // Legenda vale como comando. Num álbum, espera as outras fotos chegarem antes.
    if (!m.grupoMidia) return executarComando(m, registro, operador, legenda);
    agendar(ESPERA_ALBUM_MS, () =>
      fila.enfileirar(chaveRemetente(m), () =>
        executarComando(m, registro, operador, legenda).catch(async (erro) => {
          log.error({ err: erro }, 'Falha ao processar legenda do álbum');
          await enviar(m, MSG.erro, operador);
        }),
      ),
    );
  }

  /** Avisa uma vez por leva de fotos, se nenhum comando as usou. */
  function agendarAvisoFotos(m: InboundMessage, operador: Operador) {
    const chave = chaveRemetente(m);
    const anterior = avisosFotos.get(chave);
    if (anterior) {
      clearTimeout(anterior);
      timers.delete(anterior);
    }
    avisosFotos.set(
      chave,
      agendar(ESPERA_AVISO_FOTOS_MS, () => {
        avisosFotos.delete(chave);
        fila.enfileirar(chave, async () => {
          const n = await contarMidiasPendentes(operador.id);
          if (!n) return;
          await enviar(
            m,
            `📸 Recebi ${n === 1 ? '1 foto' : `${n} fotos`}. Agora me diga o nome e o preço (por texto ou áudio) para cadastrar.\n` +
              'Se forem de um produto que já existe, diga por exemplo: "adiciona na #12".',
            operador,
          );
        });
      }),
    );
  }

  async function executarComando(m: InboundMessage, registro: Registro, operador: Operador, texto: string, prefixo = '') {
    const aviso = avisosFotos.get(chaveRemetente(m));
    if (aviso) {
      clearTimeout(aviso);
      timers.delete(aviso);
      avisosFotos.delete(chaveRemetente(m));
    }
    if (!iaConfigurada()) {
      await finalizar(registro, { status: 'ignorada' });
      return enviar(m, MSG.iaDesligada, operador);
    }
    if (!(await dentroDoLimite(operador))) {
      await finalizar(registro, { status: 'ignorada' });
      return enviar(m, MSG.limiteDiario, operador);
    }

    const [historico, fotosPendentes, ultimoProduto] = await Promise.all([
      carregarHistorico(operador.id, registro.id),
      contarMidiasPendentes(operador.id),
      ultimoProdutoDaConversa(operador),
    ]);

    const r = await responder({
      loja: operador.loja,
      operadorId: operador.id,
      texto,
      historico,
      fotosPendentes,
      ultimoProduto,
    });

    await finalizar(registro, {
      status: 'processada',
      provedor_ia: r.provedor,
      modelo_ia: r.modelo,
      tokens_entrada: r.tokensEntrada,
      tokens_saida: r.tokensSaida,
      usou_fallback: r.usouFallback,
    });
    await enviar(m, prefixo + r.texto, operador);
  }

  async function ultimoProdutoDaConversa(operador: Operador) {
    const id = await ultimoProdutoId(operador.id);
    if (!id) return null;
    try {
      const p = await obterProduto(operador.loja_id, id);
      return { numero: p.numero, nome: p.nome };
    } catch (e) {
      if (e instanceof HttpErro) return null; // excluído
      throw e;
    }
  }

  async function carregarHistorico(operadorId: string, atualId: string): Promise<ModelMessage[]> {
    const { data, error } = await supabaseAdmin
      .from('mensagens')
      .select('id, direcao, conteudo')
      .eq('canal_operador_id', operadorId)
      .neq('id', atualId)
      .not('conteudo', 'is', null)
      .gte('criado_em', new Date(Date.now() - HISTORICO_JANELA_MS).toISOString())
      .order('criado_em', { ascending: false })
      .limit(HISTORICO_MENSAGENS);
    if (error) throw erroDoBanco(error);
    return data.reverse().map((msg) => ({
      role: msg.direcao === 'entrada' ? ('user' as const) : ('assistant' as const),
      content: msg.conteudo!,
    }));
  }

  /** Limite diário de mensagens processadas pela IA por loja (controle de custo). */
  async function dentroDoLimite(operador: Operador) {
    const hojeSaoPaulo = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const { count, error } = await supabaseAdmin
      .from('mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('loja_id', operador.loja_id)
      .eq('direcao', 'entrada')
      .not('provedor_ia', 'is', null)
      .gte('criado_em', `${hojeSaoPaulo}T00:00:00-03:00`);
    if (error) throw erroDoBanco(error);
    return (count ?? 0) < env.AI_DAILY_MESSAGE_LIMIT_PER_STORE;
  }

  function parar() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
    avisosFotos.clear();
  }

  return { receber, parar };
}
