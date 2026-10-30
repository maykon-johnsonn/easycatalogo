// Cliente mínimo da Bot API do Telegram (https://core.telegram.org/bots/api).
// Só o que o bot usa; sem dependência extra.

export type TgUser = { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string };
export type TgPhotoSize = { file_id: string; width: number; height: number; file_size?: number };
export type TgMessage = {
  message_id: number;
  date: number;
  chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  media_group_id?: string;
  voice?: { file_id: string; mime_type?: string; duration: number };
  audio?: { file_id: string; mime_type?: string; duration: number };
  document?: { file_id: string; mime_type?: string; file_name?: string };
};
export type TgUpdate = { update_id: number; message?: TgMessage };

export class ErroTelegram extends Error {
  constructor(
    readonly metodo: string,
    readonly codigo: number,
    descricao: string,
  ) {
    super(`Telegram ${metodo}: ${codigo} ${descricao}`);
  }
}

export function criarClienteTelegram(token: string) {
  const base = `https://api.telegram.org/bot${token}`;

  async function chamar<T>(metodo: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
    const resposta = await fetch(`${base}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      ...(signal ? { signal } : {}),
    });
    const corpo = (await resposta.json().catch(() => null)) as
      | { ok: true; result: T }
      | { ok: false; error_code: number; description: string }
      | null;
    if (!corpo) throw new ErroTelegram(metodo, resposta.status, 'resposta inválida');
    if (!corpo.ok) throw new ErroTelegram(metodo, corpo.error_code, corpo.description);
    return corpo.result;
  }

  return {
    chamar,
    getMe: () => chamar<TgUser>('getMe'),
    getUpdates: (offset: number, signal: AbortSignal) =>
      chamar<TgUpdate[]>('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, signal),
    setWebhook: (url: string, secretToken: string) =>
      chamar<boolean>('setWebhook', { url, secret_token: secretToken, allowed_updates: ['message'] }),
    deleteWebhook: () => chamar<boolean>('deleteWebhook', { drop_pending_updates: false }),
    sendMessage: (chatId: string, text: string) =>
      chamar('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
    /** Baixa um arquivo pelo file_id (limite da Bot API: 20 MB). */
    async baixarArquivo(fileId: string): Promise<Buffer> {
      const arquivo = await chamar<{ file_path?: string }>('getFile', { file_id: fileId });
      if (!arquivo.file_path) throw new ErroTelegram('getFile', 400, 'arquivo sem caminho');
      const resposta = await fetch(`https://api.telegram.org/file/bot${token}/${arquivo.file_path}`);
      if (!resposta.ok) throw new ErroTelegram('download', resposta.status, resposta.statusText);
      return Buffer.from(await resposta.arrayBuffer());
    },
  };
}

export type ClienteTelegram = ReturnType<typeof criarClienteTelegram>;
