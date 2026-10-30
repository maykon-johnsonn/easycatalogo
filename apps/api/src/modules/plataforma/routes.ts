import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lojaCriarSchema } from '@catalogo/shared';
import { validar } from '../../lib/erros.js';
import { exigirAdminPlataforma, exigirUsuario } from '../store/acesso.js';
import { alterarStatusLoja, criarLoja, listarLojas, resumoPlataforma } from './plataforma.service.js';

/** Administração geral da plataforma: métricas e gestão de todas as lojas. */
export async function rotasPlataforma(app: FastifyInstance) {
  app.addHook('preHandler', exigirUsuario);
  app.addHook('preHandler', exigirAdminPlataforma);

  app.get('/plataforma/resumo', async () => resumoPlataforma());

  app.get('/plataforma/lojas', async () => listarLojas());

  app.post('/plataforma/lojas', async (req, reply) => {
    const loja = await criarLoja(validar(lojaCriarSchema, req.body));
    return reply.status(201).send(loja);
  });

  app.patch('/plataforma/lojas/:lojaId/status', async (req) => {
    const lojaId = validar(z.uuid(), (req.params as { lojaId: string }).lojaId);
    const { ativa } = validar(z.object({ ativa: z.boolean() }), req.body);
    return alterarStatusLoja(lojaId, ativa);
  });
}
