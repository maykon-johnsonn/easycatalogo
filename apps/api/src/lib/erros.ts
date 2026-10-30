import type { PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';

/** Erro com status HTTP e mensagem pronta para mostrar ao usuário. */
export class HttpErro extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalhes?: unknown,
  ) {
    super(message);
  }
}

export const naoEncontrado = (o_que: string) => new HttpErro(404, `${o_que} não encontrado(a)`);

/** Valida com Zod e devolve 400 com os campos inválidos. */
export function validar<T extends z.ZodType>(schema: T, dados: unknown): z.output<T> {
  const r = schema.safeParse(dados);
  if (!r.success) {
    throw new HttpErro(400, 'Dados inválidos', z.flattenError(r.error).fieldErrors);
  }
  return r.data;
}

/** Converte erros do Postgres/PostgREST em respostas compreensíveis. */
export function erroDoBanco(erro: PostgrestError): HttpErro {
  switch (erro.code) {
    case '23505':
      return new HttpErro(409, 'Já existe um registro com esses dados', erro.details);
    case '23514':
      if (erro.message.includes('produtos_promocao_menor')) {
        return new HttpErro(400, 'Preço promocional deve ser menor que o preço original');
      }
      if (erro.message.includes('slug')) return new HttpErro(400, 'Endereço da loja inválido ou reservado');
      return new HttpErro(400, 'Dados fora das regras permitidas', erro.message);
    case '23503':
      return new HttpErro(400, 'Registro relacionado não existe', erro.details);
    default:
      return new HttpErro(500, 'Erro no banco de dados', erro.message);
  }
}
