// Teste de integração da API contra o Supabase real. Cria usuários/lojas temporários e apaga tudo no fim.
// Uso: pnpm --filter @catalogo/api teste:integracao
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { env } from '../src/config/env.js';
import { supabaseAdmin } from '../src/config/supabase.js';
import { buildApp } from '../src/app.js';

process.loadEnvFile('../web/.env.local');
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const app = await buildApp({ logs: false });
const marca = Date.now();
const usuarios: string[] = [];
const lojas: string[] = [];
let falhas = 0;

function checar(descricao: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) {
    falhas++;
    if (extra !== undefined) console.log('   ', JSON.stringify(extra).slice(0, 300));
  }
}

async function criarUsuario(nome: string) {
  const email = `teste-${nome}-${marca}@catalogo.test`;
  const senha = `Senha-${marca}-x!`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw error;
  usuarios.push(data.user.id);
  const cliente = createClient(env.SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });
  const login = await cliente.auth.signInWithPassword({ email, password: senha });
  if (login.error) throw login.error;
  return { id: data.user.id, email, token: login.data.session.access_token };
}

async function chamar(token: string | null, method: string, url: string, body?: unknown) {
  const res = await app.inject({
    method: method as 'GET',
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body !== undefined ? { payload: body as object } : {}),
  });
  return { status: res.statusCode, json: res.body ? res.json() : null };
}

async function enviarImagens(token: string, url: string, imagens: Buffer[]) {
  const boundary = `----teste${marca}`;
  const partes = imagens.flatMap((img, i) => [
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="arquivo"; filename="foto${i}.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    img,
    Buffer.from('\r\n'),
  ]);
  const res = await app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([...partes, Buffer.from(`--${boundary}--\r\n`)]),
  });
  return { status: res.statusCode, json: res.json() };
}

