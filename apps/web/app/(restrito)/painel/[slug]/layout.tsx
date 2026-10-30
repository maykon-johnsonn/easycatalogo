import { Suspense } from "react";
import { PainelLoja } from "@/components/loja-contexto";
import { Carregando } from "@/components/ui";

export default function LayoutPainelLoja({ children }: LayoutProps<"/painel/[slug]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <PainelLoja>{children}</PainelLoja>
    </Suspense>
  );
}
