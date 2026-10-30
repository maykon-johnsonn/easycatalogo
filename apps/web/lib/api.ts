import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export class ApiErro extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalhes?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

type Opcoes = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; form?: FormData };

/** Chama a API com o token da sessão atual. Lança ApiErro com a mensagem pronta para exibir. */
export async function api<T = unknown>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;

  let body: BodyInit | undefined;
  if (opcoes.form) body = opcoes.form;
  else if (opcoes.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opcoes.body);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${caminho}`, { method: opcoes.method ?? "GET", headers, body });
  } catch {
    throw new ApiErro(0, "Não foi possível conectar ao servidor. Verifique sua conexão.");
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiErro(res.status, json?.erro ?? "Algo deu errado", json?.detalhes);
  return json as T;
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Algo deu errado";
}
