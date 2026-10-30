"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LayoutDashboard, LogOut } from "lucide-react";
import { useSessao } from "@/components/sessao";
import { Botao, Cartao, Carregando, Vazio } from "@/components/ui";

/** Ponto de entrada após o login: leva direto à loja quando só existe uma. */
export default function PaginaPainel() {
  const router = useRouter();
  const { me, sair } = useSessao();
  const unica = me.lojas.length === 1 && !me.admin_plataforma ? me.lojas[0] : null;
  const soAdmin = me.lojas.length === 0 && me.admin_plataforma;

  useEffect(() => {
    if (unica) router.replace(`/painel/${unica.slug}`);
    else if (soAdmin) router.replace("/plataforma");
  }, [unica, soAdmin, router]);

  if (unica || soAdmin) return <Carregando />;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suas lojas</h1>
          <p className="text-sm text-stone-500">{me.usuario.email}</p>
        </div>
        <Botao variante="fantasma" onClick={sair}>
          <LogOut className="size-4" aria-hidden /> Sair
        </Botao>
      </div>

      {me.admin_plataforma && (
        <Link href="/plataforma" className="mb-4 flex items-center gap-3 rounded-xl bg-stone-900 p-4 text-white hover:bg-stone-800">
          <LayoutDashboard className="size-5" aria-hidden />
          <span className="flex-1 font-medium">Administração da plataforma</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}

      {me.lojas.length === 0 ? (
        <Vazio titulo="Nenhuma loja vinculada" descricao="Peça ao administrador para vincular sua conta a uma loja." />
      ) : (
        <Cartao className="divide-y divide-stone-100">
          {me.lojas.map((loja) => (
            <Link key={loja.id} href={`/painel/${loja.slug}`} className="flex items-center gap-3 p-4 hover:bg-stone-50">
              <div className="flex-1">
                <p className="font-medium">{loja.nome}</p>
                <p className="text-sm text-stone-500">/{loja.slug}</p>
              </div>
              <ChevronRight className="size-4 text-stone-400" aria-hidden />
            </Link>
          ))}
        </Cartao>
      )}
    </main>
  );
}
