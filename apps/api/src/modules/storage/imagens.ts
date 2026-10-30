import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { storage } from './drivers.js';

const LARGURA_MAXIMA = 1200;
const QUALIDADE_WEBP = 80;

export type ImagemSalva = { chave: string; url: string };

/** Converte qualquer imagem para WebP (máx. 1200px de largura, qualidade 80). Regra 4 do direcao.md. */
export async function converterParaWebp(original: Buffer): Promise<Buffer> {
  return sharp(original, { failOn: 'error' })
    .rotate() // respeita a orientação EXIF de fotos de celular antes de descartar os metadados
    .resize({ width: LARGURA_MAXIMA, withoutEnlargement: true })
    .webp({ quality: QUALIDADE_WEBP })
    .toBuffer();
}

/** Converte e envia a imagem de um produto. A chave começa pelo loja_id para facilitar limpeza e backup por loja. */
export async function salvarImagemProduto(lojaId: string, produtoId: string, original: Buffer): Promise<ImagemSalva> {
  const webp = await converterParaWebp(original);
  const chave = `${lojaId}/${produtoId}/${randomUUID()}.webp`;
  await storage.enviar(chave, webp, 'image/webp');
  return { chave, url: storage.urlPublica(chave) };
}

export async function excluirImagens(chaves: string[]): Promise<void> {
  await storage.excluir(chaves);
}
