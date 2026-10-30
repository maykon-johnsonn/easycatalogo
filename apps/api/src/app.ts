import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { supabaseAdmin } from './config/supabase.js';
import { HttpErro } from './lib/erros.js';
import { rotasPainel } from './modules/painel/routes.js';
import { rotasPlataforma } from './modules/plataforma/routes.js';

export async function buildApp(opcoes: { logs?: boolean } = {}) {
  const app = Fastify({
    logger:
      opcoes.logs === false
        ? false
        : env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
        : true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.decorateRequest('usuario', null);

  app.setErrorHandler((erro, request, reply) => {
    if (erro instanceof HttpErro) {
      if (erro.status >= 500) request.log.error({ detalhes: erro.detalhes }, erro.message);
      return reply.status(erro.status).send({ erro: erro.message, detalhes: erro.status < 500 ? erro.detalhes : undefined });
    }
    const status = (erro as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      // Erros do próprio Fastify/multipart (JSON malformado, arquivo grande demais, etc.)
      return reply.status(status).send({ erro: (erro as Error).message });
    }
    request.log.error(erro);
    return reply.status(500).send({ erro: 'Erro interno. Tente novamente.' });
  });

  app.get('/health', async () => {
    // Não usar `head: true`: em HEAD o PostgREST não devolve corpo e uma tabela inexistente passa como ok.
    const { error } = await supabaseAdmin.from('lojas').select('id').limit(1);
    return { status: 'ok', banco: error ? `erro: ${error.message}` : 'ok' };
  });

  await app.register(rotasPainel);
  await app.register(rotasPlataforma);

  return app;
}
