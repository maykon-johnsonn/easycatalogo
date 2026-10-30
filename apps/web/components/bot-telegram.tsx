"use client";

import { useCallback, useState } from "react";
import { Bot, Copy, ExternalLink, Trash2 } from "lucide-react";
import { api, mensagemDeErro } from "@/lib/api";
import { formatarData } from "@/lib/formato";
import type { CodigoVinculo, StatusBot } from "@/lib/tipos";
import { useDados } from "@/lib/use-dados";
import { Aviso, Botao, Cartao, Carregando } from "@/components/ui";

/** Conecta contas do Telegram à loja, para gerenciar o catálogo por mensagem. */
export function BotTelegram({ lojaId }: { lojaId: string }) {
  const buscar = useCallback(() => api<StatusBot>(`/painel/lojas/${lojaId}/bot`), [lojaId]);
  const { dados: status, erro: erroCarga, recarregar } = useDados(buscar);
  const [vinculo, setVinculo] = useState<CodigoVinculo | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerarCodigo() {
    setErro(null);
    setGerando(true);
    try {
      setVinculo(await api<CodigoVinculo>(`/painel/lojas/${lojaId}/bot/vinculos`, { method: "POST" }));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setGerando(false);
    }
  }

  async function remover(id: string, nome: string | null) {
    if (!confirm(`Remover o acesso de ${nome ?? "esta conta"}? Ela não vai mais conseguir gerenciar a loja pelo bot.`)) return;
    try {
      await api(`/painel/lojas/${lojaId}/bot/operadores/${id}`, { method: "DELETE" });
      recarregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function copiar(texto: string) {
    await navigator.clipboard.writeText(texto).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Cartao className="space-y-4 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
          <Bot className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Bot do Telegram</h2>
          <p className="text-sm text-stone-500">
            Cadastre e altere produtos mandando mensagem, foto ou áudio pelo Telegram.
          </p>
        </div>
      </div>

      {(erro ?? erroCarga) && <Aviso>{erro ?? erroCarga}</Aviso>}

      {!status ? (
        !erroCarga && <Carregando />
      ) : !status.telegram_ativo ? (
        <Aviso tipo="info">O bot ainda não foi ligado no servidor. Assim que estiver disponível, você conecta sua conta por aqui.</Aviso>
      ) : (
        <>
          {!status.ia_configurada && (
            <Aviso tipo="info">O assistente de IA ainda está sendo configurado. Você já pode conectar sua conta.</Aviso>
          )}

          {status.operadores.length > 0 && (
            <ul className="divide-y divide-stone-100 rounded-lg ring-1 ring-stone-200">
              {status.operadores.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{o.nome ?? "Conta do Telegram"}</p>
                    <p className="text-xs text-stone-500">Conectada em {formatarData(o.criado_em)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remover(o.id, o.nome)}
                    className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    title="Remover acesso"
                    aria-label={`Remover acesso de ${o.nome ?? "conta do Telegram"}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {vinculo ? (
            <div className="space-y-3 rounded-lg bg-stone-50 p-4 text-sm ring-1 ring-stone-200">
              {vinculo.link && (
                <>
                  <p>
                    <strong>No celular</strong>, toque no botão abaixo e depois em <strong>Iniciar</strong> no Telegram:
                  </p>
                  <a
                    href={vinculo.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 font-medium text-white hover:bg-sky-700"
                  >
                    Abrir no Telegram <ExternalLink className="size-4" aria-hidden />
                  </a>
                </>
              )}
              <p className="text-stone-600">
                {vinculo.link ? "Ou envie este código para o bot:" : "Envie este código para o bot no Telegram:"}
              </p>
              <div className="flex items-center gap-2">
                <code className="rounded-lg bg-white px-3 py-2 font-mono text-lg tracking-widest ring-1 ring-stone-300">
                  {vinculo.codigo}
                </code>
                <Botao variante="secundario" onClick={() => copiar(vinculo.codigo)}>
                  <Copy className="size-4" aria-hidden /> {copiado ? "Copiado!" : "Copiar"}
                </Botao>
              </div>
              <p className="text-xs text-stone-500">
                Vale uma vez, até {new Date(vinculo.expira_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
                Depois de conectar,{" "}
                <button type="button" onClick={() => { setVinculo(null); recarregar(); }} className="font-medium text-marca-700 hover:underline">
                  atualize a lista
                </button>
                .
              </p>
            </div>
          ) : (
            <Botao variante={status.operadores.length ? "secundario" : "primario"} onClick={gerarCodigo} carregando={gerando}>
              {status.operadores.length ? "Conectar outra conta" : "Conectar meu Telegram"}
            </Botao>
          )}
        </>
      )}
    </Cartao>
  );
}
