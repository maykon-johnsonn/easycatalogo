import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { produtoCriarSchema, produtoEditarSchema, type ProdutoEditar } from '@catalogo/shared';
import { env } from '../../../config/env.js';
import { HttpErro, validar } from '../../../lib/erros.js';
import { anexarImagensSalvas, MAX_IMAGENS_POR_PRODUTO } from '../../catalog/imagens.service.js';
import {
  criarProduto,
  editarProduto,
  excluirProduto,
  listarProdutos,
  obterProduto,
  obterProdutoPorNumero,
} from '../../catalog/produtos.service.js';
import {
  consumirMidiasPendentes,
  definirUltimoProduto,
  devolverMidias,
  ultimoProdutoId,
} from '../../inbound/estado.js';

// Tools do agente (direcao.md, seção 7). O loja_id vem do contexto do operador, nunca da IA,
// e tudo passa pelos mesmos serviços do painel: as regras de negócio ficam num lugar só.

export type ContextoTools = {
  lojaId: string;
  lojaSlug: string;
  operadorId: string;
  /** Resumo do que já foi alterado nesta mensagem. Se a IA falhar depois, não há nova tentativa. */
  efeitos: string[];
};

type ProdutoServico = Awaited<ReturnType<typeof obterProduto>>;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const linkProduto = (slug: string, numero: number) => `${env.PUBLIC_WEB_URL}/${slug}/p/${numero}`;

const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Resumo curto para a IA repassar ao lojista. */
function resumo(p: ProdutoServico, slug: string) {
  return {
    numero: p.numero,
    nome: p.nome,
    preco: brl.format(p.preco_original),
    preco_promocional: p.preco_promocional != null ? brl.format(p.preco_promocional) : null,
    categoria: p.categoria,
    tamanhos: lista(p.tamanhos),
    cores: lista(p.cores),
    fotos: p.imagens.length,
    visivel_na_vitrine: p.ativo,
    link: linkProduto(slug, p.numero),
  };
}

/** Erros esperados viram resposta para a IA explicar ao lojista; o resto sobe. */
async function seguro<T>(fn: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpErro) {
      const detalhes = e.detalhes && typeof e.detalhes === 'object' ? Object.values(e.detalhes).flat().join('; ') : '';
      return { erro: detalhes ? `${e.message}: ${detalhes}` : e.message };
    }
    throw e;
  }
}

const numeroOpcional = z
  .number()
  .int()
  .positive()
  .optional()
  .describe('Código do produto (o número depois do #). Omita para usar o último produto da conversa.');

const camposProduto = {
  categoria: z.string().optional().describe('Ex.: Blusas, Vestidos, Brincos, Bolsas'),
  tamanhos: z.array(z.string()).optional().describe('Ex.: ["P","M","G"] ou ["36","38"]'),
  cores: z.array(z.string()).optional().describe('Ex.: ["Preto","Off-white"]'),
  descricao: z.string().optional().describe('Detalhes como tecido, medidas ou material, se o lojista disser'),
};

