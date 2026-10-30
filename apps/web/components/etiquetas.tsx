"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cx, estiloInput } from "./ui";

/** Campo de lista (tamanhos, cores): Enter ou vírgula adiciona; atalhos de um clique para valores comuns. */
export function Etiquetas({
  valores,
  onChange,
  placeholder,
  sugestoes = [],
  rotulo,
}: {
  valores: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  sugestoes?: string[];
  rotulo: string;
}) {
  const [texto, setTexto] = useState("");

  const adicionar = (bruto: string) => {
    const novos = bruto
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !valores.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (novos.length) onChange([...valores, ...novos]);
    setTexto("");
  };

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      adicionar(texto);
    } else if (e.key === "Backspace" && !texto && valores.length) {
      onChange(valores.slice(0, -1));
    }
  };

  const disponiveis = sugestoes.filter((s) => !valores.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <div className={cx(estiloInput, "flex h-auto min-h-10 flex-wrap items-center gap-1.5 py-1.5")}>
        {valores.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-stone-100 py-0.5 pl-2 pr-1 text-sm">
            {v}
            <button type="button" onClick={() => onChange(valores.filter((x) => x !== v))} aria-label={`Remover ${v}`} className="rounded p-0.5 text-stone-500 hover:bg-stone-200">
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={aoTeclar}
          onBlur={() => texto && adicionar(texto)}
          placeholder={valores.length ? "" : placeholder}
          aria-label={rotulo}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
        />
      </div>
      {disponiveis.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {disponiveis.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange([...valores, s])}
              className="rounded-md px-2 py-0.5 text-xs text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
