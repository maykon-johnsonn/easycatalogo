import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { supabaseAdmin } from './config/supabase.js';

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
        : true,
  });

  await app.register(cors, { origin: env.CORS_ORIGINS });

  app.get('/health', async () => {
    // Não usar `head: true`: em HEAD o PostgREST não devolve corpo e uma tabela inexistente passa como ok.
    const { error } = await supabaseAdmin.from('lojas').select('id').limit(1);
    return { status: 'ok', banco: error ? `erro: ${error.message}` : 'ok' };
  });

  return app;
}
