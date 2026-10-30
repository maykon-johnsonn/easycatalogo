"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cx } from "@/components/ui";

/** Fotos do produto: deslizar no celular, setas e miniaturas no computador. */
export function Galeria({ imagens, nome }: { imagens: { id: string; url: string }[]; nome: string }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);

  if (imagens.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-stone-100 text-stone-300">
        <ImageOff className="size-10" aria-hidden />
      </div>
    );
  }

  function irPara(indice: number) {
    const el = trilho.current;
    if (!el) return;
    const destino = Math.max(0, Math.min(imagens.length - 1, indice));
    el.scrollTo({ left: destino * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={trilho}
          onScroll={(e) => setAtual(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto rounded-2xl bg-stone-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {imagens.map((img, i) => (
            <div key={img.id} className="relative size-full shrink-0 snap-center">
              <Image
                src={img.url}
                alt={`${nome}, foto ${i + 1} de ${imagens.length}`}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                priority={i === 0}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {imagens.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => irPara(atual - 1)}
              disabled={atual === 0}
              className="absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow ring-1 ring-stone-200 hover:bg-white disabled:opacity-0 md:flex"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => irPara(atual + 1)}
              disabled={atual === imagens.length - 1}
              className="absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow ring-1 ring-stone-200 hover:bg-white disabled:opacity-0 md:flex"
              aria-label="Próxima foto"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
              {imagens.map((img, i) => (
                <span key={img.id} className={cx("size-1.5 rounded-full", i === atual ? "bg-white" : "bg-white/50")} />
              ))}
            </div>
          </>
        )}
      </div>

      {imagens.length > 1 && (
        <div className="hidden gap-2 md:flex">
          {imagens.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => irPara(i)}
              className={cx(
                "relative aspect-square w-16 overflow-hidden rounded-lg bg-stone-100 ring-2",
                i === atual ? "ring-marca-600" : "ring-transparent hover:ring-stone-300",
              )}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === atual}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
