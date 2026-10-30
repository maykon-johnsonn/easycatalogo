import type { ProdutoCriar, ProdutoEditar } from '@catalogo/shared';
import { supabaseAdmin } from '../../config/supabase.js';
import { erroDoBanco, HttpErro, naoEncontrado } from '../../lib/erros.js';

// Regras de negócio de produtos. Usadas pelo painel e, na Fase 2, pelas tools da IA.
// Toda função recebe `lojaId` e filtra por ele: o cliente usa a secret key, que ignora o RLS.

const CAMPOS_PRODUTO = `
  id, loja_id, numero, nome, descricao, preco_original, preco_promocional,
  categoria, tamanhos, cores, ativo, criado_em, atualizado_em,
  imagens:produto_imagens (id, url, ordem)
`;

export type FiltroProdutos = {
  busca?: string | undefined;
  categoria?: string | undefined;
  status?: 'ativos' | 'pausados' | 'todos' | undefined;
};

export async function listarProdutos(lojaId: string, filtro: FiltroProdutos = {}) {
  let q = supabaseAdmin
    .from('produtos')
    .select(CAMPOS_PRODUTO)
    .eq('loja_id', lojaId)
    .is('excluido_em', null)
    .order('criado_em', { ascending: false })
    .order('ordem', { referencedTable: 'produto_imagens' });

  if (filtro.status === 'ativos') q = q.eq('ativo', true);
  if (filtro.status === 'pausados') q = q.eq('ativo', false);
  if (filtro.categoria) q = q.eq('categoria', filtro.categoria);
  if (filtro.busca) {
    const termo = filtro.busca.replace(/[%_,()]/g, ' ').trim();
    const numero = Number(termo.replace(/^#/, ''));
    q = Number.isInteger(numero) && numero > 0 ? q.eq('numero', numero) : q.ilike('nome', `%${termo}%`);
  }

  const { data, error } = await q;
  if (error) throw erroDoBanco(error);
  return data;
}

export async function obterProduto(lojaId: string, produtoId: string) {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select(CAMPOS_PRODUTO)
    .eq('loja_id', lojaId)
    .eq('id', produtoId)
    .is('excluido_em', null)
    .order('ordem', { referencedTable: 'produto_imagens' })
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw naoEncontrado('Produto');
  return data;
}

/** Produto pelo código curto (#12), usado pelo bot. */
export async function obterProdutoPorNumero(lojaId: string, numero: number) {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('id')
    .eq('loja_id', lojaId)
    .eq('numero', numero)
    .is('excluido_em', null)
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw new HttpErro(404, `Não encontrei o produto #${numero}`);
  return obterProduto(lojaId, data.id);
}

export async function listarCategorias(lojaId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('categoria')
    .eq('loja_id', lojaId)
    .is('excluido_em', null)
    .not('categoria', 'is', null);
  if (error) throw erroDoBanco(error);
  return [...new Set(data.map((p) => p.categoria as string))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function criarProduto(lojaId: string, dados: ProdutoCriar) {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .insert({ ...dados, loja_id: lojaId })
    .select('id')
    .single();
  if (error) throw erroDoBanco(error);
  return obterProduto(lojaId, data.id);
}

export async function editarProduto(lojaId: string, produtoId: string, dados: ProdutoEditar) {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .update(dados)
    .eq('loja_id', lojaId)
    .eq('id', produtoId)
    .is('excluido_em', null)
    .select('id')
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw naoEncontrado('Produto');
  return obterProduto(lojaId, produtoId);
}

/** Exclusão lógica: some do painel e da vitrine, mas o registro (e o número #) fica no banco. */
export async function excluirProduto(lojaId: string, produtoId: string) {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .update({ excluido_em: new Date().toISOString(), ativo: false })
    .eq('loja_id', lojaId)
    .eq('id', produtoId)
    .is('excluido_em', null)
    .select('id')
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw naoEncontrado('Produto');
}
