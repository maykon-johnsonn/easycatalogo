import type { LojaEditar } from '@catalogo/shared';
import { supabaseAdmin } from '../../config/supabase.js';
import { erroDoBanco, naoEncontrado } from '../../lib/erros.js';

const CAMPOS_LOJA = 'id, nome, slug, telefone_pedidos, ativa, criado_em';

/** Lojas em que o usuário é membro, com o papel dele em cada uma. */
export async function lojasDoUsuario(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('loja_membros')
    .select(`papel, loja:lojas (${CAMPOS_LOJA})`)
    .eq('user_id', userId)
    .order('criado_em');
  if (error) throw erroDoBanco(error);
  return data.map(({ papel, loja }) => ({ ...loja, papel }));
}

export async function obterLoja(lojaId: string) {
  const { data, error } = await supabaseAdmin.from('lojas').select(CAMPOS_LOJA).eq('id', lojaId).maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw naoEncontrado('Loja');
  return data;
}

export async function editarLoja(lojaId: string, dados: LojaEditar) {
  const { data, error } = await supabaseAdmin
    .from('lojas')
    .update(dados)
    .eq('id', lojaId)
    .select(CAMPOS_LOJA)
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw naoEncontrado('Loja');
  return data;
}
