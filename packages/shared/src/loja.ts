import { z } from 'zod';

/** Slugs que colidem com rotas do app web. Manter igual à constraint `lojas_slug_reservado`. */
export const SLUGS_RESERVADOS = [
  'admin',
  'api',
  'p',
  'login',
  'auth',
  '_next',
  'painel',
  'plataforma',
  'entrar',
  'sair',
] as const;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use apenas letras minúsculas, números e hífens')
  .refine((s) => !(SLUGS_RESERVADOS as readonly string[]).includes(s), { message: 'Este endereço é reservado' });

/** Telefone em formato internacional apenas com dígitos (ex.: 5511999998888). */
export const telefoneSchema = z.string().regex(/^\d{10,15}$/, 'Informe DDI + DDD + número, só dígitos');

export const lojaEditarSchema = z.object({
  nome: z.string().trim().min(1).max(80).optional(),
  slug: slugSchema.optional(),
  telefone_pedidos: telefoneSchema.optional(),
});

export type LojaEditar = z.infer<typeof lojaEditarSchema>;

/** Criação de loja pela administração da plataforma, já convidando o dono por e-mail. */
export const lojaCriarSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  slug: slugSchema,
  telefone_pedidos: telefoneSchema,
  email_dono: z.email().trim().toLowerCase(),
});

export type LojaCriar = z.infer<typeof lojaCriarSchema>;

export type Loja = {
  id: string;
  nome: string;
  slug: string;
  telefone_pedidos: string;
  ativa: boolean;
  criado_em: string;
};
