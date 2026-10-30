import { createClient } from "@supabase/supabase-js";
import type { Database } from "@catalogo/shared";

/** Cliente do navegador: chave publicável, sessão guardada no localStorage. */
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
