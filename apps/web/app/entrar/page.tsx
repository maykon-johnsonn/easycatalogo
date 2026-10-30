import type { Metadata } from "next";
import { Suspense } from "react";
import { Store } from "lucide-react";
import { Cartao, Carregando } from "@/components/ui";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaEntrar() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-marca-600 text-white">
            <Store className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Entrar no painel</h1>
          <p className="mt-1 text-sm text-stone-500">Gerencie os produtos da sua loja</p>
        </div>
        <Cartao className="p-6">
          <Suspense fallback={<Carregando />}>
            <FormularioEntrar />
          </Suspense>
        </Cartao>
      </div>
    </main>
  );
}