export function criarTools(ctx: ContextoTools): ToolSet {
  const { lojaId, lojaSlug, operadorId } = ctx;

  async function alvo(numero?: number) {
    if (numero != null) return obterProdutoPorNumero(lojaId, numero);
    const id = await ultimoProdutoId(operadorId);
    if (!id) throw new HttpErro(400, 'Não sei de qual produto se trata. Peça o código (#) ao lojista.');
    return obterProduto(lojaId, id).catch(() => {
      throw new HttpErro(400, 'O último produto da conversa não existe mais. Peça o código (#) ao lojista.');
    });
  }

  async function usarFotosPendentes(produto: ProdutoServico) {
    const vagas = MAX_IMAGENS_POR_PRODUTO - produto.imagens.length;
    if (vagas <= 0) return produto;
    const { imagens, ids } = await consumirMidiasPendentes(operadorId, vagas);
    if (!imagens.length) return produto;
    try {
      return await anexarImagensSalvas(lojaId, produto.id, imagens);
    } catch (e) {
      await devolverMidias(ids);
      throw e;
    }
  }

  async function concluir(produto: ProdutoServico, acao: string) {
    await definirUltimoProduto(operadorId, produto.id);
    ctx.efeitos.push(`${acao}: #${produto.numero} ${produto.nome}`);
    return resumo(produto, lojaSlug);
  }

  return {
    criar_produto: tool({
      description:
        'Cadastra UM produto novo. As fotos que o lojista enviou nos últimos minutos são anexadas automaticamente.',
      inputSchema: z.object({
        nome: z.string().describe('Nome curto, ex.: "Blusa Canelada"'),
        preco: z.number().describe('Preço normal em reais, ex.: 59.9'),
        preco_promocional: z.number().optional().describe('Só se o lojista informar um preço promocional'),
        ...camposProduto,
      }),
      execute: (dados) =>
        seguro(async () => {
          const validado = validar(produtoCriarSchema, {
            nome: dados.nome,
            preco_original: dados.preco,
            preco_promocional: dados.preco_promocional ?? null,
            categoria: dados.categoria ?? null,
            tamanhos: dados.tamanhos ?? [],
            cores: dados.cores ?? [],
            descricao: dados.descricao ?? null,
          });
          const criado = await criarProduto(lojaId, validado);
          return concluir(await usarFotosPendentes(criado), 'Criado');
        }),
    }),

    editar_produto: tool({
      description: 'Altera dados de UM produto existente. Envie só os campos que mudam.',
      inputSchema: z.object({
        numero: numeroOpcional,
        nome: z.string().optional(),
        preco: z.number().optional().describe('Novo preço normal'),
        preco_promocional: z.number().optional().describe('Novo preço promocional'),
        remover_promocao: z.boolean().optional().describe('true para encerrar a promoção'),
        ...camposProduto,
      }),
      execute: ({ numero, preco, preco_promocional, remover_promocao, ...resto }) =>
        seguro(async () => {
          const produto = await alvo(numero);
          const mudancas: ProdutoEditar = validar(produtoEditarSchema, {
            ...resto,
            ...(preco != null && { preco_original: preco }),
            ...(preco_promocional != null && { preco_promocional }),
            ...(remover_promocao && { preco_promocional: null }),
          });
          if (!Object.keys(mudancas).length) throw new HttpErro(400, 'Nenhuma alteração informada');
          return concluir(await editarProduto(lojaId, produto.id, mudancas), 'Editado');
        }),
    }),

    adicionar_fotos: tool({
      description: 'Anexa a um produto existente as fotos que o lojista acabou de enviar.',
      inputSchema: z.object({ numero: numeroOpcional }),
      execute: ({ numero }) =>
        seguro(async () => {
          const produto = await alvo(numero);
          const atualizado = await usarFotosPendentes(produto);
          if (atualizado.imagens.length === produto.imagens.length) {
            throw new HttpErro(
              400,
              produto.imagens.length >= MAX_IMAGENS_POR_PRODUTO
                ? `O produto já tem o máximo de ${MAX_IMAGENS_POR_PRODUTO} fotos`
                : 'Não há fotos novas. O lojista precisa enviar as fotos antes',
            );
          }
          return concluir(atualizado, 'Fotos adicionadas');
        }),
    }),

    pausar_produto: tool({
      description: 'Tira UM produto da vitrine (esgotado, por exemplo), sem excluir.',
      inputSchema: z.object({ numero: numeroOpcional }),
      execute: ({ numero }) =>
        seguro(async () => concluir(await editarProduto(lojaId, (await alvo(numero)).id, { ativo: false }), 'Pausado')),
    }),

    reativar_produto: tool({
      description: 'Volta a mostrar na vitrine UM produto pausado.',
      inputSchema: z.object({ numero: numeroOpcional }),
      execute: ({ numero }) =>
        seguro(async () => concluir(await editarProduto(lojaId, (await alvo(numero)).id, { ativo: true }), 'Reativado')),
    }),

    excluir_produto: tool({
      description: 'Exclui UM produto pelo código. Só use quando o lojista pedir claramente para excluir/apagar.',
      inputSchema: z.object({ numero: z.number().int().positive().describe('Código do produto (obrigatório)') }),
      execute: ({ numero }) =>
        seguro(async () => {
          const produto = await alvo(numero);
          await excluirProduto(lojaId, produto.id);
          ctx.efeitos.push(`Excluído: #${produto.numero} ${produto.nome}`);
          return { excluido: true, numero: produto.numero, nome: produto.nome };
        }),
    }),

    buscar_produtos: tool({
      description:
        'Procura produtos da loja. Use para achar o código (#) quando o lojista descrever o produto, e para desambiguar.',
      inputSchema: z.object({
        termo: z.string().optional().describe('Parte do nome, ex.: "blusa azul", ou o código "#12"'),
        categoria: z.string().optional(),
        preco_min: z.number().optional(),
        preco_max: z.number().optional(),
        status: z.enum(['ativos', 'pausados', 'todos']).optional(),
      }),
      execute: ({ termo, categoria, preco_min, preco_max, status }) =>
        seguro(async () => {
          let produtos = await listarProdutos(lojaId, { busca: termo, categoria, status: status ?? 'todos' });
          // Busca por várias palavras ("blusa azul"): o banco procura o texto inteiro; se não achar, tenta palavra a palavra.
          if (!produtos.length && termo && termo.trim().includes(' ')) {
            const palavras = termo.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
            const todos = await listarProdutos(lojaId, { categoria, status: status ?? 'todos' });
            produtos = todos.filter((p) => palavras.every((w) => p.nome.toLowerCase().includes(w)));
          }
          const atual = (p: ProdutoServico) => p.preco_promocional ?? p.preco_original;
          const filtrados = produtos.filter(
            (p) => (preco_min == null || atual(p) >= preco_min) && (preco_max == null || atual(p) <= preco_max),
          );
          return {
            total: filtrados.length,
            produtos: filtrados.slice(0, 15).map((p) => ({
              numero: p.numero,
              nome: p.nome,
              preco: brl.format(atual(p)),
              categoria: p.categoria,
              visivel_na_vitrine: p.ativo,
            })),
          };
        }),
    }),

    resumo_loja: tool({
      description: 'Números da loja: produtos ativos, pausados, em promoção e o link da vitrine.',
      inputSchema: z.object({}),
      execute: () =>
        seguro(async () => {
          const produtos = await listarProdutos(lojaId, { status: 'todos' });
          return {
            total: produtos.length,
            ativos: produtos.filter((p) => p.ativo).length,
            pausados: produtos.filter((p) => !p.ativo).length,
            em_promocao: produtos.filter((p) => p.preco_promocional != null).length,
            link_vitrine: `${env.PUBLIC_WEB_URL}/${lojaSlug}`,
          };
        }),
    }),
  };
}

