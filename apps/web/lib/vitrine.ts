import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { slugSchema, type Database, type Json } from "@catalogo/shared";

// Leitura pública da vitrine no servidor. Usa a chave publicável (papel anon):
// o RLS só deixa passar loja ativa e produto ativo e não excluído.
const supabasePublico = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export type ProdutoVitrine = {
  id: string;
  numero: number;
  nome: string;
  descricao: string | null;
  preco_original: number;
  preco_promocional: number | null;
  categoria: string | null;
  tamanhos: string[];
  cores: string[];
  imagens: { id: string; url: string }[];
};

export type Vitrine = {
  loja: { id: string; nome: string; slug: string; telefone_pedidos: string };
  produtos: ProdutoVitrine[];
  categorias: string[];
};

// tamanhos e cores são jsonb no banco; a API só grava listas de textos.
const listaDeTextos = (valor: Json) =>
  Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];

/**
 * Loja e produtos visíveis, numa só leitura usada pela página e pelos metadados.
 * Cache curto: o que o lojista altera no painel aparece na vitrine em poucos segundos.
 */
export async function obterVitrine(slug: string): Promise<Vitrine | null> {
  "use cache";
  cacheLife("seconds");
  cacheTag(`vitrine:${slug}`);

  const slugValido = slugSchema.safeParse(slug);
  if (!slugValido.success || slugValido.data !== slug) return null;

  const { data: loja, error: erroLoja } = await supabasePublico
    .from("lojas")
    .select("id, nome, slug, telefone_pedidos")
    .eq("slug", slug)
    .maybeSingle();
  if (erroLoja) throw new Error(`Falha ao carregar a loja: ${erroLoja.message}`);
  if (!loja) return null;

  const { data, error } = await supabasePublico
    .from("produtos")
    .select(
      "id, numero, nome, descricao, preco_original, preco_promocional, categoria, tamanhos, cores, imagens:produto_imagens (id, url, ordem)",
    )
    .eq("loja_id", loja.id)
    .order("criado_em", { ascending: false })
    .order("ordem", { referencedTable: "produto_imagens" });
  if (error) throw new Error(`Falha ao carregar os produtos: ${error.message}`);

  const produtos = data.map(({ imagens, tamanhos, cores, ...p }) => ({
    ...p,
    tamanhos: listaDeTextos(tamanhos),
    cores: listaDeTextos(cores),
    imagens: imagens.map(({ id, url }) => ({ id, url })),
  }));
  const categorias = [...new Set(produtos.map((p) => p.categoria).filter((c): c is string => !!c))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  return { loja, produtos, categorias };
}

export const precoAtual = (p: Pick<ProdutoVitrine, "preco_original" | "preco_promocional">) =>
  p.preco_promocional ?? p.preco_original;

export const descontoPercentual = (p: Pick<ProdutoVitrine, "preco_original" | "preco_promocional">) =>
  p.preco_promocional == null ? null : Math.round((1 - p.preco_promocional / p.preco_original) * 100);

export const urlDoSite = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
