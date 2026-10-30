import Link from "next/link";
import { Store } from "lucide-react";

export default function VitrineNaoEncontrada() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-stone-200 text-stone-500">
        <Store className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 max-w-sm text-stone-500">
        Este catálogo ou produto não existe, foi removido ou está temporariamente indisponível.
      </p>
      <Link href="/" className="mt-6 text-sm font-medium text-marca-600 hover:text-marca-700">
        Ir para a página inicial
      </Link>
    </main>
  );
}
