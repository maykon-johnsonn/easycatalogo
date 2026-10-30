// Atalhos sem IA (direcao.md, seção 4.1): comandos com padrão fixo e código do produto são
// executados direto pelas tools, sem gastar tokens. Só padrões estritos, a frase inteira:
// qualquer variação ("pausa a blusa azul", "tira a foto 2 da #3") segue para a IA.

export type Atalho = { tool: string; args: Record<string, unknown> };

const NUM = String.raw`(?:(?:a|o)\s+)?(?:produto\s+)?#?(\d+)`;
const VALOR = String.raw`(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)`;

const PADROES: [RegExp, (m: RegExpMatchArray) => Atalho][] = [
  [
    new RegExp(String.raw`^(?:pausa|pausar|pause|esgotou|acabou)\s+${NUM}$`),
    (m) => ({ tool: 'pausar_produto', args: { numero: Number(m[1]) } }),
  ],
  [
    new RegExp(String.raw`^(?:reativa|reativar|ativa|ativar|volta|voltar)\s+${NUM}(?:\s+(?:pra|para)\s+(?:a\s+)?vitrine)?$`),
    (m) => ({ tool: 'reativar_produto', args: { numero: Number(m[1]) } }),
  ],
  [
    new RegExp(String.raw`^(?:apaga|apagar|exclui|excluir|deleta|deletar)\s+${NUM}$`),
    (m) => ({ tool: 'excluir_produto', args: { numero: Number(m[1]) } }),
  ],
  [
    new RegExp(String.raw`^(?:muda|mudar|altera|alterar|troca|trocar)\s+(?:o\s+)?preco\s+d[ao]\s+${NUM}\s+(?:pra|para)\s+${VALOR}$`),
    (m) => ({ tool: 'editar_produto', args: { numero: Number(m[1]), preco: valor(m[2]!) } }),
  ],
  [
    new RegExp(String.raw`^(?:coloca|colocar|poe|bota)\s+${NUM}\s+em\s+promocao\s+(?:por|a)\s+${VALOR}$`),
    (m) => ({ tool: 'editar_produto', args: { numero: Number(m[1]), preco_promocional: valor(m[2]!) } }),
  ],
  [
    new RegExp(String.raw`^(?:tira|tirar|encerra|encerrar)\s+(?:a\s+)?promocao\s+d[ao]\s+${NUM}$`),
    (m) => ({ tool: 'editar_produto', args: { numero: Number(m[1]), remover_promocao: true } }),
  ],
];

const valor = (texto: string) => Number(texto.replace(',', '.'));

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.!]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

export function reconhecerAtalho(texto: string): Atalho | null {
  const frase = normalizar(texto);
  for (const [padrao, montar] of PADROES) {
    const m = frase.match(padrao);
    if (m) return montar(m);
  }
  return null;
}
