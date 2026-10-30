"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ExternalLink, LayoutDashboard, LogOut, Package, Settings, Store } from "lucide-react";
import { api } from "@/lib/api";
import type { LojaPlataforma, LojaResumo } from "@/lib/tipos";
import { useDados } from "@/lib/use-dados";
import { useSessao } from "./sessao";
import { Aviso, BotaoLink, Carregando, cx } from "./ui";

type ContextoLoja = { loja: LojaResumo; recarregarLoja: () => void };
const Contexto = createContext<ContextoLoja | null>(null);

export function useLoja() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useLoja fora do painel da loja");
  return ctx;
}

/**
 * Resolve a loja pelo slug da URL. Membros encontram a loja no /me;
 * admins da plataforma também podem abrir qualquer loja (suporte).
 */
export function PainelLoja({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { me } = useSessao();
  const buscar = useCallback(async () => {
    let id = me.lojas.find((l) => l.slug === slug)?.id;
    if (!id && me.admin_plataforma) {
      const todas = await api<LojaPlataforma[]>("/plataforma/lojas");
      id = todas.find((l) => l.slug === slug)?.id;
    }
    if (!id) throw new Error("Loja não encontrada ou você não tem acesso a ela.");
    return api<LojaResumo>(`/painel/lojas/${id}`);
  }, [slug, me]);
  const { dados: loja, erro, recarregar } = useDados(buscar);

  if (erro && loja?.slug !== slug) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-4 py-12">
        <Aviso>{erro}</Aviso>
        <BotaoLink href="/painel" variante="secundario">
          Voltar
        </BotaoLink>
      </main>
    );
  }
  if (!loja || loja.slug !== slug) return <Carregando />;

  return (
    <Contexto.Provider value={{ loja, recarregarLoja: recarregar }}>
      <Cabecalho loja={loja} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </Contexto.Provider>
  );
}

function Cabecalho({ loja }: { loja: LojaResumo }) {
  const pathname = usePathname();
  const { me, sair } = useSessao();
  const base = `/painel/${loja.slug}`;
  const abas = [
    { href: base, rotulo: "Produtos", icone: Package, ativa: pathname === base || pathname.startsWith(`${base}/produtos`) },
    { href: `${base}/configuracoes`, rotulo: "Loja", icone: Settings, ativa: pathname.startsWith(`${base}/configuracoes`) },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/painel" className="flex min-w-0 items-center gap-2 font-semibold">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-marca-600 text-white">
            <Store className="size-4" aria-hidden />
          </span>
          <span className="truncate">{loja.nome}</span>
        </Link>
        {!loja.ativa && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Loja desativada</span>}
        <div className="flex-1" />
        <a
          href={`/${loja.slug}`}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 sm:flex"
        >
          Ver vitrine <ExternalLink className="size-3.5" aria-hidden />
        </a>
        {me.admin_plataforma && (
          <Link href="/plataforma" className="rounded-lg p-2 text-stone-600 hover:bg-stone-100" title="Administração da plataforma">
            <LayoutDashboard className="size-5" aria-hidden />
          </Link>
        )}
        <button onClick={sair} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100" title="Sair">
          <LogOut className="size-5" aria-hidden />
        </button>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 px-4">
        {abas.map(({ href, rotulo, icone: Icone, ativa }) => (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium",
              ativa ? "border-marca-600 text-marca-700" : "border-transparent text-stone-500 hover:text-stone-800",
            )}
          >
            <Icone className="size-4" aria-hidden /> {rotulo}
          </Link>
        ))}
        <a href={`/${loja.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-sm font-medium text-stone-500 sm:hidden">
          Vitrine <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </nav>
    </header>
  );
}
