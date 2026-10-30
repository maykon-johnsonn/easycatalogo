import { timingSafeEqual } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { ChannelAdapter, InboundMessage, ReceberMensagens } from '../types.js';
import { criarClienteTelegram, ErroTelegram, type ClienteTelegram, type TgUpdate } from './cliente.js';

const LIMITE_TEXTO = 4096;
const ROTA_WEBHOOK = '/canais/telegram/webhook';

type Opcoes = {
  token: string;
  modo: 'polling' | 'webhook';
  webhookSecret?: string | undefined;
  urlPublicaApi?: string | undefined;
  log: FastifyBaseLogger;
};

/** Converte um update do Telegram em mensagens normalizadas. Só conversas privadas. */
export function converterUpdate(update: TgUpdate, cliente: Pick<ClienteTelegram, 'baixarArquivo'>): InboundMessage[] {
  const m = update.message;
  if (!m?.from || m.from.is_bot || m.chat.type !== 'private') return [];

  const base = {
    canal: 'telegram' as const,
    idExterno: `${m.chat.id}:${m.message_id}`,
    remetente: String(m.from.id),
    nomeRemetente: [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || undefined,
    recebidoEm: new Date(m.date * 1000),
  };
  const baixar = (fileId: string, mimeType: string) => async () => ({
    conteudo: await cliente.baixarArquivo(fileId),
    mimeType,
  });

  if (m.photo?.length) {
    // O Telegram manda a mesma foto em vários tamanhos; a última é a maior.
    const maior = m.photo[m.photo.length - 1]!;
    return [{ ...base, tipo: 'imagem', texto: m.caption, grupoMidia: m.media_group_id, baixarMidia: baixar(maior.file_id, 'image/jpeg') }];
  }
  if (m.document?.mime_type?.startsWith('image/')) {
    return [{ ...base, tipo: 'imagem', texto: m.caption, grupoMidia: m.media_group_id, baixarMidia: baixar(m.document.file_id, m.document.mime_type) }];
  }
  const audio = m.voice ?? m.audio;
  if (audio) {
    return [{ ...base, tipo: 'audio', texto: m.caption, baixarMidia: baixar(audio.file_id, audio.mime_type ?? 'audio/ogg') }];
  }
  if (m.text) return [{ ...base, tipo: 'texto', texto: m.text }];
  return [{ ...base, tipo: 'outro' }];
}

function segredoConfere(recebido: unknown, esperado: string) {
  if (typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function criarAdapterTelegram(opcoes: Opcoes): ChannelAdapter {
  const cliente = criarClienteTelegram(opcoes.token);
  const { log } = opcoes;
  let controlador: AbortController | null = null;
  let loop: Promise<void> | null = null;
  let usuarioBot: Promise<string | null> | null = null;

  async function polling(receber: ReceberMensagens, signal: AbortSignal) {
    let offset = 0;
    while (!signal.aborted) {
      try {
        const updates = await cliente.getUpdates(offset, signal);
        for (const u of updates) offset = Math.max(offset, u.update_id + 1);
        const mensagens = updates.flatMap((u) => converterUpdate(u, cliente));
        if (mensagens.length) await receber(mensagens);
      } catch (erro) {
        if (signal.aborted) break;
        if (erro instanceof ErroTelegram && erro.codigo === 401) {
          log.error('Telegram: token inválido. Confira TELEGRAM_BOT_TOKEN. Bot parado.');
          break;
        }
        log.warn({ err: erro }, 'Telegram: falha no polling, tentando de novo em 5s');
        await esperar(5000);
      }
    }
  }

  return {
    canal: 'telegram',

    registrar(app, receber) {
      if (opcoes.modo !== 'webhook') return;
      const segredo = opcoes.webhookSecret!;
      app.post(ROTA_WEBHOOK, async (req, reply) => {
        if (!segredoConfere(req.headers['x-telegram-bot-api-secret-token'], segredo)) {
          return reply.status(401).send();
        }
        // `receber` só grava e enfileira; o processamento (IA, upload) roda depois, fora da requisição.
        await receber(converterUpdate(req.body as TgUpdate, cliente));
        return reply.status(200).send();
      });
    },

    async iniciar(receber) {
      const bot = await cliente.getMe();
      if (opcoes.modo === 'webhook') {
        await cliente.setWebhook(`${opcoes.urlPublicaApi!.replace(/\/$/, '')}${ROTA_WEBHOOK}`, opcoes.webhookSecret!);
        log.info(`Telegram: bot @${bot.username} recebendo por webhook`);
        return;
      }
      // Com webhook ativo o getUpdates falha; garante que está desligado antes do polling.
      await cliente.deleteWebhook();
      controlador = new AbortController();
      loop = polling(receber, controlador.signal);
      log.info(`Telegram: bot @${bot.username} recebendo por polling`);
    },

    async parar() {
      controlador?.abort();
      await loop?.catch(() => {});
      controlador = null;
      loop = null;
    },

    async enviarTexto(destinatario, texto) {
      for (let i = 0; i < texto.length; i += LIMITE_TEXTO) {
        await cliente.sendMessage(destinatario, texto.slice(i, i + LIMITE_TEXTO));
      }
    },

    async linkDeVinculo(codigo) {
      usuarioBot ??= cliente.getMe().then(
        (b) => b.username ?? null,
        () => {
          usuarioBot = null;
          return null;
        },
      );
      const usuario = await usuarioBot;
      return usuario ? `https://t.me/${usuario}?start=${codigo}` : null;
    },
  };
}
