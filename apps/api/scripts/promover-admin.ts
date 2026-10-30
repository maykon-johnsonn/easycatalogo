// Concede acesso de administrador geral da plataforma a um e-mail.
// Uso: pnpm --filter @catalogo/api admin:promover voce@email.com
// Se o e-mail ainda não tiver conta, envia um convite.
import { z } from 'zod';
import { supabaseAdmin } from '../src/config/supabase.js';
import { obterOuConvidarUsuario } from '../src/modules/plataforma/plataforma.service.js';

const email = z.email().safeParse(process.argv[2]?.trim().toLowerCase());
if (!email.success) {
  console.error('Uso: pnpm --filter @catalogo/api admin:promover <email>');
  process.exit(1);
}

const usuario = await obterOuConvidarUsuario(email.data);
const { error } = await supabaseAdmin.from('plataforma_admins').upsert({ user_id: usuario.id });
if (error) {
  console.error('Falha ao promover:', error.message);
  process.exit(1);
}

console.log(`✅ ${email.data} agora é administrador da plataforma.`);
if (usuario.convidado) console.log('📧 Conta nova: um convite foi enviado para o e-mail.');
