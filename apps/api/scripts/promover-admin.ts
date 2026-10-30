// Concede acesso de administrador geral da plataforma a um e-mail.
// Uso: pnpm --filter @catalogo/api admin:promover voce@email.com
// Se o e-mail ainda não tiver conta, cria a conta com uma senha temporária (sem depender de envio de e-mail).
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { supabaseAdmin } from '../src/config/supabase.js';

const email = z.email().safeParse(process.argv[2]?.trim().toLowerCase());
if (!email.success) {
  console.error('Uso: pnpm --filter @catalogo/api admin:promover <email>');
  process.exit(1);
}

let senhaTemporaria: string | null = null;
let { data: userId, error: erroBusca } = await supabaseAdmin.rpc('usuario_id_por_email', { p_email: email.data });
if (erroBusca) {
  console.error('Falha ao buscar usuário:', erroBusca.message);
  process.exit(1);
}

if (!userId) {
  senhaTemporaria = randomBytes(9).toString('base64url');
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email.data,
    password: senhaTemporaria,
    email_confirm: true,
  });
  if (error) {
    console.error('Falha ao criar a conta:', error.message);
    process.exit(1);
  }
  userId = data.user.id;
}

const { error } = await supabaseAdmin.from('plataforma_admins').upsert({ user_id: userId });
if (error) {
  console.error('Falha ao promover:', error.message);
  process.exit(1);
}

console.log(`✅ ${email.data} agora é administrador da plataforma.`);
if (senhaTemporaria) {
  console.log(`🔑 Conta criada. Senha temporária: ${senhaTemporaria}`);
  console.log('   Entre em /entrar e troque em /conta/senha.');
}
