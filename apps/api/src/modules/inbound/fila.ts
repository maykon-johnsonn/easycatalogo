import type { FastifyBaseLogger } from 'fastify';

/**
 * Fila em memória com ordem garantida por chave (remetente): foto, foto e depois áudio
 * são tratados na sequência em que chegaram; remetentes diferentes andam em paralelo.
 *
 * Basta enquanto a API roda em uma instância só. As mensagens já ficam gravadas em `mensagens`
 * antes de entrar aqui; ao escalar para várias instâncias, trocar por pg-boss mantendo esta interface.
 */
export function criarFila(log: FastifyBaseLogger) {
  const cadeias = new Map<string, Promise<void>>();

  function enfileirar(chave: string, tarefa: () => Promise<void>) {
    const anterior = cadeias.get(chave) ?? Promise.resolve();
    const atual = anterior.then(tarefa).catch((erro) => log.error({ err: erro, chave }, 'Falha numa tarefa do bot'));
    cadeias.set(chave, atual);
    void atual.finally(() => {
      if (cadeias.get(chave) === atual) cadeias.delete(chave);
    });
  }

  /** Espera esvaziar (tarefas podem enfileirar outras). */
  async function ociosa() {
    while (cadeias.size) await Promise.all(cadeias.values());
  }

  return { enfileirar, ociosa };
}

export type Fila = ReturnType<typeof criarFila>;
