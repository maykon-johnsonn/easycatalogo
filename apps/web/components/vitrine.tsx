import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatarPreco } from "@/lib/formato";
import { descontoPercentual, type ProdutoVitrine, type Vitrine } from "@/lib/vitrine";
import { cx } from "@/components/ui";

export function CabecalhoLoja({ loja, voltar }: { loja: Vitrine["loja"]; voltar?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href={`/${loja.slug}`} className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marca-600 text-sm font-semibold text-white">
            {loja.nome.trim().charAt(0).toUpperCase()}
          </span>
          <span className="truncate font-semibold">{loja.nome}</span>
        </Link>
        {voltar && (
          <Link href={`/${loja.slug}`} className="ml-auto shrink-0 text-sm font-medium text-marca-600 hover:text-marca-700">
            Ver catálogo
          </Link>
        )}
      </div>
    </header>
  );
}

export function Preco({ produto, grande }: { produto: Pick<ProdutoVitrine, "preco_original" | "preco_promocional">; grande?: boolean }) {
  const desconto = descontoPercentual(produto);
  if (produto.preco_promocional == null) {
    return <p className={cx("font-semibold tabular-nums", grande ? "text-2xl" : "text-sm")}>{formatarPreco(produto.preco_original)}</p>;
  }
  return (
    <div className={cx("flex flex-wrap items-baseline", grande ? "gap-x-3 gap-y-1" : "gap-x-2")}>
      <p className={cx("font-semibold tabular-nums text-marca-600", grande ? "text-2xl" : "text-sm")}>
        {formatarPreco(produto.preco_promocional)}
      </p>
      <p className={cx("tabular-nums text-stone-400 line-through", grande ? "text-base" : "text-xs")}>
        {formatarPreco(produto.preco_original)}
      </p>
      {grande && desconto != null && desconto > 0 && (
        <span className="rounded-full bg-marca-50 px-2 py-0.5 text-xs font-semibold text-marca-700">{desconto}% OFF</span>
      )}
    </div>
  );
}

export function CartaoProduto({ slug, produto, prioridade }: { slug: string; produto: ProdutoVitrine; prioridade?: boolean }) {
  const capa = produto.imagens[0];
  const desconto = descontoPercentual(produto);
  return (
    <Link href={`/${slug}/p/${produto.numero}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-stone-100">
        {capa ? (
          <Image
            src={capa.url}
            alt={produto.nome}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            priority={prioridade}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-stone-300">
            <ImageOff className="size-8" aria-hidden />
          </div>
        )}
        {desconto != null && desconto > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-marca-600 px-2 py-0.5 text-xs font-semibold text-white">
            -{desconto}%
          </span>
        )}
      </div>
      <div className="mt-2 space-y-0.5 px-0.5">
        <p className="line-clamp-2 text-sm text-stone-700">{produto.nome}</p>
        <Preco produto={produto} />
      </div>
    </Link>
  );
}

export function RodapeVitrine() {
  return (
    <footer className="mt-auto border-t border-stone-200 py-6 text-center text-xs text-stone-400">
      Catálogo digital criado com{" "}
      <Link href="/" className="font-medium text-stone-500 hover:text-stone-700">
        Catálogo
      </Link>
    </footer>
  );
}
