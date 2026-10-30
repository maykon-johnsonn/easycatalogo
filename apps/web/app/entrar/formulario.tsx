"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Aviso, Botao, Campo, Entrada, cx } from "@/components/ui";

type Modo = "senha" | "link";

/** Só aceita caminhos internos, para o parâmetro ?voltar= não virar redirecionamento para fora. */
function destinoSeguro(voltar: string | null) {
  return voltar && voltar.startsWith("/") && !voltar.startsWith("//") ? voltar : "/painel";
}

export function FormularioEntrar() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = destinoSeguro(params.get("voltar"));
  const primeiroAcesso = params.has("primeiro-acesso");

  const [modo, setModo] = useState<Modo>("senha");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Já logado (inclusive voltando do link do e-mail ou do convite): segue direto.
  useEffect(() => {
    const seguir = () => router.replace(primeiroAcesso ? "/conta/senha?primeiro-acesso=1" : destino);
    supabase.auth.getSession().then(({ data }) => data.session && seguir());
    const { data } = supabase.auth.onAuthStateChange((evento) => evento === "SIGNED_IN" && seguir());
    return () => data.subscription.unsubscribe();
  }, [router, destino, primeiroAcesso]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);
    try {
      if (modo === "senha") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/entrar?voltar=${encodeURIComponent(destino)}` },
        });
        if (error) throw new Error(error.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : error.message);
        setAviso("Se este e-mail tiver acesso, você vai receber um link para entrar. Confira também o spam.");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar");
    } finally {
      setEnviando(false);
    }
  }

  async function esqueciSenha() {
    setErro(null);
    if (!email) return setErro("Digite seu e-mail primeiro");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/conta/senha` });
    if (error) return setErro(error.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : error.message);
    setAviso("Enviamos um link para criar uma nova senha. Confira seu e-mail.");
  }

  return (
    <form onSubmit={entrar} className="space-y-5">
      <div className="grid grid-cols-2 rounded-lg bg-stone-100 p-1 text-sm font-medium">
        {(["senha", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={cx("rounded-md py-2 transition", modo === m ? "bg-white shadow-sm text-stone-900" : "text-stone-500")}
          >
            {m === "senha" ? "Com senha" : "Link por e-mail"}
          </button>
        ))}
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}

      <Campo rotulo="E-mail">
        <Entrada type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Campo>

      {modo === "senha" && (
        <Campo rotulo="Senha">
          <Entrada type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
      )}

      <Botao type="submit" carregando={enviando} className="w-full">
        {modo === "senha" ? "Entrar" : "Enviar link de acesso"}
      </Botao>

      {modo === "senha" && (
        <button type="button" onClick={esqueciSenha} className="block w-full text-center text-sm text-marca-700 hover:underline">
          Esqueci minha senha
        </button>
      )}
    </form>
  );
}
