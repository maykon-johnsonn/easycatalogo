import Link from "next/link";
import { MessageCircle, Smartphone, Store } from "lucide-react";

export default function PaginaInicial() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-marca-600 text-white">
            <Store className="size-4" aria-hidden />
          </span>
          Catálogo
        </span>
        <Link href="/entrar" className="rounded-lg px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-white">
          Entrar
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Seu catálogo de produtos, pronto para enviar no WhatsApp
        </h1>
        <p className="mt-5 max-w-xl text-lg text-stone-600 text-pretty">
          Chega de mandar dezenas de fotos e PDFs. Cadastre seus produtos e compartilhe um link com tudo organizado.
          Seus clientes pedem direto pelo WhatsApp.
        </p>
        <Link href="/entrar" className="mt-8 rounded-lg bg-marca-600 px-6 py-3 font-medium text-white hover:bg-marca-700">
          Acessar meu painel
        </Link>

        <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-2">
          <div className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
            <Smartphone className="size-5 text-marca-600" aria-hidden />
            <p className="mt-3 font-medium">Vitrine leve no celular</p>
            <p className="mt-1 text-sm text-stone-500">Fotos otimizadas, preços e tamanhos em uma página rápida.</p>
          </div>
          <div className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
            <MessageCircle className="size-5 text-marca-600" aria-hidden />
            <p className="mt-3 font-medium">Pedido direto no WhatsApp</p>
            <p className="mt-1 text-sm text-stone-500">O cliente escolhe o produto e fala com você em um toque.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
