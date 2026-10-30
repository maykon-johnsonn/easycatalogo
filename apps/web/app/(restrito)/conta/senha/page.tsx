"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSessao } from "@/components/sessao";
import { Aviso, Botao, Campo, Cartao, Entrada } from "@/components/ui";

export default function PaginaDefinirSenha() {
  const router = useRouter();
  const { me } = useSessao();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres");
    if (senha !== confirmacao) return setErro("As senhas não conferem");

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return setErro(error.message);
    router.replace("/painel");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight">Definir senha</h1>
        <p className="mb-8 text-center text-sm text-stone-500">{me.usuario.email}</p>
        <Cartao className="p-6">
          <form onSubmit={salvar} className="space-y-5">
            {erro && <Aviso>{erro}</Aviso>}
            <Campo rotulo="Nova senha" ajuda="Mínimo de 8 caracteres">
              <Entrada type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </Campo>
            <Campo rotulo="Confirme a senha">
              <Entrada type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
            </Campo>
            <Botao type="submit" carregando={salvando} className="w-full">
              Salvar senha
            </Botao>
          </form>
        </Cartao>
      </div>
    </main>
  );
}
