import { ImageResponse } from "next/og";
import sharp from "sharp";

// Imagens de preview (WhatsApp, redes sociais). Sempre em JPEG: o preview do WhatsApp
// não exibe WebP de forma confiável, e as fotos dos produtos são guardadas em WebP.

export const TAMANHO_OG = { width: 1200, height: 630 };

const jpeg = (buffer: Buffer) =>
  new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300" },
  });

/** Cartão só com texto, para loja (ou produto sem foto). */
export async function cartaoTexto(titulo: string, subtitulo: string) {
  const png = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#9c3f5b",
          color: "white",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, display: "flex" }}>{titulo.slice(0, 60)}</div>
        <div style={{ fontSize: 36, marginTop: 24, opacity: 0.85, display: "flex" }}>{subtitulo.slice(0, 90)}</div>
      </div>
    ),
    TAMANHO_OG,
  );
  return jpeg(await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 85 }).toBuffer());
}

/** Foto do produto enquadrada inteira (sem cortar) em fundo claro. */
export async function fotoProduto(url: string) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Foto indisponível (${resposta.status})`);
  const buffer = await sharp(Buffer.from(await resposta.arrayBuffer()))
    .resize({ ...TAMANHO_OG, fit: "contain", background: "#f5f5f4" })
    .flatten({ background: "#f5f5f4" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return jpeg(buffer);
}
