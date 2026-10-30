import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatarPreco } from "@/lib/formato";
import { obterVitrine, precoAtual, urlDoSite } from "@/lib/vitrine";
import { CabecalhoLoja, CartaoProduto, Preco, RodapeVitrine } from "@/components/vitrine";
import { Galeria } from "@/components/galeria";
import { PedidoWhatsApp } from "@/components/pedido-whatsapp";

async function obterProduto(params: PageProps<"/[slug]/p/[numero]">["params"]) {
  const { slug, numero } = await params;
  if (!/^\d{1,9}$/.test(numero)) return null;
  const vitrine = await obterVitrine(slug);
  const produto = vitrine?.produtos.find((p) => p.numero === Number(numero));
  return vitrine && produto ? { ...vitrine, produto } : null;
}

export async function generateMetadata({ params }: PageProps<"/[slug]/p/[numero]">): Promise<Metadata> {
  const dados = await obterProduto(params);
  if (!dados) return { title: "Produto não encontrado" };

  const { loja, produto } = dados;
  const preco = formatarPreco(precoAtual(produto));
  const resumo = produto.descricao?.replace(/\s+/g, " ").trim().slice(0, 200);
  const descricao = [preco, resumo].filter(Boolean).join(" · ").slice(0, 200);
  return {
    title: { absolute: `${produto.nome} · ${loja.nome}` },
    description: descricao,
    openGraph: {
      title: `${produto.nome} · ${preco}`,
      description: resumo || `Peça pelo WhatsApp na ${loja.nome}.`,
      url: `/${loja.slug}/p/${produto.numero}`,
      siteName: loja.nome,
      locale: "pt_BR",
      type: "website",
    },
  };
}

export default async function PaginaProduto({ params }: PageProps<"/[slug]/p/[numero]">) {
  const dados = await obterProduto(params);
  if (!dados) notFound();

  const { loja, produto, produtos } = dados;
  const relacionados = produtos
    .filter((p) => p.id !== produto.id && produto.categoria != null && p.categoria === produto.categoria)
    .slice(0, 4);

  return (
    <>
      <CabecalhoLoja loja={loja} voltar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 md:pb-12 md:pt-8">
        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          <Galeria imagens={produto.imagens} nome={produto.nome} />

          <div className="space-y-6">
            <div className="space-y-2">
              {produto.categoria && <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{produto.categoria}</p>}
              <h1 className="text-xl font-semibold tracking-tight text-pretty sm:text-2xl">{produto.nome}</h1>
              <p className="text-xs text-stone-400">Cód. #{produto.numero}</p>
              <div className="pt-1">
                <Preco produto={produto} grande />
              </div>
            </div>

            <PedidoWhatsApp
              telefone={loja.telefone_pedidos}
              url={`${urlDoSite()}/${loja.slug}/p/${produto.numero}`}
              produto={{
                numero: produto.numero,
                nome: produto.nome,
                preco: precoAtual(produto),
                tamanhos: produto.tamanhos,
                cores: produto.cores,
              }}
            />

            {produto.descricao && (
              <section className="border-t border-stone-200 pt-5">
                <h2 className="mb-2 text-sm font-medium text-stone-700">Descrição</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-stone-600">{produto.descricao}</p>
              </section>
            )}
          </div>
        </div>

        {relacionados.length > 0 && (
          <section className="mt-12 border-t border-stone-200 pt-8">
            <h2 className="mb-4 font-semibold">Mais em {produto.categoria}</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 lg:gap-x-5">
              {relacionados.map((p) => (
                <CartaoProduto key={p.id} slug={loja.slug} produto={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <RodapeVitrine />
    </>
  );
}
