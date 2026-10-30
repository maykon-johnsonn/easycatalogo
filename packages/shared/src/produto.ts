import { z } from 'zod';

/** Valores monetários em reais, com no máximo 2 casas decimais. */
const preco = z
  .number()
  .positive()
  .max(99_999_999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: 'Preço deve ter no máximo 2 casas decimais',
  });

const listaDeTexto = z.array(z.string().trim().min(1).max(40)).max(30);

export const produtoCriarSchema = z
  .object({
    nome: z.string().trim().min(1).max(120),
    descricao: z.string().trim().max(2000).nullish(),
    preco_original: preco,
    preco_promocional: preco.nullish(),
    categoria: z.string().trim().max(60).nullish(),
    tamanhos: listaDeTexto.default([]),
    cores: listaDeTexto.default([]),
    ativo: z.boolean().default(true),
  })
  .refine((p) => p.preco_promocional == null || p.preco_promocional < p.preco_original, {
    message: 'Preço promocional deve ser menor que o preço original',
    path: ['preco_promocional'],
  });

export const produtoEditarSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  descricao: z.string().trim().max(2000).nullish(),
  preco_original: preco.optional(),
  preco_promocional: preco.nullish(),
  categoria: z.string().trim().max(60).nullish(),
  tamanhos: listaDeTexto.optional(),
  cores: listaDeTexto.optional(),
  ativo: z.boolean().optional(),
});

export type ProdutoCriar = z.infer<typeof produtoCriarSchema>;
export type ProdutoEditar = z.infer<typeof produtoEditarSchema>;

export type Produto = {
  id: string;
  loja_id: string;
  numero: number;
  nome: string;
  descricao: string | null;
  preco_original: number;
  preco_promocional: number | null;
  categoria: string | null;
  tamanhos: string[];
  cores: string[];
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type ProdutoImagem = {
  id: string;
  produto_id: string;
  url: string;
  ordem: number;
};
