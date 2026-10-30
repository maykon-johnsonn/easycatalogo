import { generateText, transcribe } from 'ai';
import { env } from '../../config/env.js';
import type { Midia } from '../channels/types.js';
import { groq, IaIndisponivel, modeloDoProvedor, type Provedor } from './providers.js';

export type Transcricao = { texto: string; provedor: Provedor; modelo: string };

/** Áudio → texto. Groq Whisper primeiro; se falhar, o Gemini (que também entende áudio). */
export async function transcrever(audio: Midia): Promise<Transcricao> {
  let ultimoErro: unknown = new IaIndisponivel('Nenhum provedor de transcrição configurado');

  if (groq) {
    try {
      const r = await transcribe({
        model: groq.transcription(env.AI_GROQ_TRANSCRIPTION_MODEL),
        audio: audio.conteudo,
        providerOptions: { groq: { language: 'pt' } },
        maxRetries: 1,
      });
      if (r.text.trim()) return { texto: r.text.trim(), provedor: 'groq', modelo: env.AI_GROQ_TRANSCRIPTION_MODEL };
    } catch (erro) {
      ultimoErro = erro;
    }
  }

  const gemini = modeloDoProvedor('gemini');
  if (gemini) {
    try {
      const r = await generateText({
        model: gemini.modelo,
        maxRetries: 1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcreva este áudio em português, exatamente como foi falado. Responda só com a transcrição.' },
              { type: 'file', mediaType: audio.mimeType, data: audio.conteudo },
            ],
          },
        ],
      });
      if (r.text.trim()) return { texto: r.text.trim(), provedor: 'gemini', modelo: gemini.nomeModelo };
    } catch (erro) {
      ultimoErro = erro;
    }
  }

  throw ultimoErro;
}
