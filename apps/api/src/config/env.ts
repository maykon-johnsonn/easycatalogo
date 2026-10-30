import { z } from 'zod';

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
  })
  .superRefine((e, ctx) => {
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
