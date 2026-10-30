import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { iaConfigurada } from '../ai/providers.js';
import { criarAdapterTelegram } from '../channels/telegram/adapter.js';
import type { Canal, ChannelAdapter } from '../channels/types.js';
import { limparEstadoAntigo } from './estado.js';
import { criarFila } from './fila.js';
import { criarProcessador } from './processar.js';

const INTERVALO_LIMPEZA_MS = 60 * 60 * 1000;

let canaisAtivos = new Map<Canal, ChannelAdapter>();

/** Canal ligado (para o painel gerar o link de vínculo), ou null. */
export const canalAtivo = (canal: Canal) => canaisAtivos.get(canal) ?? null;

export type OpcoesBot = {
  /** Substitui os canais reais (testes). */
  canais?: Map<Canal, ChannelAdapter>;
};

/**
 * Liga o bot à API: rotas de webhook, fila e processamento, início/parada dos canais
 * junto com o servidor e limpeza periódica. Sem canais configurados, não faz nada.
 */
export function registrarBot(app: FastifyInstance, opcoes: OpcoesBot = {}) {
  const canais = opcoes.canais ?? canaisDoAmbiente(app);
  canaisAtivos = canais;
  if (!canais.size) return null;

  if (!iaConfigurada()) {
    app.log.warn('Bot: nenhuma chave de IA (GOOGLE_GENERATIVE_AI_API_KEY / GROQ_API_KEY). O bot só fará o vínculo de contas.');
  }

  const fila = criarFila(app.log);
  const processador = criarProcessador({ canais, fila, log: app.log });
  for (const canal of canais.values()) canal.registrar(app, processador.receber);

  let limpeza: NodeJS.Timeout | null = null;
  const limpar = () =>
    limparEstadoAntigo()
      .then((r) => r.fotosRemovidas && app.log.info(`Bot: ${r.fotosRemovidas} fotos não usadas removidas`))
      .catch((erro) => app.log.error({ err: erro }, 'Bot: falha na limpeza'));

  app.addHook('onReady', async () => {
    for (const canal of canais.values()) {
      await canal.iniciar(processador.receber).catch((erro) => app.log.error({ err: erro }, `Bot: falha ao iniciar ${canal.canal}`));
    }
    limpeza = setInterval(limpar, INTERVALO_LIMPEZA_MS);
    void limpar();
  });

  app.addHook('onClose', async () => {
    if (limpeza) clearInterval(limpeza);
    processador.parar();
    for (const canal of canais.values()) await canal.parar();
    await fila.ociosa();
  });

  return { fila, processador };
}

function canaisDoAmbiente(app: FastifyInstance) {
  const canais = new Map<Canal, ChannelAdapter>();
  if (env.TELEGRAM_BOT_TOKEN) {
    canais.set(
      'telegram',
      criarAdapterTelegram({
        token: env.TELEGRAM_BOT_TOKEN,
        modo: env.TELEGRAM_MODE,
        webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
        urlPublicaApi: env.PUBLIC_API_URL,
        log: app.log,
      }),
    );
  } else {
    app.log.info('Bot: Telegram desligado (defina TELEGRAM_BOT_TOKEN para ligar)');
  }
  return canais;
}
