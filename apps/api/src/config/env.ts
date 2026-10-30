import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUBLIC_WEB_URL: z.url(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((s) => s.trim())),

  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_PUBLIC_URL: z.url(),
});

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  console.error(z.prettifyError(resultado.error));
  process.exit(1);
}

export const env = resultado.data;
