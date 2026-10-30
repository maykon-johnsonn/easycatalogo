import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Search } from "lucide-react";
import { linkWhatsApp } from "@/lib/formato";
import { obterVitrine, type ProdutoVitrine } from "@/lib/vitrine";
import { CabecalhoLoja, CartaoProduto, RodapeVitrine } from "@/components/vitrine";
import { cx } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const vitrine = await obterVitrine(slug);
  if (!vitrine) return { title: "Loja não encontrada" };

  const { loja, produtos } = vitrine;
  const descricao = `Confira o catálogo de ${loja.nome}${produtos.length ? ` com ${produtos.length} ${produtos.length === 1 ? "produto" : "produtos"}` : ""} e peça pelo WhatsApp.`;
  return {
    title: { absolute: loja.nome },
    description: descricao,
    openGraph: { title: loja.nome, description: descricao, url: `/${loja.slug}`, siteName: loja.nome, locale: "pt_BR", type: "website" },
  };
}

const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function filtrar(produtos: ProdutoVitrine[], categoria?: string, busca?: string) {
  const termo = busca ? normalizar(busca) : null;
  const numero = busca?.match(/^#?(\d+)$/)?.[1];
  return produtos.filter(
    (p) =>
      (!categoria || p.categoria === categoria) &&
      (!termo || normalizar(p.nome).includes(termo) || (numero != null && p.numero === Number(numero))),
  );
}

export default async function PaginaLoja({ params, searchParams }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const filtros = await searchParams;
  const vitrine = await obterVitrine(slug);
  if (!vitrine) notFound();

  const { loja, produtos, categorias } = vitrine;
  const categoria = categorias.find((c) => c === primeiro(filtros.categoria));
  const busca = primeiro(filtros.busca);
  const visiveis = filtrar(produtos, categoria, busca);
  const contato = linkWhatsApp(loja.telefone_pedidos, `Olá! Vi o catálogo da ${loja.nome} e gostaria de mais informações.`);

  const hrefFiltros = (c: string | undefined, b: string | undefined) => {
    const q = new URLSearchParams();
    if (c) q.set("categoria", c);
    if (b) q.set("busca", b);
    const s = q.toString();
    return `/${loja.slug}${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <CabecalhoLoja loja={loja} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10">
        <section className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between sm:py-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{loja.nome}</h1>
            <p className="mt-1 text-sm text-stone-500">
              {produtos.length} {produtos.length === 1 ? "produto" : "produtos"} · pedidos pelo WhatsApp
            </p>
          </div>
          <a
            href={contato}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg px-4 text-sm font-medium text-[#1f9d55] ring-1 ring-[#1f9d55]/40 hover:bg-[#1f9d55]/5 sm:self-auto"
          >
            <MessageCircle className="size-4" aria-hidden />
            Falar com a loja
          </a>
        </section>

        {produtos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-stone-500">
            Esta loja ainda não publicou produtos. Volte em breve!
          </p>
        ) : (
          <>
            <div className="sticky top-14 z-10 -mx-4 space-y-3 bg-stone-50/95 px-4 py-3 backdrop-blur">
              <Form action={`/${loja.slug}`} className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
                <input
                  type="search"
                  name="busca"
                  defaultValue={busca}
                  placeholder="Buscar produto"
                  aria-label="Buscar produto"
                  className="h-10 w-full rounded-lg bg-white pl-9 pr-3 text-sm ring-1 ring-stone-300 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-marca-500 sm:max-w-sm"
                />
                {categoria && <input type="hidden" name="categoria" value={categoria} />}
              </Form>

              {categorias.length > 0 && (
                <nav aria-label="Categorias" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
                  {[undefined, ...categorias].map((c) => {
                    const ativa = c === categoria;
                    return (
                      <Link
                        key={c ?? "todas"}
                        href={hrefFiltros(c, busca)}
                        scroll={false}
                        aria-current={ativa ? "page" : undefined}
                        className={cx(
                          "shrink-0 rounded-full px-4 py-1.5 text-sm ring-1 transition-colors",
                          ativa ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-700 ring-stone-300 hover:ring-stone-500",
                        )}
                      >
                        {c ?? "Todos"}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>

            {busca && (
              <p className="mt-2 text-sm text-stone-500">
                {visiveis.length} {visiveis.length === 1 ? "resultado" : "resultados"} para “{busca}”.{" "}
                <Link href={hrefFiltros(categoria, undefined)} className="font-medium text-marca-600 hover:text-marca-700">
                  Limpar busca
                </Link>
              </p>
            )}

            {visiveis.length === 0 ? (
              <p className="py-16 text-center text-stone-500">Nenhum produto encontrado.</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
                {visiveis.map((p, i) => (
                  <CartaoProduto key={p.id} slug={loja.slug} produto={p} prioridade={i < 4} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <RodapeVitrine />
    </>
  );
}
