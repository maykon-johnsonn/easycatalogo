import { z } from 'zod';

/** Variável opcional: vazia no .env conta como não definida. */
const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3333),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PUBLIC_WEB_URL: z.url(),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((v) => v.split(',').map((s) => s.trim())),

    SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(1),

    // `supabase`: Supabase Storage via secret key (dev). `s3`: MinIO ou outro S3-compatible (prod).
    STORAGE_DRIVER: z.enum(['supabase', 's3']).default('supabase'),
    STORAGE_BUCKET: z.string().min(1).default('catalogo-produtos'),

    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY: z.string().min(1).optional(),
    S3_SECRET_KEY: z.string().min(1).optional(),
    S3_PUBLIC_URL: z.url().optional(),

    // Bot (Fase 2). Sem token/chaves, o bot fica desligado e o resto da API funciona.
    TELEGRAM_BOT_TOKEN: opcional(z.string().regex(/^\d+:[\w-]+$/, 'Formato esperado: 123456:ABC...')),
    TELEGRAM_MODE: z.enum(['polling', 'webhook']).default('polling'),
    TELEGRAM_WEBHOOK_SECRET: opcional(z.string().regex(/^[\w-]{16,256}$/, 'Use 16+ letras, números, _ ou -')),
    PUBLIC_API_URL: opcional(z.url()),

    GOOGLE_GENERATIVE_AI_API_KEY: opcional(z.string()),
    GROQ_API_KEY: opcional(z.string()),
    AI_GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
    AI_GROQ_MODEL: z.string().min(1).default('openai/gpt-oss-120b'),
    AI_GROQ_TRANSCRIPTION_MODEL: z.string().min(1).default('whisper-large-v3-turbo'),
    AI_PRIMARY_PROVIDER: z.enum(['gemini', 'groq']).default('groq'),
    AI_ROUTING_MODE: z.enum(['fallback', 'round-robin']).default('fallback'),
    AI_DAILY_MESSAGE_LIMIT_PER_STORE: z.coerce.number().int().positive().default(300),
  })
  .superRefine((e, ctx) => {
    if (e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_MODE === 'webhook') {
      for (const chave of ['PUBLIC_API_URL', 'TELEGRAM_WEBHOOK_SECRET'] as const) {
        if (!e[chave]) ctx.addIssue({ code: 'custom', path: [chave], message: 'Obrigatória quando TELEGRAM_MODE=webhook' });
      }
    }
    if (e.STORAGE_DRIVER !== 's3') return;
    for (const chave of ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_PUBLIC_URL'] as const) {
      if (!e[chave]) ctx.addIssue({ code: 'custom', path: [chave], message: 'Obrigatória quando STORAGE_DRIVER=s3' });
    }
  });

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  console.error(z.prettifyError(resultado.error));
  process.exit(1);
}

export const env = resultado.data;
