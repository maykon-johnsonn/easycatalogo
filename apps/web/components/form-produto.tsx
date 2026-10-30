"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiErro, api, mensagemDeErro } from "@/lib/api";
import { lerPreco, precoParaCampo } from "@/lib/formato";
import type { Produto } from "@/lib/tipos";
import { Etiquetas } from "./etiquetas";
import { Aviso, AreaTexto, Botao, Campo, Cartao, Entrada, Interruptor } from "./ui";

const TAMANHOS = ["PP", "P", "M", "G", "GG", "Único", "36", "38", "40", "42", "44"];
const CORES = ["Preto", "Branco", "Bege", "Azul", "Rosa", "Vermelho", "Verde", "Dourado", "Prateado"];

export type DadosProduto = {
  nome: string;
  descricao: string | null;
  preco_original: number;
  preco_promocional: number | null;
  categoria: string | null;
  tamanhos: string[];
  cores: string[];
  ativo: boolean;
};

type Erros = Partial<Record<keyof DadosProduto, string>>;

/**
 * Campos do produto. Quem usa decide o que fazer ao salvar (criar ou editar).
 * `extra` aparece entre os campos e o botão (ex.: fotos no cadastro).
 */
export function FormProduto({
  lojaId,
  produto,
  rotuloSalvar,
  onSalvar,
  extra,
}: {
  lojaId: string;
  produto?: Produto;
  rotuloSalvar: string;
  onSalvar: (dados: DadosProduto) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [preco, setPreco] = useState(precoParaCampo(produto?.preco_original));
  const [promo, setPromo] = useState(precoParaCampo(produto?.preco_promocional));
  const [categoria, setCategoria] = useState(produto?.categoria ?? "");
  const [tamanhos, setTamanhos] = useState<string[]>(produto?.tamanhos ?? []);
  const [cores, setCores] = useState<string[]>(produto?.cores ?? []);
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [ativo, setAtivo] = useState(produto?.ativo ?? true);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api<string[]>(`/painel/lojas/${lojaId}/categorias`).then(setCategorias).catch(() => {});
  }, [lojaId]);

  function validar(): DadosProduto | null {
    const e: Erros = {};
    const original = lerPreco(preco);
    const promocional = lerPreco(promo);

    if (!nome.trim()) e.nome = "Informe o nome do produto";
    if (original === null) e.preco_original = "Informe o preço";
    else if (Number.isNaN(original) || original <= 0) e.preco_original = "Preço inválido (ex.: 59,90)";
    if (promocional !== null) {
      if (Number.isNaN(promocional) || promocional <= 0) e.preco_promocional = "Preço inválido (ex.: 49,90)";
      else if (original && promocional >= original) e.preco_promocional = "Deve ser menor que o preço normal";
    }

    setErros(e);
    if (Object.keys(e).length) return null;
    return {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      preco_original: original!,
      preco_promocional: promocional,
      categoria: categoria.trim() || null,
      tamanhos,
      cores,
      ativo,
    };
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErroGeral(null);
    const dados = validar();
    if (!dados) return;
    setSalvando(true);
    try {
      await onSalvar(dados);
    } catch (e) {
      if (e instanceof ApiErro && e.detalhes) {
        setErros(Object.fromEntries(Object.entries(e.detalhes).map(([k, v]) => [k, v?.[0]])) as Erros);
      }
      setErroGeral(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      {erroGeral && <Aviso>{erroGeral}</Aviso>}

      <Cartao className="space-y-5 p-4 sm:p-6">
        <Campo rotulo="Nome do produto" erro={erros.nome}>
          <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder="Ex.: Blusa canelada manga longa" autoFocus={!produto} />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Preço" erro={erros.preco_original}>
            <PrecoInput valor={preco} onChange={setPreco} />
          </Campo>
          <Campo rotulo="Preço promocional" erro={erros.preco_promocional} ajuda="Opcional">
            <PrecoInput valor={promo} onChange={setPromo} />
          </Campo>
        </div>

        <Campo rotulo="Categoria" ajuda="Opcional. Ex.: Blusas, Vestidos, Brincos">
          <Entrada value={categoria} onChange={(e) => setCategoria(e.target.value)} list="categorias-loja" maxLength={60} />
          <datalist id="categorias-loja">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>

        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-700">Tamanhos</p>
          <Etiquetas rotulo="Tamanhos" valores={tamanhos} onChange={setTamanhos} sugestoes={TAMANHOS} placeholder="Digite e aperte Enter" />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-700">Cores</p>
          <Etiquetas rotulo="Cores" valores={cores} onChange={setCores} sugestoes={CORES} placeholder="Digite e aperte Enter" />
        </div>

        <Campo rotulo="Descrição" ajuda="Opcional. Tecido, medidas, cuidados…">
          <AreaTexto rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={2000} />
        </Campo>

        <div className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Visível na vitrine</p>
            <p className="text-xs text-stone-500">{ativo ? "Clientes podem ver este produto" : "Produto pausado, só você vê"}</p>
          </div>
          <Interruptor ligado={ativo} onChange={() => setAtivo(!ativo)} rotulo="Visível na vitrine" />
        </div>
      </Cartao>

      {extra}

      <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Botao type="submit" carregando={salvando} className="w-full sm:w-auto">
          {rotuloSalvar}
        </Botao>
      </div>
    </form>
  );
}

function PrecoInput({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">R$</span>
      <Entrada
        inputMode="decimal"
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))}
        onBlur={() => {
          const n = lerPreco(valor);
          if (n !== null && !Number.isNaN(n)) onChange(precoParaCampo(n));
        }}
        placeholder="0,00"
        className="pl-10"
      />
    </div>
  );
}
