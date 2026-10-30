"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { api, mensagemDeErro } from "@/lib/api";
import { formatarData } from "@/lib/formato";
import type { Produto } from "@/lib/tipos";
import { useDados } from "@/lib/use-dados";
import { useLoja } from "@/components/loja-contexto";
import { FormProduto } from "@/components/form-produto";
import { filtrarArquivos, GradeFotos } from "@/components/fotos";
import { Aviso, Botao, Cartao, Carregando } from "@/components/ui";

export default function PaginaEditarProduto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { loja } = useLoja();
  const base = `/painel/lojas/${loja.id}`;

  const buscar = useCallback(() => api<Produto>(`${base}/produtos/${id}`), [base, id]);
  const { dados: produto, erro: erroCarga, definir } = useDados(buscar);
  const setProduto = (p: Produto) => definir(() => p);
  const [erroAcao, setErro] = useState<string | null>(null);
  const erro = erroAcao ?? erroCarga;
  // Veio do cadastro com falha no envio das fotos
  const [avisoFotos, setAvisoFotos] = useState<string | null>(() =>
    new URLSearchParams(location.search).has("erro-fotos")
      ? "O produto foi cadastrado, mas as fotos não foram enviadas. Tente adicioná-las novamente."
      : null,
  );
  const [salvo, setSalvo] = useState(false);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function adicionarFotos(arquivos: File[]) {
    if (!produto) return;
    const { validos, aviso } = filtrarArquivos(arquivos, produto.imagens.length);
    setAvisoFotos(aviso);
    if (!validos.length) return;
    const form = new FormData();
    validos.forEach((f) => form.append("fotos", f, f.name));
    setEnviandoFotos(true);
    try {
      setProduto(await api<Produto>(`${base}/produtos/${id}/imagens`, { method: "POST", form }));
    } catch (e) {
      setAvisoFotos(mensagemDeErro(e));
    } finally {
      setEnviandoFotos(false);
    }
  }

  async function removerFoto(imagemId: string) {
    if (!produto || !confirm("Remover esta foto?")) return;
    setOcupado(true);
    try {
      await api(`${base}/imagens/${imagemId}`, { method: "DELETE" });
      setProduto({ ...produto, imagens: produto.imagens.filter((i) => i.id !== imagemId) });
    } catch (e) {
      setAvisoFotos(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function moverFoto(de: number, para: number) {
    if (!produto) return;
    const ids = produto.imagens.map((i) => i.id);
    const [movido] = ids.splice(de, 1);
    ids.splice(para, 0, movido!);
    setOcupado(true);
    try {
      setProduto(await api<Produto>(`${base}/produtos/${id}/imagens/ordem`, { method: "PUT", body: { ids } }));
    } catch (e) {
      setAvisoFotos(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function excluir() {
    if (!produto || !confirm(`Excluir "${produto.nome}"? Ele sai do painel e da vitrine.`)) return;
    setExcluindo(true);
    try {
      await api(`${base}/produtos/${id}`, { method: "DELETE" });
      router.replace(`/painel/${loja.slug}`);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setExcluindo(false);
    }
  }

  const voltar = (
    <Link href={`/painel/${loja.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
      <ArrowLeft className="size-4" aria-hidden /> Produtos
    </Link>
  );

  if (erro && !produto) return <div className="mx-auto max-w-2xl">{voltar}<Aviso>{erro}</Aviso></div>;
  if (!produto) return <Carregando />;

  return (
    <div className="mx-auto max-w-2xl">
      {voltar}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-stone-500">#{produto.numero}</p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{produto.nome}</h1>
          <p className="text-xs text-stone-500">Atualizado em {formatarData(produto.atualizado_em)}</p>
        </div>
        <Botao variante="perigo" onClick={excluir} carregando={excluindo}>
          <Trash2 className="size-4" aria-hidden /> <span className="hidden sm:inline">Excluir</span>
        </Botao>
      </div>

      <div className="space-y-5">
        {erro && <Aviso>{erro}</Aviso>}

        <Cartao className="p-4 sm:p-6">
          <p className="text-sm font-medium text-stone-700">Fotos</p>
          <p className="mb-3 text-xs text-stone-500">As alterações nas fotos são salvas na hora. A primeira é a capa.</p>
          {avisoFotos && <div className="mb-3"><Aviso tipo="info">{avisoFotos}</Aviso></div>}
          <GradeFotos
            fotos={produto.imagens}
            onAdicionar={adicionarFotos}
            onRemover={removerFoto}
            onMover={moverFoto}
            enviando={enviandoFotos}
            desabilitado={ocupado}
          />
        </Cartao>

        {salvo && <Aviso tipo="sucesso">Alterações salvas.</Aviso>}

        <FormProduto
          key={produto.atualizado_em}
          lojaId={loja.id}
          produto={produto}
          rotuloSalvar="Salvar alterações"
          onSalvar={async (dados) => {
            setSalvo(false);
            setProduto(await api<Produto>(`${base}/produtos/${id}`, { method: "PATCH", body: dados }));
            setSalvo(true);
          }}
        />
      </div>
    </div>
  );
}
