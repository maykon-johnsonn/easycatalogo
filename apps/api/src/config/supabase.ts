import { createClient } from '@supabase/supabase-js';
import type { Database } from '@catalogo/shared';
import { env } from './env.js';

/**
 * Cliente com a secret key: IGNORA o RLS.
 * Toda query de catálogo feita com ele deve filtrar por `loja_id` (direcao.md, seção 5).
 */
export const supabaseAdmin = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
