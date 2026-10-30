import type { LojaCriar } from '@catalogo/shared';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { erroDoBanco, HttpErro, naoEncontrado } from '../../lib/erros.js';

async function contar(tabela: 'lojas' | 'produtos' | 'loja_membros', filtro?: (q: any) => any) {
  let q = supabaseAdmin.from(tabela).select('*', { count: 'exact', head: true });
  if (filtro) q = filtro(q);
  const { count, error } = await q;
  if (error) throw erroDoBanco(error);
  return count ?? 0;
}

/** Números gerais da plataforma para o painel do administrador. */
export async function resumoPlataforma() {
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [lojas, lojasAtivas, lojasNovas30d, produtos, produtosAtivos, produtosNovos30d, usuarios] =
    await Promise.all([
      contar('lojas'),
      contar('lojas', (q) => q.eq('ativa', true)),
      contar('lojas', (q) => q.gte('criado_em', trintaDiasAtras)),
      contar('produtos', (q) => q.is('excluido_em', null)),
      contar('produtos', (q) => q.is('excluido_em', null).eq('ativo', true)),
      contar('produtos', (q) => q.is('excluido_em', null).gte('criado_em', trintaDiasAtras)),
      contar('loja_membros'),
    ]);

  return {
    lojas: { total: lojas, ativas: lojasAtivas, novas_30d: lojasNovas30d },
    produtos: { total: produtos, ativos: produtosAtivos, novos_30d: produtosNovos30d },
    usuarios_painel: usuarios,
  };
}

/** Todas as lojas com contagem de produtos e data do último produto criado/alterado. */
export async function listarLojas() {
  const [lojas, produtos] = await Promise.all([
    supabaseAdmin
      .from('lojas')
      .select('id, nome, slug, telefone_pedidos, ativa, criado_em, membros:loja_membros (count)')
      .order('criado_em', { ascending: false }),
    supabaseAdmin.from('produtos').select('loja_id, ativo, atualizado_em').is('excluido_em', null),
  ]);
  if (lojas.error) throw erroDoBanco(lojas.error);
  if (produtos.error) throw erroDoBanco(produtos.error);

  // Agregação em memória: suficiente para o MVP. Trocar por uma view/RPC quando houver milhares de produtos.
  const porLoja = new Map<string, { total: number; ativos: number; ultima_atividade: string | null }>();
  for (const p of produtos.data) {
    const s = porLoja.get(p.loja_id) ?? { total: 0, ativos: 0, ultima_atividade: null };
    s.total += 1;
    if (p.ativo) s.ativos += 1;
    if (!s.ultima_atividade || p.atualizado_em > s.ultima_atividade) s.ultima_atividade = p.atualizado_em;
    porLoja.set(p.loja_id, s);
  }

  return lojas.data.map(({ membros, ...loja }) => ({
    ...loja,
    membros: membros[0]?.count ?? 0,
    produtos: porLoja.get(loja.id) ?? { total: 0, ativos: 0, ultima_atividade: null },
    url_vitrine: `${env.PUBLIC_WEB_URL}/${loja.slug}`,
  }));
}

/** Busca o usuário pelo e-mail; se não existir, envia convite (o link leva ao app web). */
export async function obterOuConvidarUsuario(email: string): Promise<{ id: string; convidado: boolean }> {
  const { data: existente, error } = await supabaseAdmin.rpc('usuario_id_por_email', { p_email: email });
  if (error) throw erroDoBanco(error);
  if (existente) return { id: existente, convidado: false };

  const convite = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${env.PUBLIC_WEB_URL}/entrar`,
  });
  if (convite.error) throw new HttpErro(502, `Não foi possível enviar o convite: ${convite.error.message}`);
  return { id: convite.data.user.id, convidado: true };
}

/** Cria a loja e vincula o dono (convidando por e-mail se ainda não tiver conta). */
export async function criarLoja(dados: LojaCriar) {
  const { data: slugEmUso, error: erroSlug } = await supabaseAdmin
    .from('lojas')
    .select('id')
    .eq('slug', dados.slug)
    .maybeSingle();
  if (erroSlug) throw erroDoBanco(erroSlug);
  if (slugEmUso) throw new HttpErro(409, 'Este endereço de loja já está em uso');

  const dono = await obterOuConvidarUsuario(dados.email_dono);

  const { data: loja, error } = await supabaseAdmin
    .from('lojas')
    .insert({ nome: dados.nome, slug: dados.slug, telefone_pedidos: dados.telefone_pedidos })
    .select('id, nome, slug, telefone_pedidos, ativa, criado_em')
    .single();
  if (error) throw erroDoBanco(error);

  const membro = await supabaseAdmin.from('loja_membros').insert({ loja_id: loja.id, user_id: dono.id, papel: 'dono' });
  if (membro.error) {
    await supabaseAdmin.from('lojas').delete().eq('id', loja.id);
    throw erroDoBanco(membro.error);
  }

  return { ...loja, dono_convidado: dono.convidado, url_vitrine: `${env.PUBLIC_WEB_URL}/${loja.slug}` };
}

export async function alterarStatusLoja(lojaId: string, ativa: boolean) {
  const { data, error } = await supabaseAdmin
    .from('lojas')
    .update({ ativa })
    .eq('id', lojaId)
    .select('id, ativa')
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw naoEncontrado('Loja');
  return data;
}
