import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

/** Cliente S3-compatible (MinIO na VPS; serve também para Supabase Storage ou R2). */
export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});
