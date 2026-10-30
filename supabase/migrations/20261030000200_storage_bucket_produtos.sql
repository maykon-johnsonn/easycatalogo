-- Bucket de imagens de produtos (Supabase Storage, usado no desenvolvimento até o MinIO ficar pronto).
-- Público para leitura via URL; uploads só pela API (secret key), que sempre converte para WebP.
-- Sem políticas em storage.objects de propósito: anon/authenticated não podem enviar nem apagar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo-produtos', 'catalogo-produtos', true, 2097152, array['image/webp'])
on conflict (id) do nothing;
