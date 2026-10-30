"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { Produto } from "@/lib/tipos";
import { useLoja } from "@/components/loja-contexto";
import { FormProduto } from "@/components/form-produto";
import { filtrarArquivos, GradeFotos, type FotoItem } from "@/components/fotos";
import { Aviso, Cartao } from "@/components/ui";

type FotoLocal = FotoItem & { arquivo: File };

export default function PaginaNovoProduto() {
  const router = useRouter();
  const { loja } = useLoja();
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  // Libera as prévias da memória só ao sair da página (as removidas são liberadas em `remover`).
  const fotosRef = useRef(fotos);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  useEffect(() => () => fotosRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  function remover(id: string) {
    const foto = fotos.find((f) => f.id === id);
    if (foto) URL.revokeObjectURL(foto.url);
    setFotos((atuais) => atuais.filter((f) => f.id !== id));
  }

  function adicionar(arquivos: File[]) {
    const { validos, aviso } = filtrarArquivos(arquivos, fotos.length);
    setAviso(aviso);
    setFotos((atuais) => [...atuais, ...validos.map((arquivo) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(arquivo), arquivo }))]);
  }

  function mover(de: number, para: number) {
    setFotos((atuais) => {
      const nova = [...atuais];
      const [item] = nova.splice(de, 1);
      nova.splice(para, 0, item!);
      return nova;
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/painel/${loja.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="size-4" aria-hidden /> Produtos
      </Link>
      <h1 className="mb-5 text-xl font-semibold tracking-tight sm:text-2xl">Novo produto</h1>

      <FormProduto
        lojaId={loja.id}
        rotuloSalvar={fotos.length ? `Cadastrar com ${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}` : "Cadastrar produto"}
        onSalvar={async (dados) => {
          const produto = await api<Produto>(`/painel/lojas/${loja.id}/produtos`, { method: "POST", body: dados });
          if (fotos.length) {
            const form = new FormData();
            fotos.forEach((f) => form.append("fotos", f.arquivo, f.arquivo.name));
            try {
              await api(`/painel/lojas/${loja.id}/produtos/${produto.id}/imagens`, { method: "POST", form });
            } catch {
              // O produto já existe: leva à edição para tentar as fotos de novo, sem duplicar o cadastro.
              router.replace(`/painel/${loja.slug}/produtos/${produto.id}?erro-fotos=1`);
              return;
            }
          }
          router.push(`/painel/${loja.slug}`);
        }}
        extra={
          <Cartao className="p-4 sm:p-6">
            <p className="text-sm font-medium text-stone-700">Fotos</p>
            <p className="mb-3 text-xs text-stone-500">Até 8 fotos. A primeira é a capa. Elas são otimizadas automaticamente.</p>
            {aviso && <div className="mb-3"><Aviso tipo="info">{aviso}</Aviso></div>}
            <GradeFotos
              fotos={fotos}
              onAdicionar={adicionar}
              onRemover={remover}
              onMover={mover}
            />
          </Cartao>
        }
      />
    </div>
  );
}
