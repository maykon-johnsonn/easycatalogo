import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lojaEditarSchema, produtoCriarSchema, produtoEditarSchema } from '@catalogo/shared';
import { HttpErro, validar } from '../../lib/erros.js';
import { exigirAcessoLoja, exigirUsuario, ehAdminPlataforma } from '../store/acesso.js';
import { editarLoja, lojasDoUsuario, obterLoja } from '../store/lojas.service.js';
import {
  criarProduto,
  editarProduto,
  excluirProduto,
  listarCategorias,
  listarProdutos,
  obterProduto,
} from '../catalog/produtos.service.js';
import {
  adicionarImagens,
  MAX_IMAGENS_POR_PRODUTO,
  removerImagem,
  reordenarImagens,
} from '../catalog/imagens.service.js';

const uuid = z.uuid();
const filtroSchema = z.object({
  busca: z.string().trim().max(80).optional(),
  categoria: z.string().trim().max(60).optional(),
  status: z.enum(['ativos', 'pausados', 'todos']).default('todos'),
});

/**
 * Rotas do painel do lojista. Tudo abaixo de /painel/lojas/:lojaId passa por `exigirAcessoLoja`,
 * então cada lojista só enxerga e altera a própria loja.
 */
export async function rotasPainel(app: FastifyInstance) {
  app.addHook('preHandler', exigirUsuario);

  // Quem sou eu: lojas que posso gerenciar e se tenho acesso à administração geral.
  app.get('/me', async (req) => {
    const usuario = req.usuario!;
    const [lojas, adminPlataforma] = await Promise.all([lojasDoUsuario(usuario.id), ehAdminPlataforma(usuario.id)]);
    return { usuario, lojas, admin_plataforma: adminPlataforma };
  });

  await app.register(async (loja) => {
    loja.addHook('preHandler', exigirAcessoLoja);

    const id = (params: unknown, campo: string) => validar(uuid, (params as Record<string, string>)[campo]);
    const lojaIdDe = (params: unknown) => id(params, 'lojaId');

    loja.get('/painel/lojas/:lojaId', async (req) => obterLoja(lojaIdDe(req.params)));

    loja.patch('/painel/lojas/:lojaId', async (req) =>
      editarLoja(lojaIdDe(req.params), validar(lojaEditarSchema, req.body)),
    );

    loja.get('/painel/lojas/:lojaId/categorias', async (req) => listarCategorias(lojaIdDe(req.params)));

    loja.get('/painel/lojas/:lojaId/produtos', async (req) =>
      listarProdutos(lojaIdDe(req.params), validar(filtroSchema, req.query)),
    );

    loja.post('/painel/lojas/:lojaId/produtos', async (req, reply) => {
      const produto = await criarProduto(lojaIdDe(req.params), validar(produtoCriarSchema, req.body));
      return reply.status(201).send(produto);
    });

    loja.get('/painel/lojas/:lojaId/produtos/:produtoId', async (req) =>
      obterProduto(lojaIdDe(req.params), id(req.params, 'produtoId')),
    );

    loja.patch('/painel/lojas/:lojaId/produtos/:produtoId', async (req) =>
      editarProduto(lojaIdDe(req.params), id(req.params, 'produtoId'), validar(produtoEditarSchema, req.body)),
    );

    loja.delete('/painel/lojas/:lojaId/produtos/:produtoId', async (req, reply) => {
      await excluirProduto(lojaIdDe(req.params), id(req.params, 'produtoId'));
      return reply.status(204).send();
    });

    // multipart/form-data com um ou mais campos de arquivo
    loja.post('/painel/lojas/:lojaId/produtos/:produtoId/imagens', async (req) => {
      const arquivos: Buffer[] = [];
      for await (const parte of req.files({ limits: { files: MAX_IMAGENS_POR_PRODUTO } })) {
        if (!parte.mimetype.startsWith('image/')) throw new HttpErro(400, `"${parte.filename}" não é uma imagem`);
        arquivos.push(await parte.toBuffer());
      }
      if (arquivos.length === 0) throw new HttpErro(400, 'Envie ao menos uma imagem');
      return adicionarImagens(lojaIdDe(req.params), id(req.params, 'produtoId'), arquivos);
    });

    loja.put('/painel/lojas/:lojaId/produtos/:produtoId/imagens/ordem', async (req) => {
      const { ids } = validar(z.object({ ids: z.array(uuid).max(MAX_IMAGENS_POR_PRODUTO) }), req.body);
      return reordenarImagens(lojaIdDe(req.params), id(req.params, 'produtoId'), ids);
    });

    loja.delete('/painel/lojas/:lojaId/imagens/:imagemId', async (req, reply) => {
      await removerImagem(lojaIdDe(req.params), id(req.params, 'imagemId'));
      return reply.status(204).send();
    });
  });
}
