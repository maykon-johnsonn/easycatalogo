"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { ExternalLink, LogOut, Plus, Search, Store, X } from "lucide-react";
import { ApiErro, api, mensagemDeErro } from "@/lib/api";
import { formatarData, formatarTelefone, gerarSlug } from "@/lib/formato";
import type { LojaPlataforma, ResumoPlataforma } from "@/lib/tipos";
import { useDados } from "@/lib/use-dados";
import { useSessao } from "@/components/sessao";
import { Aviso, Botao, BotaoLink, Campo, Cartao, Carregando, Entrada, Interruptor, Selo, Vazio } from "@/components/ui";

export default function PaginaPlataforma() {
  const { me, sair } = useSessao();
  const [erroAcao, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    const [resumo, lojas] = await Promise.all([
      api<ResumoPlataforma>("/plataforma/resumo"),
      api<LojaPlataforma[]>("/plataforma/lojas"),
    ]);
    return { resumo, lojas };
  }, []);
  const { dados, erro: erroCarga, recarregar: carregar } = useDados(me.admin_plataforma ? buscar : null);
  const resumo = dados?.resumo ?? null;
  const lojas = dados?.lojas ?? null;
  const erro = erroAcao ?? erroCarga;

  async function alternar(loja: LojaPlataforma) {
    const acao = loja.ativa ? "desativar" : "reativar";
    if (!confirm(`Deseja ${acao} a loja "${loja.nome}"?${loja.ativa ? " A vitrine sai do ar." : ""}`)) return;
    try {
      await api(`/plataforma/lojas/${loja.id}/status`, { method: "PATCH", body: { ativa: !loja.ativa } });
      carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  if (!me.admin_plataforma) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-4 py-12">
        <Aviso>Esta área é restrita à administração da plataforma.</Aviso>
        <BotaoLink href="/painel" variante="secundario">Ir para o painel</BotaoLink>
      </main>
    );
  }

  const termo = busca.trim().toLowerCase();
  const filtradas = lojas?.filter((l) => !termo || l.nome.toLowerCase().includes(termo) || l.slug.includes(termo)) ?? null;

  return (
    <>
      <header className="bg-stone-900 text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <span className="font-semibold">Administração da plataforma</span>
          <div className="flex-1" />
          <span className="hidden text-sm text-stone-400 sm:inline">{me.usuario.email}</span>
          {me.lojas.length > 0 && (
            <Link href="/painel" className="rounded-lg px-3 py-1.5 text-sm text-stone-300 hover:bg-white/10">Minhas lojas</Link>
          )}
          <button onClick={sair} className="rounded-lg p-2 text-stone-300 hover:bg-white/10" title="Sair">
            <LogOut className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:py-8">
        {erro && <Aviso>{erro}</Aviso>}
        {mensagem && <Aviso tipo="sucesso">{mensagem}</Aviso>}

        {!resumo || !filtradas ? (
          <Carregando />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador titulo="Lojas cadastradas" valor={resumo.lojas.total} detalhe={`${resumo.lojas.ativas} ativas`} />
              <Indicador titulo="Novas lojas (30 dias)" valor={resumo.lojas.novas_30d} />
              <Indicador titulo="Produtos no catálogo" valor={resumo.produtos.total} detalhe={`${resumo.produtos.ativos} visíveis · ${resumo.produtos.novos_30d} novos em 30 dias`} />
              <Indicador titulo="Usuários de painel" valor={resumo.usuarios_painel} />
            </section>

            <section className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <h2 className="flex-1 text-lg font-semibold">Lojas</h2>
                <div className="relative sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
                  <Entrada type="search" placeholder="Buscar loja" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" aria-label="Buscar loja" />
                </div>
                <Botao onClick={() => setCriando(true)}>
                  <Plus className="size-4" aria-hidden /> Nova loja
                </Botao>
              </div>

              {criando && (
                <NovaLoja
                  onCancelar={() => setCriando(false)}
                  onCriada={async (msg) => {
                    setCriando(false);
                    setMensagem(msg);
                    carregar();
                  }}
                />
              )}

              {filtradas.length === 0 ? (
                <Vazio titulo={termo ? "Nenhuma loja encontrada" : "Nenhuma loja cadastrada ainda"} />
              ) : (
                <Cartao className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Loja</th>
                          <th className="px-4 py-3 font-medium">WhatsApp</th>
                          <th className="px-4 py-3 text-right font-medium">Produtos</th>
                          <th className="px-4 py-3 font-medium">Última atividade</th>
                          <th className="px-4 py-3 font-medium">Desde</th>
                          <th className="px-4 py-3 font-medium">Ativa</th>
                          <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filtradas.map((l) => (
                          <tr key={l.id} className={l.ativa ? "" : "bg-stone-50/60 text-stone-500"}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-stone-900">{l.nome}</p>
                              <p className="text-xs text-stone-500">/{l.slug} · {l.membros} {l.membros === 1 ? "usuário" : "usuários"}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatarTelefone(l.telefone_pedidos)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {l.produtos.total}
                              {l.produtos.total > 0 && <span className="block text-xs text-stone-500">{l.produtos.ativos} visíveis</span>}
                            </td>
                            <td className="px-4 py-3">{l.produtos.ultima_atividade ? formatarData(l.produtos.ultima_atividade) : <Selo>Sem produtos</Selo>}</td>
                            <td className="px-4 py-3">{formatarData(l.criado_em)}</td>
                            <td className="px-4 py-3">
                              <Interruptor ligado={l.ativa} onChange={() => alternar(l)} rotulo={l.ativa ? "Desativar loja" : "Reativar loja"} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <Link href={`/painel/${l.slug}`} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900" title="Abrir painel da loja">
                                  <Store className="size-4" aria-hidden />
                                </Link>
                                <a href={`/${l.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900" title="Ver vitrine">
                                  <ExternalLink className="size-4" aria-hidden />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Cartao>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: number; detalhe?: string }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium text-stone-500">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor.toLocaleString("pt-BR")}</p>
      {detalhe && <p className="mt-0.5 text-xs text-stone-500">{detalhe}</p>}
    </Cartao>
  );
}

function NovaLoja({ onCancelar, onCriada }: { onCancelar: () => void; onCriada: (mensagem: string) => void }) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [telefone, setTelefone] = useState("55");
  const [email, setEmail] = useState("");
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setErros({});
    setSalvando(true);
    try {
      const loja = await api<{ nome: string; dono_convidado: boolean }>("/plataforma/lojas", {
        method: "POST",
        body: { nome, slug, telefone_pedidos: telefone, email_dono: email },
      });
      onCriada(
        loja.dono_convidado
          ? `Loja "${loja.nome}" criada. Um convite foi enviado para ${email}.`
          : `Loja "${loja.nome}" criada e vinculada à conta existente de ${email}.`,
      );
    } catch (e) {
      if (e instanceof ApiErro && e.detalhes) setErros(Object.fromEntries(Object.entries(e.detalhes).map(([k, v]) => [k, v?.[0]])));
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao className="p-4 sm:p-6">
      <form onSubmit={criar} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Nova loja</h3>
          <button type="button" onClick={onCancelar} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Cancelar">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome da loja" erro={erros.nome}>
            <Entrada
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                if (!slugEditado) setSlug(gerarSlug(e.target.value));
              }}
              required
              autoFocus
            />
          </Campo>
          <Campo rotulo="Endereço da vitrine" erro={erros.slug} ajuda={slug ? `/${slug}` : "Letras minúsculas, números e hífens"}>
            <Entrada
              value={slug}
              onChange={(e) => {
                setSlugEditado(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              required
            />
          </Campo>
          <Campo rotulo="WhatsApp para pedidos" erro={erros.telefone_pedidos} ajuda="DDI + DDD + número. Ex.: 5511999998888">
            <Entrada inputMode="numeric" value={telefone} onChange={(e) => setTelefone(e.target.value.replace(/\D/g, "").slice(0, 15))} required />
          </Campo>
          <Campo rotulo="E-mail do dono" erro={erros.email_dono} ajuda="Se ainda não tiver conta, recebe um convite">
            <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Campo>
        </div>
        <div className="flex gap-2">
          <Botao type="submit" carregando={salvando}>Criar loja</Botao>
          <Botao variante="fantasma" onClick={onCancelar}>Cancelar</Botao>
        </div>
      </form>
    </Cartao>
  );
}
