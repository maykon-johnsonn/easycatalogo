import { supabaseAdmin } from '../../config/supabase.js';
import { erroDoBanco, HttpErro, naoEncontrado } from '../../lib/erros.js';
import { excluirImagens, salvarImagemProduto, type ImagemSalva } from '../storage/imagens.js';
import { obterProduto } from './produtos.service.js';

export const MAX_IMAGENS_POR_PRODUTO = 8;

/** Converte para WebP, envia ao storage e registra as imagens no fim da ordem atual. */
export async function adicionarImagens(lojaId: string, produtoId: string, arquivos: Buffer[]) {
  const produto = await obterProduto(lojaId, produtoId);
  verificarLimite(produto.imagens.length, arquivos.length);
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

  try {
    return await registrarImagens(lojaId, produtoId, enviadas, produto.imagens);
  } catch (err) {
    await excluirImagens(enviadas.map((e) => e.chave)).catch(() => {});
    throw err;
  }
}

/** Anexa imagens que já estão no storage (ex.: fotos recebidas pelo bot). */
export async function anexarImagensSalvas(lojaId: string, produtoId: string, imagens: ImagemSalva[]) {
  const produto = await obterProduto(lojaId, produtoId);
  verificarLimite(produto.imagens.length, imagens.length);
  return registrarImagens(lojaId, produtoId, imagens, produto.imagens);
}

function verificarLimite(atuais: number, novas: number) {
  if (atuais + novas > MAX_IMAGENS_POR_PRODUTO) {
    throw new HttpErro(400, `Cada produto pode ter no máximo ${MAX_IMAGENS_POR_PRODUTO} fotos (já tem ${atuais}).`);
  }
}

async function registrarImagens(lojaId: string, produtoId: string, imagens: ImagemSalva[], atuais: { ordem: number }[]) {
  const proximaOrdem = atuais.reduce((max, i) => Math.max(max, i.ordem + 1), 0);
  const { error } = await supabaseAdmin.from('produto_imagens').insert(
    imagens.map((e, i) => ({
      loja_id: lojaId,
      produto_id: produtoId,
      chave_storage: e.chave,
      url: e.url,
      ordem: proximaOrdem + i,
    })),
  );
  if (error) throw erroDoBanco(error);
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
