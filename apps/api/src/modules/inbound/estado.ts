import { randomInt } from 'node:crypto';
import { supabaseAdmin } from '../../config/supabase.js';
import { erroDoBanco, HttpErro } from '../../lib/erros.js';
import type { ImagemSalva } from '../storage/imagens.js';
import { excluirImagens } from '../storage/imagens.js';
import type { Canal } from '../channels/types.js';

// Estado do bot no banco: quem opera cada loja, códigos de vínculo, fotos pendentes e contexto curto.

export const JANELA_MIDIAS_MS = 3 * 60 * 1000;
const VALIDADE_VINCULO_MS = 30 * 60 * 1000;
const RETENCAO_MIDIAS_MS = 24 * 60 * 60 * 1000;
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, fáceis de confundir

export type Operador = {
  id: string;
  loja_id: string;
  nome: string | null;
  loja: { id: string; nome: string; slug: string; ativa: boolean };
};

export async function buscarOperador(canal: Canal, remetente: string): Promise<Operador | null> {
  const { data, error } = await supabaseAdmin
    .from('canal_operadores')
    .select('id, loja_id, nome, loja:lojas (id, nome, slug, ativa)')
    .eq('canal', canal)
    .eq('identificador_externo', remetente)
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  return data;
}

export async function listarOperadores(lojaId: string) {
  const { data, error } = await supabaseAdmin
    .from('canal_operadores')
    .select('id, canal, nome, criado_em')
    .eq('loja_id', lojaId)
    .order('criado_em');
  if (error) throw erroDoBanco(error);
  return data;
}

export async function removerOperador(lojaId: string, operadorId: string) {
  const { data, error } = await supabaseAdmin
    .from('canal_operadores')
    .delete()
    .eq('loja_id', lojaId)
    .eq('id', operadorId)
    .select('id')
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw new HttpErro(404, 'Operador não encontrado');
}

/** Código de uso único para o lojista vincular a conta do canal à loja. */
export async function criarCodigoVinculo(lojaId: string, canal: Canal, criadoPor: string) {
  const codigo = Array.from({ length: 8 }, () => ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]).join('');
  const expiraEm = new Date(Date.now() + VALIDADE_VINCULO_MS).toISOString();
  const { error } = await supabaseAdmin
    .from('vinculos_canal')
    .insert({ codigo, loja_id: lojaId, canal, criado_por: criadoPor, expira_em: expiraEm });
  if (error) throw erroDoBanco(error);
  return { codigo, expira_em: expiraEm };
}

export const pareceCodigoVinculo = (texto: string) => /^[A-Z0-9]{8}$/.test(texto.trim().toUpperCase());

export type ResultadoVinculo =
  | { ok: true; lojaNome: string; jaVinculado: boolean }
  | { ok: false; motivo: 'invalido' | 'outra_loja' };

/** Usa o código: vincula a conta à loja. O código só vale uma vez e por 30 minutos. */
export async function usarCodigoVinculo(
  canal: Canal,
  remetente: string,
  nome: string | undefined,
  codigoDigitado: string,
): Promise<ResultadoVinculo> {
  const codigo = codigoDigitado.trim().toUpperCase();
  // Marca como usado numa única operação, para o mesmo código não servir duas vezes.
  const { data: vinculo, error } = await supabaseAdmin
    .from('vinculos_canal')
    .update({ usado_em: new Date().toISOString() })
    .eq('codigo', codigo)
    .eq('canal', canal)
    .is('usado_em', null)
    .gt('expira_em', new Date().toISOString())
    .select('loja_id, loja:lojas (nome)')
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!vinculo) return { ok: false, motivo: 'invalido' };

  const existente = await buscarOperador(canal, remetente);
  if (existente) {
    if (existente.loja_id === vinculo.loja_id) return { ok: true, lojaNome: vinculo.loja.nome, jaVinculado: true };
    return { ok: false, motivo: 'outra_loja' };
  }

  const { error: erroInsert } = await supabaseAdmin
    .from('canal_operadores')
    .insert({ loja_id: vinculo.loja_id, canal, identificador_externo: remetente, nome: nome?.slice(0, 120) ?? null });
  if (erroInsert) throw erroDoBanco(erroInsert);
  return { ok: true, lojaNome: vinculo.loja.nome, jaVinculado: false };
}

