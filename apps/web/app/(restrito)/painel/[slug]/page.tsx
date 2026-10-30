"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ImageOff, Plus, Search } from "lucide-react";
import { api, mensagemDeErro } from "@/lib/api";
import { formatarPreco } from "@/lib/formato";
import type { Produto } from "@/lib/tipos";
import { useDados } from "@/lib/use-dados";
import { useLoja } from "@/components/loja-contexto";
import { Aviso, BotaoLink, Carregando, Entrada, Interruptor, Selo, Vazio, cx, estiloInput } from "@/components/ui";

type Status = "todos" | "ativos" | "pausados";

export default function PaginaProdutos() {
  const { loja } = useLoja();
  const base = `/painel/lojas/${loja.id}`;

  const [categorias, setCategorias] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [status, setStatus] = useState<Status>("todos");
  const [categoria, setCategoria] = useState("");
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // Espera o lojista parar de digitar antes de buscar.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const buscar = useCallback(() => {
    const q = new URLSearchParams({ status });
    if (buscaAplicada) q.set("busca", buscaAplicada);
    if (categoria) q.set("categoria", categoria);
    return api<Produto[]>(`${base}/produtos?${q}`);
  }, [base, status, buscaAplicada, categoria]);
  const { dados: produtos, erro: erroCarga, recarregar, definir } = useDados(buscar);
  const erro = erroAcao ?? erroCarga;

  useEffect(() => {
    api<string[]>(`${base}/categorias`).then(setCategorias).catch(() => {});
  }, [base]);

  async function alternarAtivo(p: Produto) {
    setErroAcao(null);
    definir((lista) => lista?.map((x) => (x.id === p.id ? { ...x, ativo: !p.ativo } : x)) ?? null);
    try {
      await api(`${base}/produtos/${p.id}`, { method: "PATCH", body: { ativo: !p.ativo } });
      if (status !== "todos") recarregar();
    } catch (e) {
      setErroAcao(mensagemDeErro(e));
      recarregar();
    }
  }

  const filtrando = Boolean(buscaAplicada || categoria || status !== "todos");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Produtos</h1>
          {produtos && (
            <p className="text-sm text-stone-500">
              {produtos.length} {produtos.length === 1 ? "produto" : "produtos"}
              {filtrando && " encontrados"}
            </p>
          )}
        </div>
        <BotaoLink href={`/painel/${loja.slug}/produtos/novo`}>
          <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">Novo produto</span>
          <span className="sm:hidden">Novo</span>
        </BotaoLink>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <Entrada
            type="search"
            placeholder="Buscar por nome ou #número"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
            aria-label="Buscar produtos"
          />
        </div>
        <div className="flex gap-3">
          <div className="grid grid-cols-3 rounded-lg bg-stone-100 p-1 text-sm font-medium">
            {(["todos", "ativos", "pausados"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cx("rounded-md px-3 py-1.5 capitalize", status === s ? "bg-white shadow-sm" : "text-stone-500")}
              >
                {s}
              </button>
            ))}
          </div>
          {categorias.length > 0 && (
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={cx(estiloInput, "w-auto min-w-0 flex-1 sm:w-44")}
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {erro && <Aviso>{erro}</Aviso>}

      {!produtos ? (
        <Carregando />
      ) : produtos.length === 0 ? (
        filtrando ? (
          <Vazio titulo="Nenhum produto encontrado" descricao="Tente outra busca ou limpe os filtros." />
        ) : (
          <Vazio
            titulo="Sua loja ainda não tem produtos"
            descricao="Cadastre o primeiro produto com fotos, preço e tamanhos."
            acao={<BotaoLink href={`/painel/${loja.slug}/produtos/novo`}><Plus className="size-4" aria-hidden /> Cadastrar produto</BotaoLink>}
          />
        )
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
          {produtos.map((p) => (
            <li key={p.id} className={cx("overflow-hidden rounded-xl bg-white ring-1 ring-stone-200", !p.ativo && "opacity-75")}>
              <Link href={`/painel/${loja.slug}/produtos/${p.id}`} className="block">
                <div className="relative aspect-square bg-stone-100">
                  {p.imagens[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagens[0].url} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-stone-300">
                      <ImageOff className="size-8" aria-hidden />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-xs text-stone-600">#{p.numero}</span>
                  {p.preco_promocional != null && p.ativo && (
                    <span className="absolute right-2 top-2"><Selo cor="marca">Promoção</Selo></span>
                  )}
                </div>
                <div className="p-3 pb-2">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{p.nome}</p>
                  <p className="mt-1 text-sm">
                    {p.preco_promocional != null ? (
                      <>
                        <span className="font-semibold text-marca-700">{formatarPreco(p.preco_promocional)}</span>{" "}
                        <span className="text-xs text-stone-400 line-through">{formatarPreco(p.preco_original)}</span>
                      </>
                    ) : (
                      <span className="font-semibold">{formatarPreco(p.preco_original)}</span>
                    )}
                  </p>
                </div>
              </Link>
              <div className="flex items-center justify-between px-3 pb-3">
                {p.ativo ? <Selo cor="verde">Ativo</Selo> : <Selo cor="ambar">Pausado</Selo>}
                <Interruptor ligado={p.ativo} onChange={() => alternarAtivo(p)} rotulo={p.ativo ? "Pausar produto" : "Ativar produto"} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

