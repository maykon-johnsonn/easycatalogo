import type { FastifyRequest } from 'fastify';
import { supabaseAdmin } from '../../config/supabase.js';
import { HttpErro } from '../../lib/erros.js';

export type Usuario = { id: string; email: string | null };

declare module 'fastify' {
  interface FastifyRequest {
    usuario: Usuario | null;
  }
}

/** preHandler: exige um JWT válido do Supabase Auth no header Authorization. */
export async function exigirUsuario(request: FastifyRequest) {
  const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpErro(401, 'Faça login para continuar');

  const { data, error } = await supabaseAdmin.auth.getClaims(token);
  if (error || !data) throw new HttpErro(401, 'Sessão inválida ou expirada');

  request.usuario = { id: data.claims.sub, email: data.claims.email ?? null };
}

function usuarioDa(request: FastifyRequest): Usuario {
  if (!request.usuario) throw new HttpErro(401, 'Faça login para continuar');
  return request.usuario;
}

export async function ehAdminPlataforma(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('plataforma_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new HttpErro(500, 'Erro ao verificar permissões', error.message);
  return data !== null;
}

/** preHandler (após exigirUsuario): só administradores da plataforma. */
export async function exigirAdminPlataforma(request: FastifyRequest) {
  if (!(await ehAdminPlataforma(usuarioDa(request).id))) {
    throw new HttpErro(403, 'Acesso restrito à administração da plataforma');
  }
}

/**
 * preHandler (após exigirUsuario) para rotas `/painel/lojas/:lojaId/...`:
 * libera membros da loja e administradores da plataforma (suporte).
 */
export async function exigirAcessoLoja(request: FastifyRequest) {
  const usuario = usuarioDa(request);
  const { lojaId } = request.params as { lojaId?: string };
  if (!lojaId || !/^[0-9a-f-]{36}$/i.test(lojaId)) throw new HttpErro(404, 'Loja não encontrada');

  const { data, error } = await supabaseAdmin
    .from('loja_membros')
    .select('papel')
    .eq('loja_id', lojaId)
    .eq('user_id', usuario.id)
    .maybeSingle();
  if (error) throw new HttpErro(500, 'Erro ao verificar permissões', error.message);
  if (data) return;

  // Mesma resposta para "não existe" e "sem acesso", para não revelar quais lojas existem.
  if (!(await ehAdminPlataforma(usuario.id))) throw new HttpErro(404, 'Loja não encontrada');
}
