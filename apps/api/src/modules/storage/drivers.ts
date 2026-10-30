import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../config/supabase.js';

/** Armazenamento de arquivos. Trocar de Supabase Storage para MinIO é só mudar STORAGE_DRIVER. */
export interface StorageDriver {
  enviar(chave: string, conteudo: Buffer, contentType: string): Promise<void>;
  excluir(chaves: string[]): Promise<void>;
  urlPublica(chave: string): string;
}

function driverSupabase(): StorageDriver {
  const bucket = supabaseAdmin.storage.from(env.STORAGE_BUCKET);
  const base = `${env.SUPABASE_URL}/storage/v1/object/public/${env.STORAGE_BUCKET}`;

  return {
    async enviar(chave, conteudo, contentType) {
      const { error } = await bucket.upload(chave, conteudo, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw new Error(`Falha no upload (${chave}): ${error.message}`);
    },
    async excluir(chaves) {
      if (chaves.length === 0) return;
      const { error } = await bucket.remove(chaves);
      if (error) throw new Error(`Falha ao excluir arquivos: ${error.message}`);
    },
    urlPublica: (chave) => `${base}/${chave}`,
  };
}

function driverS3(): StorageDriver {
  // Presença garantida pelo superRefine de env.ts quando STORAGE_DRIVER=s3.
  const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT!,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY!, secretAccessKey: env.S3_SECRET_KEY! },
  });

  return {
    async enviar(chave, conteudo, contentType) {
      await s3.send(
        new PutObjectCommand({
          Bucket: env.STORAGE_BUCKET,
          Key: chave,
          Body: conteudo,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    },
    async excluir(chaves) {
      if (chaves.length === 0) return;
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: env.STORAGE_BUCKET,
          Delete: { Objects: chaves.map((Key) => ({ Key })) },
        }),
      );
    },
    urlPublica: (chave) => `${env.S3_PUBLIC_URL!}/${chave}`,
  };
}

export const storage: StorageDriver = env.STORAGE_DRIVER === 's3' ? driverS3() : driverSupabase();
