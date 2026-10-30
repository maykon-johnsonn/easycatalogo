"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cx } from "./ui";

export const MAX_FOTOS = 8;
const MAX_BYTES = 10 * 1024 * 1024;

export type FotoItem = { id: string; url: string };

/** Valida os arquivos escolhidos antes de enviar. Retorna os válidos e uma mensagem sobre os recusados. */
export function filtrarArquivos(arquivos: File[], jaExistentes: number): { validos: File[]; aviso: string | null } {
  const imagens = arquivos.filter((f) => f.type.startsWith("image/"));
  const pequenas = imagens.filter((f) => f.size <= MAX_BYTES);
  const vagas = Math.max(0, MAX_FOTOS - jaExistentes);
  const validos = pequenas.slice(0, vagas);

  const avisos: string[] = [];
  if (imagens.length < arquivos.length) avisos.push("arquivos que não são imagem foram ignorados");
  if (pequenas.length < imagens.length) avisos.push("fotos acima de 10 MB foram ignoradas");
  if (pequenas.length > vagas) avisos.push(`o limite é de ${MAX_FOTOS} fotos por produto`);
  return { validos, aviso: avisos.length ? `Atenção: ${avisos.join("; ")}.` : null };
}

/** Grade de fotos com reordenação (setas), remoção e botão de adicionar. A primeira é a capa. */
export function GradeFotos({
  fotos,
  onAdicionar,
  onRemover,
  onMover,
  enviando,
  desabilitado,
}: {
  fotos: FotoItem[];
  onAdicionar: (arquivos: File[]) => void;
  onRemover: (id: string) => void;
  onMover: (de: number, para: number) => void;
  enviando?: boolean;
  desabilitado?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {fotos.map((f, i) => (
        <div key={f.id} className="group relative aspect-square overflow-hidden rounded-lg bg-stone-100 ring-1 ring-stone-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={`Foto ${i + 1}`} className="size-full object-cover" />
          {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-stone-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white">Capa</span>}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-1">
            <div className="flex">
              <BotaoIcone rotulo="Mover para a esquerda" disabled={desabilitado || i === 0} onClick={() => onMover(i, i - 1)}>
                <ChevronLeft className="size-4" aria-hidden />
              </BotaoIcone>
              <BotaoIcone rotulo="Mover para a direita" disabled={desabilitado || i === fotos.length - 1} onClick={() => onMover(i, i + 1)}>
                <ChevronRight className="size-4" aria-hidden />
              </BotaoIcone>
            </div>
            <BotaoIcone rotulo="Remover foto" disabled={desabilitado} onClick={() => onRemover(f.id)}>
              <Trash2 className="size-4" aria-hidden />
            </BotaoIcone>
          </div>
        </div>
      ))}

      {fotos.length < MAX_FOTOS && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={desabilitado || enviando}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-stone-300 text-stone-500 hover:border-marca-500 hover:text-marca-700 disabled:opacity-60"
        >
          {enviando ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
          <span className="text-xs font-medium">{enviando ? "Enviando…" : "Adicionar"}</span>
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const arquivos = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (arquivos.length) onAdicionar(arquivos);
        }}
      />
    </div>
  );
}

function BotaoIcone({ rotulo, children, ...props }: { rotulo: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={cx("rounded p-1 text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent")}
      {...props}
    >
      {children}
    </button>
  );
}
