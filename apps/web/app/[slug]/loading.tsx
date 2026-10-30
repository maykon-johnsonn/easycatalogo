export default function CarregandoVitrine() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando catálogo">
      <div className="h-14 border-b border-stone-200 bg-white" />
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="space-y-2 py-8">
          <div className="h-7 w-48 rounded bg-stone-200" />
          <div className="h-4 w-32 rounded bg-stone-200" />
        </div>
        <div className="h-10 rounded-lg bg-stone-200 sm:max-w-sm" />
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[4/5] rounded-xl bg-stone-200" />
              <div className="h-4 w-3/4 rounded bg-stone-200" />
              <div className="h-4 w-1/3 rounded bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
