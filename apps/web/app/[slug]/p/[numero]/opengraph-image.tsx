import { formatarPreco } from "@/lib/formato";
import { cartaoTexto, fotoProduto, TAMANHO_OG } from "@/lib/og";
import { obterVitrine, precoAtual } from "@/lib/vitrine";

export const size = TAMANHO_OG;
export const contentType = "image/jpeg";
export const alt = "Foto do produto";

export default async function ImagemProduto({ params }: { params: Promise<{ slug: string; numero: string }> }) {
  const { slug, numero } = await params;
  const vitrine = /^\d{1,9}$/.test(numero) ? await obterVitrine(slug) : null;
  const produto = vitrine?.produtos.find((p) => p.numero === Number(numero));
  if (!vitrine || !produto) return cartaoTexto("Catálogo", "Produto não encontrado");

  const capa = produto.imagens[0];
  if (capa) {
    try {
      return await fotoProduto(capa.url);
    } catch {
      // Sem a foto, cai no cartão com o nome e o preço.
    }
  }
  return cartaoTexto(produto.nome, `${formatarPreco(precoAtual(produto))} · ${vitrine.loja.nome}`);
}
