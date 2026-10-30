// Formatos das respostas da API usados pelo painel.

export type LojaResumo = {
  id: string;
  nome: string;
  slug: string;
  telefone_pedidos: string;
  ativa: boolean;
  criado_em: string;
};

export type Me = {
  usuario: { id: string; email: string | null };
  lojas: (LojaResumo & { papel: "dono" | "operador" })[];
  admin_plataforma: boolean;
};

export type Imagem = { id: string; url: string; ordem: number };

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
  imagens: Imagem[];
};

export type ResumoPlataforma = {
  lojas: { total: number; ativas: number; novas_30d: number };
  produtos: { total: number; ativos: number; novos_30d: number };
  usuarios_painel: number;
};

export type LojaPlataforma = LojaResumo & {
  membros: number;
  produtos: { total: number; ativos: number; ultima_atividade: string | null };
  url_vitrine: string;
};

export type OperadorBot = { id: string; canal: "telegram" | "whatsapp"; nome: string | null; criado_em: string };

export type StatusBot = { telegram_ativo: boolean; ia_configurada: boolean; operadores: OperadorBot[] };

export type CodigoVinculo = { codigo: string; expira_em: string; link: string | null };
