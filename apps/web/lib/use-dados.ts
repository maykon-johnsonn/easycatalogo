"use client";

import { useCallback, useEffect, useState } from "react";
import { mensagemDeErro } from "./api";

/**
 * Carrega dados da API em um efeito. Quando `buscar` muda (ex.: filtro novo), a resposta
 * anterior é descartada, então uma requisição lenta não sobrescreve uma mais recente.
 * Passe `null` para não carregar ainda.
 */
export function useDados<T>(buscar: (() => Promise<T>) | null) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string | null }>({ dados: null, erro: null });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!buscar) return;
    let atual = true;
    buscar().then(
      (dados) => atual && setEstado({ dados, erro: null }),
      (e) => atual && setEstado((s) => ({ dados: s.dados, erro: mensagemDeErro(e) })),
    );
    return () => {
      atual = false;
    };
  }, [buscar, versao]);

  /** Busca de novo com os mesmos parâmetros. */
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  /** Atualiza os dados localmente (ex.: resposta de um PATCH ou atualização otimista). */
  const definir = useCallback((f: (atual: T | null) => T | null) => setEstado((s) => ({ ...s, dados: f(s.dados) })), []);

  return { dados: estado.dados, erro: estado.erro, recarregar, definir };
}
