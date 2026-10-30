"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Me } from "@/lib/tipos";
import { useDados } from "@/lib/use-dados";
import { Aviso, Botao, Carregando } from "./ui";

type ContextoSessao = {
  me: Me;
  recarregarMe: () => void;
  sair: () => Promise<void>;
};

const Contexto = createContext<ContextoSessao | null>(null);

export function useSessao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useSessao fora de <SessaoProvider>");
  return ctx;
}

/** Garante usuário logado (senão manda para /entrar) e carrega /me para as áreas restritas. */
export function SessaoProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (sessao === null) router.replace(`/entrar?voltar=${encodeURIComponent(pathname)}`);
  }, [sessao, router, pathname]);

  // Depende só do id: a renovação automática do token troca o objeto da sessão, mas não o usuário.
  const usuarioId = sessao?.user.id;
  const buscarMe = useCallback(() => api<Me>("/me"), [usuarioId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { dados: me, erro, recarregar: recarregarMe } = useDados(usuarioId ? buscarMe : null);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/entrar");
  }, [router]);

  if (erro && !me) {
    return (
      <div className="mx-auto max-w-md p-6 space-y-4">
        <Aviso>{erro}</Aviso>
        <Botao variante="secundario" onClick={recarregarMe}>
          Tentar de novo
        </Botao>
      </div>
    );
  }
  if (!sessao || !me) return <Carregando />;

  return <Contexto.Provider value={{ me, recarregarMe, sair }}>{children}</Contexto.Provider>;
}
