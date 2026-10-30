"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import { ApiErro, api, mensagemDeErro } from "@/lib/api";
import { formatarTelefone } from "@/lib/formato";
import type { LojaResumo } from "@/lib/tipos";
import { useLoja } from "@/components/loja-contexto";
import { BotTelegram } from "@/components/bot-telegram";
import { Aviso, Botao, Campo, Cartao, Entrada } from "@/components/ui";

export default function PaginaConfiguracoes() {
  const { loja, recarregarLoja } = useLoja();
  const [nome, setNome] = useState(loja.nome);
  const [slug, setSlug] = useState(loja.slug);
  const [telefone, setTelefone] = useState(loja.telefone_pedidos);
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const mudouSlug = slug !== loja.slug;
  const urlVitrine = typeof window === "undefined" ? `/${slug}` : `${location.origin}/${slug}`;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setErros({});
    setSalvo(false);
    if (mudouSlug && !confirm("Mudar o endereço quebra os links da vitrine que você já compartilhou. Continuar?")) return;

    setSalvando(true);
    try {
      const atualizada = await api<LojaResumo>(`/painel/lojas/${loja.id}`, {
        method: "PATCH",
        body: { nome, slug, telefone_pedidos: telefone },
      });
      if (atualizada.slug !== loja.slug) {
        // O endereço do painel também muda: recarrega a página inteira já no novo endereço, para
        // sessão e loja serem carregadas do zero (navegar pelo router deixaria o /me desatualizado).
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        location.assign(`${location.origin}/painel/${atualizada.slug}/configuracoes`);
        return;
      }
      recarregarLoja();
      setSalvo(true);
    } catch (e) {
      if (e instanceof ApiErro && e.detalhes) {
        setErros(Object.fromEntries(Object.entries(e.detalhes).map(([k, v]) => [k, v?.[0]])));
      }
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dados da loja</h1>

      {erro && <Aviso>{erro}</Aviso>}
      {salvo && <Aviso tipo="sucesso">Dados salvos.</Aviso>}

      <form onSubmit={salvar}>
        <Cartao className="space-y-5 p-4 sm:p-6">
          <Campo rotulo="Nome da loja" erro={erros.nome}>
            <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} required />
          </Campo>

          <Campo
            rotulo="Endereço da vitrine"
            erro={erros.slug}
            ajuda={
              <a href={`/${loja.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-marca-700 hover:underline">
                {urlVitrine} <ExternalLink className="size-3" aria-hidden />
              </a>
            }
          >
            <div className="flex rounded-lg ring-1 ring-stone-300 focus-within:ring-2 focus-within:ring-marca-500">
              <span className="flex items-center rounded-l-lg bg-stone-50 px-3 text-sm text-stone-500">/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                maxLength={50}
                required
                className="h-10 w-full rounded-r-lg bg-white px-3 text-stone-900 outline-none"
              />
            </div>
          </Campo>
          {mudouSlug && <Aviso tipo="info">Ao salvar, o link antigo da vitrine deixa de funcionar.</Aviso>}

          <Campo
            rotulo="WhatsApp para pedidos"
            erro={erros.telefone_pedidos}
            ajuda={telefone.length >= 12 ? `Os clientes vão chamar ${formatarTelefone(telefone)}` : "Com DDI e DDD, só números. Ex.: 5511999998888"}
          >
            <Entrada
              inputMode="numeric"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value.replace(/\D/g, "").slice(0, 15))}
              required
            />
          </Campo>

          <Botao type="submit" carregando={salvando}>
            Salvar
          </Botao>
        </Cartao>
      </form>

      <BotTelegram lojaId={loja.id} />
    </div>
  );
}
