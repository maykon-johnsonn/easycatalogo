import { Suspense, type ReactNode } from "react";
import { SessaoProvider } from "@/components/sessao";
import { Carregando } from "@/components/ui";

// Áreas restritas (painel do lojista, administração e conta) dependem da sessão do navegador,
// então são renderizadas no cliente dentro do Suspense (exigência do cacheComponents).
export default function LayoutRestrito({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Carregando />}>
      <SessaoProvider>{children}</SessaoProvider>
    </Suspense>
  );
}
