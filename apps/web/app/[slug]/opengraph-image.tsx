import { cartaoTexto, TAMANHO_OG } from "@/lib/og";
import { obterVitrine } from "@/lib/vitrine";

export const size = TAMANHO_OG;
export const contentType = "image/jpeg";
export const alt = "Catálogo da loja";

export default async function ImagemLoja({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vitrine = await obterVitrine(slug);
  if (!vitrine) return cartaoTexto("Catálogo", "Loja não encontrada");

  const total = vitrine.produtos.length;
  return cartaoTexto(vitrine.loja.nome, `${total} ${total === 1 ? "produto" : "produtos"} · peça pelo WhatsApp`);
}