// ---- Contexto curto ----

export async function ultimoProdutoId(operadorId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('conversas')
    .select('ultimo_produto_id')
    .eq('canal_operador_id', operadorId)
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  return data?.ultimo_produto_id ?? null;
}

export async function definirUltimoProduto(operadorId: string, produtoId: string) {
  const { error } = await supabaseAdmin
    .from('conversas')
    .upsert({ canal_operador_id: operadorId, ultimo_produto_id: produtoId });
  if (error) throw erroDoBanco(error);
}

// ---- Fotos pendentes ----

export async function registrarMidiaPendente(operador: Operador, imagem: ImagemSalva, grupo?: string) {
  const { error } = await supabaseAdmin.from('midias_pendentes').insert({
    loja_id: operador.loja_id,
    canal_operador_id: operador.id,
    chave_storage: imagem.chave,
    url: imagem.url,
    grupo_externo: grupo ?? null,
  });
  if (error) throw erroDoBanco(error);
}

export async function contarMidiasPendentes(operadorId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('midias_pendentes')
    .select('id', { count: 'exact', head: true })
    .eq('canal_operador_id', operadorId)
    .is('consumida_em', null)
    .gte('recebido_em', new Date(Date.now() - JANELA_MIDIAS_MS).toISOString());
  if (error) throw erroDoBanco(error);
  return count ?? 0;
}

/** Pega as fotos recentes ainda não usadas e marca como usadas. */
export async function consumirMidiasPendentes(operadorId: string, limite: number) {
  const { data, error } = await supabaseAdmin
    .from('midias_pendentes')
    .select('id, chave_storage, url')
    .eq('canal_operador_id', operadorId)
    .is('consumida_em', null)
    .gte('recebido_em', new Date(Date.now() - JANELA_MIDIAS_MS).toISOString())
    .order('recebido_em')
    .limit(limite);
  if (error) throw erroDoBanco(error);
  if (!data.length) return { imagens: [] as ImagemSalva[], ids: [] as string[] };

  const ids = data.map((m) => m.id);
  const { error: erroUpdate } = await supabaseAdmin
    .from('midias_pendentes')
    .update({ consumida_em: new Date().toISOString() })
    .in('id', ids);
  if (erroUpdate) throw erroDoBanco(erroUpdate);
  return { imagens: data.map((m) => ({ chave: m.chave_storage, url: m.url })), ids };
}

/** Desfaz o consumo quando anexar ao produto falhou. */
export async function devolverMidias(ids: string[]) {
  if (!ids.length) return;
  await supabaseAdmin.from('midias_pendentes').update({ consumida_em: null }).in('id', ids);
}

/** Limpeza periódica: fotos nunca usadas (arquivo + registro) e códigos de vínculo vencidos. */
export async function limparEstadoAntigo() {
  const corte = new Date(Date.now() - RETENCAO_MIDIAS_MS).toISOString();

  const { data: abandonadas, error } = await supabaseAdmin
    .from('midias_pendentes')
    .select('id, chave_storage')
    .is('consumida_em', null)
    .lt('recebido_em', corte)
    .limit(500);
  if (error) throw erroDoBanco(error);
  if (abandonadas.length) {
    await excluirImagens(abandonadas.map((m) => m.chave_storage));
    await supabaseAdmin.from('midias_pendentes').delete().in('id', abandonadas.map((m) => m.id));
  }
  // As já usadas pertencem a um produto: só o registro sai, o arquivo fica.
  await supabaseAdmin.from('midias_pendentes').delete().not('consumida_em', 'is', null).lt('recebido_em', corte);
  await supabaseAdmin.from('vinculos_canal').delete().lt('expira_em', corte);

  return { fotosRemovidas: abandonadas.length };
}