try {
  const [donoA, donoB, adm] = await Promise.all([criarUsuario('a'), criarUsuario('b'), criarUsuario('adm')]);
  await supabaseAdmin.from('plataforma_admins').insert({ user_id: adm.id });

  // --- Administração da plataforma
  checar('Sem login: 401', (await chamar(null, 'GET', '/me')).status === 401);
  checar('Lojista não acessa /plataforma: 403', (await chamar(donoA.token, 'GET', '/plataforma/resumo')).status === 403);

  for (const [dono, sufixo] of [[donoA, 'a'], [donoB, 'b']] as const) {
    const r = await chamar(adm.token, 'POST', '/plataforma/lojas', {
      nome: `Loja Teste ${sufixo.toUpperCase()}`,
      slug: `teste-${sufixo}-${marca}`,
      telefone_pedidos: '5511999998888',
      email_dono: dono.email,
    });
    checar(`Admin cria loja ${sufixo.toUpperCase()} vinculada a usuário existente (sem convite)`, r.status === 201 && r.json.dono_convidado === false, r.json);
    lojas.push(r.json.id);
  }
  const [lojaA, lojaB] = lojas as [string, string];

  const slugReservado = await chamar(adm.token, 'POST', '/plataforma/lojas', {
    nome: 'X', slug: 'painel', telefone_pedidos: '5511999998888', email_dono: donoA.email,
  });
  checar('Slug reservado "painel" recusado: 400', slugReservado.status === 400, slugReservado.json);

  // --- Identidade
  const meA = await chamar(donoA.token, 'GET', '/me');
  checar('/me do dono A lista só a loja A', meA.json.lojas.length === 1 && meA.json.lojas[0].id === lojaA && meA.json.admin_plataforma === false, meA.json);
  checar('/me do admin indica admin_plataforma', (await chamar(adm.token, 'GET', '/me')).json.admin_plataforma === true);

  // --- Produtos
  const base = `/painel/lojas/${lojaA}`;
  const criado = await chamar(donoA.token, 'POST', `${base}/produtos`, {
    nome: 'Blusa Canelada', preco_original: 59.9, tamanhos: ['P', 'M', 'G'], cores: ['Preto'], categoria: 'Blusas',
  });
  checar('Dono A cria produto (#1)', criado.status === 201 && criado.json.numero === 1, criado.json);
  const produtoId = criado.json.id as string;

  const promo = await chamar(donoA.token, 'PATCH', `${base}/produtos/${produtoId}`, { preco_promocional: 70 });
  checar('Promoção maior que o preço recusada: 400', promo.status === 400, promo.json);

  const editado = await chamar(donoA.token, 'PATCH', `${base}/produtos/${produtoId}`, { preco_promocional: 49.9, ativo: false });
  checar('Edita promoção e pausa', editado.status === 200 && editado.json.preco_promocional === 49.9 && editado.json.ativo === false, editado.json);

  const busca = await chamar(donoA.token, 'GET', `${base}/produtos?busca=%231&status=pausados`);
  checar('Busca por "#1" entre pausados', busca.status === 200 && busca.json.length === 1, busca.json);
  checar('Categorias da loja', JSON.stringify((await chamar(donoA.token, 'GET', `${base}/categorias`)).json) === '["Blusas"]');

  // --- Isolamento entre lojas
  checar('Dono A não lê produtos da loja B: 404', (await chamar(donoA.token, 'GET', `/painel/lojas/${lojaB}/produtos`)).status === 404);
  checar('Dono B não edita produto da loja A pela rota da loja A: 404',
    (await chamar(donoB.token, 'PATCH', `${base}/produtos/${produtoId}`, { nome: 'hack' })).status === 404);
  checar('Dono B não alcança produto da loja A pela própria loja: 404',
    (await chamar(donoB.token, 'GET', `/painel/lojas/${lojaB}/produtos/${produtoId}`)).status === 404);
  checar('Admin da plataforma acessa painel da loja A (suporte)', (await chamar(adm.token, 'GET', `${base}/produtos`)).status === 200);

  // --- Imagens
  const png = (cor: string) => sharp({ create: { width: 2400, height: 1600, channels: 3, background: cor } }).png().toBuffer();
  const up = await enviarImagens(donoA.token, `${base}/produtos/${produtoId}/imagens`, [await png('#e74c3c'), await png('#3498db')]);
  const imagens = up.json.imagens as { id: string; url: string; ordem: number }[];
  checar('Upload de 2 fotos convertidas para WebP', up.status === 200 && imagens?.length === 2 && imagens.every((i) => i.url.endsWith('.webp')), up.json);

  const invalida = await enviarImagens(donoA.token, `${base}/produtos/${produtoId}/imagens`, [Buffer.from('nao sou imagem')]);
  checar('Arquivo inválido recusado: 400', invalida.status === 400, invalida.json);

  const reordenado = await chamar(donoA.token, 'PUT', `${base}/produtos/${produtoId}/imagens/ordem`, { ids: [imagens[1]!.id, imagens[0]!.id] });
  checar('Reordena fotos', reordenado.status === 200 && reordenado.json.imagens[0].id === imagens[1]!.id, reordenado.json);

  checar('Dono B não remove foto da loja A: 404',
    (await chamar(donoB.token, 'DELETE', `/painel/lojas/${lojaB}/imagens/${imagens[0]!.id}`)).status === 404);
  checar('Dono A remove foto', (await chamar(donoA.token, 'DELETE', `${base}/imagens/${imagens[0]!.id}`)).status === 204);

  // --- Métricas e status
  const resumo = await chamar(adm.token, 'GET', '/plataforma/resumo');
  checar('Resumo da plataforma', resumo.status === 200 && resumo.json.lojas.total >= 2 && resumo.json.produtos.total >= 1, resumo.json);
  const lista = await chamar(adm.token, 'GET', '/plataforma/lojas');
  const itemA = lista.json.find((l: { id: string }) => l.id === lojaA);
  checar('Lista de lojas com contagem de produtos e membros', itemA?.produtos.total === 1 && itemA?.membros === 1, itemA);
  checar('Admin desativa loja B', (await chamar(adm.token, 'PATCH', `/plataforma/lojas/${lojaB}/status`, { ativa: false })).json.ativa === false);

  // --- Exclusão
  checar('Exclui produto: 204', (await chamar(donoA.token, 'DELETE', `${base}/produtos/${produtoId}`)).status === 204);
  checar('Produto excluído some: 404', (await chamar(donoA.token, 'GET', `${base}/produtos/${produtoId}`)).status === 404);
} catch (err) {
  falhas++;
  console.error('❌ Erro inesperado:', err);
} finally {
  for (const lojaId of lojas) {
    const { data: pastas } = await supabaseAdmin.storage.from(env.STORAGE_BUCKET).list(lojaId);
    for (const pasta of pastas ?? []) {
      const { data: arquivos } = await supabaseAdmin.storage.from(env.STORAGE_BUCKET).list(`${lojaId}/${pasta.name}`);
      await supabaseAdmin.storage.from(env.STORAGE_BUCKET).remove((arquivos ?? []).map((a) => `${lojaId}/${pasta.name}/${a.name}`));
    }
    await supabaseAdmin.from('lojas').delete().eq('id', lojaId);
  }
  for (const id of usuarios) await supabaseAdmin.auth.admin.deleteUser(id);
  await app.close();
  console.log(falhas === 0 ? '\n🎉 Todos os testes passaram (dados de teste removidos).' : `\n⚠️  ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
}
