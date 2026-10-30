import type { FastifyInstance } from 'fastify';

// Contrato entre os canais (Telegram, WhatsApp) e o resto do sistema. direcao.md, seção 6.
// Nada fora de `channels/` conhece detalhes de um canal específico.

export type Canal = 'telegram' | 'whatsapp';

export type InboundMessage = {
  canal: Canal;
  /** ID da mensagem no canal, usado para descartar reenvios. */
  idExterno: string;
  /** Telegram: user.id. WhatsApp: telefone. */
  remetente: string;
  nomeRemetente?: string | undefined;
  tipo: 'texto' | 'audio' | 'imagem' | 'outro';
  /** Texto da mensagem ou legenda da foto. */
  texto?: string | undefined;
  /** Fotos enviadas juntas (álbum). */
  grupoMidia?: string | undefined;
  baixarMidia?: (() => Promise<Midia>) | undefined;
  recebidoEm: Date;
};

export type Midia = { conteudo: Buffer; mimeType: string };

export type ReceberMensagens = (mensagens: InboundMessage[]) => Promise<void>;

export interface ChannelAdapter {
  readonly canal: Canal;
  /** Registra rotas (webhook) no Fastify. Chamado antes do servidor subir. */
  registrar(app: FastifyInstance, receber: ReceberMensagens): void;
  /** Começa a receber mensagens (polling ou configuração do webhook). */
  iniciar(receber: ReceberMensagens): Promise<void>;
  parar(): Promise<void>;
  enviarTexto(destinatario: string, texto: string): Promise<void>;
  /** Link para o lojista abrir a conversa já com o código de vínculo (quando o canal suportar). */
  linkDeVinculo(codigo: string): Promise<string | null>;
}
