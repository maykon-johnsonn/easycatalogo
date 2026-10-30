const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatarPreco = (valor: number) => brl.format(valor);

/** Valor numérico para preencher um campo de preço ("59,90"). */
export const precoParaCampo = (valor: number | null | undefined) =>
  valor == null ? "" : valor.toFixed(2).replace(".", ",");

/** Aceita "59,90", "59.90", "R$ 1.299,90". Retorna null se vazio e NaN se inválido. */
export function lerPreco(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** 5511999998888 -> +55 (11) 99999-8888 */
export function formatarTelefone(digitos: string) {
  const m = digitos.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}` : digitos;
}

/** Sugestão de slug a partir do nome da loja. */
export function gerarSlug(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Link que abre a conversa no WhatsApp com a mensagem já escrita. */
export const linkWhatsApp = (telefone: string, texto: string) =>
  `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;
