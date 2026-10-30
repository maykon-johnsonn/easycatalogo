import { supabaseAdmin } from '../../config/supabase.js';
import { erroDoBanco, HttpErro, naoEncontrado } from '../../lib/erros.js';
import { excluirImagens, salvarImagemProduto, type ImagemSalva } from '../storage/imagens.js';
import { obterProduto } from './produtos.service.js';

export const MAX_IMAGENS_POR_PRODUTO = 8;

/** Converte para WebP, envia ao storage e registra as imagens no fim da ordem atual. */
export async function adicionarImagens(lojaId: string, produtoId: string, arquivos: Buffer[]) {
  const produto = await obterProduto(lojaId, produtoId);
  const atuais = produto.imagens.length;

  if (atuais + arquivos.length > MAX_IMAGENS_POR_PRODUTO) {
    throw new HttpErro(
      400,
      `Cada produto pode ter no máximo ${MAX_IMAGENS_POR_PRODUTO} fotos (já tem ${atuais}).`,
    );
  }

  const proximaOrdem = produto.imagens.reduce((max, i) => Math.max(max, i.ordem + 1), 0);
  const enviadas: ImagemSalva[] = [];

  try {
    for (const arquivo of arquivos) {
      enviadas.push(await salvarImagemProduto(lojaId, produtoId, arquivo));
    }
  } catch (err) {
    await excluirImagens(enviadas.map((e) => e.chave)).catch(() => {});
    if (err instanceof Error && /unsupported image format|Input buffer/i.test(err.message)) {
      throw new HttpErro(400, 'Arquivo não é uma imagem válida');
    }
    throw err;
  }

  const { error } = await supabaseAdmin.from('produto_imagens').insert(
    enviadas.map((e, i) => ({
      loja_id: lojaId,
      produto_id: produtoId,
      chave_storage: e.chave,
      url: e.url,
      ordem: proximaOrdem + i,
    })),
  );
  if (error) {
    await excluirImagens(enviadas.map((e) => e.chave)).catch(() => {});
    throw erroDoBanco(error);
  }

  return obterProduto(lojaId, produtoId);
}

export async function removerImagem(lojaId: string, imagemId: string) {
  const { data, error } = await supabaseAdmin
    .from('produto_imagens')
    .delete()
    .eq('loja_id', lojaId)
    .eq('id', imagemId)
    .select('chave_storage')
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw naoEncontrado('Imagem');

  // O registro já saiu; se o arquivo falhar ao apagar, sobra só um arquivo órfão no bucket.
  await excluirImagens([data.chave_storage]);
}

/** Recebe todos os ids das imagens do produto na nova ordem. */
export async function reordenarImagens(lojaId: string, produtoId: string, idsNaOrdem: string[]) {
  const produto = await obterProduto(lojaId, produtoId);
  const atuais = new Set(produto.imagens.map((i) => i.id));

  const enviados = new Set(idsNaOrdem);
  if (enviados.size !== idsNaOrdem.length || enviados.size !== atuais.size || !idsNaOrdem.every((id) => atuais.has(id))) {
    throw new HttpErro(400, 'Envie todas as imagens do produto, cada uma uma vez');
  }

  for (const [ordem, id] of idsNaOrdem.entries()) {
    const { error } = await supabaseAdmin
      .from('produto_imagens')
      .update({ ordem })
      .eq('loja_id', lojaId)
      .eq('id', id);
    if (error) throw erroDoBanco(error);
  }

  return obterProduto(lojaId, produtoId);
}
