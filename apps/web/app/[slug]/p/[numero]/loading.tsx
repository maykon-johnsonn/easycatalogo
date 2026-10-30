export default function CarregandoProduto() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando produto">
      <div className="h-14 border-b border-stone-200 bg-white" />
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-4 md:grid-cols-2 md:gap-10 md:pt-8">
        <div className="aspect-[4/5] rounded-2xl bg-stone-200" />
        <div className="space-y-3">
          <div className="h-3 w-20 rounded bg-stone-200" />
          <div className="h-7 w-3/4 rounded bg-stone-200" />
          <div className="h-8 w-32 rounded bg-stone-200" />
          <div className="mt-6 h-12 rounded-xl bg-stone-200" />
        </div>
      </div>
    </div>
  );
}
