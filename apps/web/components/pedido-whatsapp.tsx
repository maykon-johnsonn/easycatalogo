"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { formatarPreco, linkWhatsApp } from "@/lib/formato";
import { cx } from "@/components/ui";

type Produto = {
  numero: number;
  nome: string;
  preco: number;
  tamanhos: string[];
  cores: string[];
};

/** Escolha de tamanho/cor e botão que abre a conversa com a loja já com o pedido escrito. */
export function PedidoWhatsApp({ telefone, produto, url }: { telefone: string; produto: Produto; url: string }) {
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [cor, setCor] = useState<string | null>(null);

  const texto = [
    "Olá! Tenho interesse neste produto:",
    `*${produto.nome}* (#${produto.numero})`,
    tamanho && `Tamanho: ${tamanho}`,
    cor && `Cor: ${cor}`,
    `Preço: ${formatarPreco(produto.preco)}`,
    url,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-5">
      {produto.tamanhos.length > 0 && (
        <Opcoes titulo="Tamanho" opcoes={produto.tamanhos} escolhida={tamanho} onEscolher={setTamanho} />
      )}
      {produto.cores.length > 0 && <Opcoes titulo="Cor" opcoes={produto.cores} escolhida={cor} onEscolher={setCor} />}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <a
          href={linkWhatsApp(telefone, texto)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f9d55] font-semibold text-white hover:bg-[#188a4a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f9d55]"
        >
          <MessageCircle className="size-5" aria-hidden />
          Pedir no WhatsApp
        </a>
      </div>
    </div>
  );
}

function Opcoes({
  titulo,
  opcoes,
  escolhida,
  onEscolher,
}: {
  titulo: string;
  opcoes: string[];
  escolhida: string | null;
  onEscolher: (valor: string | null) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-stone-700">
        {titulo}
        {escolhida && <span className="font-normal text-stone-500">: {escolhida}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => onEscolher(escolhida === opcao ? null : opcao)}
            aria-pressed={escolhida === opcao}
            className={cx(
              "h-10 min-w-10 rounded-lg px-3 text-sm ring-1 transition-colors",
              escolhida === opcao
                ? "bg-stone-900 text-white ring-stone-900"
                : "bg-white text-stone-700 ring-stone-300 hover:ring-stone-500",
            )}
          >
            {opcao}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
