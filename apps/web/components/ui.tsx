import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const variantes: Record<Variante, string> = {
  primario: "bg-marca-600 text-white hover:bg-marca-700 disabled:bg-marca-200",
  secundario: "bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:text-stone-400",
  perigo: "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:text-red-300",
  fantasma: "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
};

const baseBotao =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 h-10 text-sm font-medium transition-colors disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-500";

export function Botao({
  variante = "primario",
  carregando,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      type="button"
      className={cx(baseBotao, variantes[variante], className)}
      disabled={disabled || carregando}
      {...props}
    >
      {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function BotaoLink({
  variante = "primario",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={cx(baseBotao, variantes[variante], className)} {...props} />;
}

export function Campo({
  rotulo,
  erro,
  ajuda,
  children,
  className,
}: {
  rotulo: string;
  erro?: string | undefined;
  ajuda?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{rotulo}</span>
      {children}
      {erro ? (
        <span className="mt-1 block text-sm text-red-600">{erro}</span>
      ) : ajuda ? (
        <span className="mt-1 block text-xs text-stone-500">{ajuda}</span>
      ) : null}
    </label>
  );
}

export const estiloInput =
  "block w-full rounded-lg border-0 bg-white px-3 h-10 text-stone-900 ring-1 ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-marca-500 focus:outline-none disabled:bg-stone-100";

export function Entrada({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(estiloInput, className)} {...props} />;
}

export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(estiloInput, "h-auto py-2", className)} {...props} />;
}

export function Cartao({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-xl bg-white ring-1 ring-stone-200", className)} {...props} />;
}

export function Selo({ cor = "cinza", children }: { cor?: "cinza" | "verde" | "ambar" | "marca"; children: ReactNode }) {
  const cores = {
    cinza: "bg-stone-100 text-stone-700",
    verde: "bg-emerald-50 text-emerald-700",
    ambar: "bg-amber-50 text-amber-800",
    marca: "bg-marca-50 text-marca-700",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cores[cor])}>{children}</span>;
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "sucesso" | "info"; children: ReactNode }) {
  const estilos = {
    erro: "bg-red-50 text-red-800 ring-red-200",
    sucesso: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
  };
  return (
    <div className={cx("rounded-lg px-4 py-3 text-sm ring-1", estilos[tipo])} role={tipo === "erro" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Vazio({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      <p className="font-medium text-stone-800">{titulo}</p>
      {descricao && <p className="mt-1 text-sm text-stone-500">{descricao}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function Interruptor({ ligado, onChange, rotulo }: { ligado: boolean; onChange: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      title={rotulo}
      onClick={onChange}
      className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors", ligado ? "bg-emerald-500" : "bg-stone-300")}
    >
      <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", ligado ? "left-[1.125rem]" : "left-0.5")} />
    </button>
  );
}

export { cx };
