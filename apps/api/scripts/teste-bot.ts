// Teste ponta a ponta do bot SEM chaves: canal falso (no lugar do Telegram) e IA simulada
// (no lugar de Gemini/Groq), contra o Supabase real. Apaga tudo o que criou no fim.
// Uso: pnpm --filter @catalogo/api teste:bot
import sharp from 'sharp';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { supabaseAdmin } from '../src/config/supabase.js';
import { definirModelosParaTeste } from '../src/modules/ai/providers.js';
import { converterUpdate } from '../src/modules/channels/telegram/adapter.js';
import type { ChannelAdapter, InboundMessage, ReceberMensagens } from '../src/modules/channels/types.js';
import { excluirImagens } from '../src/modules/storage/imagens.js';

let falhas = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) falhas++;
};
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- IA simulada: cada chamada consome a próxima resposta programada ----
const uso = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
type Resposta = () => unknown;
function modeloSimulado() {
  const fila: Resposta[] = [];
  const estado = { chamadas: 0 };
  const modelo = new MockLanguageModelV4({
    doGenerate: async () => {
      estado.chamadas++;
      const proxima = fila.shift();
      if (!proxima) throw new Error('IA simulada: nenhuma resposta programada');
      return proxima() as never;
    },
  });
  return { modelo, estado, programar: (...r: Resposta[]) => fila.push(...r), limpar: () => (fila.length = 0) };
}
let seq = 0;
const chamarTool = (toolName: string, input: object) => () => ({
  content: [{ type: 'tool-call', toolCallId: `c${++seq}`, toolName, input: JSON.stringify(input) }],
  finishReason: { unified: 'tool-calls', raw: undefined },
  usage: uso,
  warnings: [],
});
const responderTexto = (text: string) => () => ({
  content: [{ type: 'text', text }],
  finishReason: { unified: 'stop', raw: undefined },
  usage: uso,
  warnings: [],
});
const falhar = () => () => {
  throw new Error('503 simulado');
};

// Segue o AI_PRIMARY_PROVIDER do .env: "primario" é quem responde primeiro, "reserva" o fallback.
const NOME_PRIMARIO = env.AI_PRIMARY_PROVIDER;
const NOME_RESERVA = NOME_PRIMARIO === 'gemini' ? 'groq' : 'gemini';
const primario = modeloSimulado();
const reserva = modeloSimulado();
definirModelosParaTeste({
  [NOME_PRIMARIO]: { provedor: NOME_PRIMARIO, nomeModelo: 'primario-simulado', modelo: primario.modelo },
  [NOME_RESERVA]: { provedor: NOME_RESERVA, nomeModelo: 'reserva-simulado', modelo: reserva.modelo },
});

// ---- Canal falso ----
const enviadas: string[] = [];
let receber: ReceberMensagens = async () => {};
const canalFalso: ChannelAdapter = {
  canal: 'telegram',
  registrar: (_app, r) => {
    receber = r;
  },
  iniciar: async () => {},
  parar: async () => {},
  enviarTexto: async (_dest, texto) => {
    enviadas.push(texto);
  },
  linkDeVinculo: async (codigo) => `https://t.me/bot_de_teste?start=${codigo}`,
};

const REMETENTE = `teste-${Date.now()}`;
let msgId = 0;
const mensagem = (extra: Partial<InboundMessage>): InboundMessage => ({
  canal: 'telegram',
  idExterno: `${REMETENTE}:${++msgId}`,
  remetente: REMETENTE,
  nomeRemetente: 'Lojista Teste',
  tipo: 'texto',
  recebidoEm: new Date(),
  ...extra,
});
async function enviarEEsperar(m: InboundMessage, respostas = 1, limiteMs = 15000) {
  const antes = enviadas.length;
  await receber([m]);
  const fim = Date.now() + limiteMs;
  while (enviadas.length < antes + respostas && Date.now() < fim) await esperar(100);
  return enviadas.slice(antes).join('\n---\n');
}

const app = await buildApp({ logs: false, bot: { canais: new Map([['telegram', canalFalso]]) } });
await app.ready();

const { data: loja, error } = await supabaseAdmin
  .from('lojas')
  .insert({ nome: 'Loja Teste Bot', slug: `teste-bot-${Date.now()}`, telefone_pedidos: '5511999998888' })
  .select('id, slug')
  .single();
if (error) throw error;

try {
  // 0. Conversão dos updates do Telegram (sem rede)
  const semRede = { baixarArquivo: async () => Buffer.alloc(0) };
  const de = { id: 42, is_bot: false, first_name: 'Ana', last_name: 'Lima' };
  const privado = { id: 42, type: 'private' as const };
  const [fotoTg] = converterUpdate(
    { update_id: 1, message: { message_id: 7, date: 1, chat: privado, from: de, caption: 'blusa 59', media_group_id: 'g1', photo: [{ file_id: 'p', width: 90, height: 90 }, { file_id: 'g', width: 1280, height: 1280 }] } },
    semRede,
  );
  ok(fotoTg?.tipo === 'imagem' && fotoTg.texto === 'blusa 59' && fotoTg.grupoMidia === 'g1' && fotoTg.idExterno === '42:7' && fotoTg.nomeRemetente === 'Ana Lima', 'Telegram: foto com legenda e álbum');
  ok(converterUpdate({ update_id: 2, message: { message_id: 8, date: 1, chat: privado, from: de, voice: { file_id: 'v', duration: 3 } } }, semRede)[0]?.tipo === 'audio', 'Telegram: áudio (voice)');
  ok(converterUpdate({ update_id: 3, message: { message_id: 9, date: 1, chat: privado, from: de, document: { file_id: 'd', mime_type: 'image/png' } } }, semRede)[0]?.tipo === 'imagem', 'Telegram: foto enviada como arquivo');
  ok(converterUpdate({ update_id: 4, message: { message_id: 10, date: 1, chat: { id: -5, type: 'group' }, from: de, text: 'oi' } }, semRede).length === 0, 'Telegram: mensagens de grupo são ignoradas');

  // 1. Conta não vinculada
  let r = await enviarEEsperar(mensagem({ texto: 'oi' }));
  ok(/não está ligada/.test(r), 'Conta não vinculada recebe instruções');

  // 2. Vínculo pelo código
  const codigo = 'TESTE' + String(Date.now()).slice(-3).replace(/[01]/g, '9');
  await supabaseAdmin.from('vinculos_canal').insert({
    codigo,
    loja_id: loja.id,
    canal: 'telegram',
    expira_em: new Date(Date.now() + 60_000).toISOString(),
  });
  r = await enviarEEsperar(mensagem({ texto: `/start ${codigo}` }));
  ok(/Pronto!.*Loja Teste Bot/s.test(r), 'Vínculo com /start CODIGO');
  r = await enviarEEsperar(mensagem({ texto: `/start ${codigo}` }));
  ok(/não é válido/.test(r), 'Código não serve duas vezes');

  // 3. Mensagem repetida (mesmo id) é ignorada
  const repetida = mensagem({ texto: '/ajuda' });
  await enviarEEsperar(repetida);
  const total = enviadas.length;
  await receber([repetida]);
  await esperar(800);
  ok(enviadas.length === total, 'Reenvio da mesma mensagem é descartado');

  // 4. Foto sem legenda → aviso
  const png = await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#c86b85' } }).png().toBuffer();
  const foto = () => mensagem({ tipo: 'imagem', baixarMidia: async () => ({ conteudo: png, mimeType: 'image/png' }) });
  r = await enviarEEsperar(foto());
  ok(/Recebi 1 foto/.test(r), 'Foto sem legenda gera aviso pedindo nome e preço');

  // 5. Texto cria o produto com a foto pendente
  primario.programar(
    chamarTool('criar_produto', { nome: 'Blusa Canelada', preco: 59.9, tamanhos: ['P', 'M', 'G'], cores: ['Preta'] }),
    responderTexto('✅ #1 Blusa Canelada, R$ 59,90, P/M/G'),
  );
  r = await enviarEEsperar(mensagem({ texto: 'blusa canelada 59,90 P M G preta' }));
  ok(r.includes('Blusa Canelada'), 'Cadastro por texto responde com o produto');
  const { data: produtos } = await supabaseAdmin
    .from('produtos')
    .select('id, numero, nome, preco_original, ativo, imagens:produto_imagens (id)')
    .eq('loja_id', loja.id);
  const blusa = produtos?.[0];
  ok(produtos?.length === 1 && blusa?.preco_original === 59.9, 'Produto criado no banco com o preço certo');
  ok(blusa?.imagens.length === 1, 'Foto pendente anexada ao produto');

  // 6. Edição pelo "último produto" (sem código)
  primario.programar(chamarTool('editar_produto', { preco: 49.9 }), responderTexto('✅ Preço atualizado'));
  await enviarEEsperar(mensagem({ texto: 'na verdade é 49,90' }));
  const { data: editada } = await supabaseAdmin.from('produtos').select('preco_original').eq('id', blusa!.id).single();
  ok(editada?.preco_original === 49.9, 'Edição usa o último produto da conversa');

  // 7. Erro de regra vira explicação (promoção maior que o preço)
  primario.programar(chamarTool('editar_produto', { preco_promocional: 99 }), responderTexto('A promoção precisa ser menor.'));
  await enviarEEsperar(mensagem({ texto: 'promoção por 99' }));
  const ultimaChamada = (primario.modelo.doGenerateCalls.at(-1)?.prompt ?? []) as { role: string; content: unknown }[];
  const resultadoTool = JSON.stringify(ultimaChamada.filter((p) => p.role === 'tool'));
  ok(/menor que o pre/i.test(resultadoTool), 'Erro de validação é devolvido à IA para explicar');

  // 8. Fallback: o primário falha, a reserva responde
  const chamadasReserva = reserva.estado.chamadas;
  primario.programar(falhar());
  reserva.programar(responderTexto('Você tem 1 produto.'));
  r = await enviarEEsperar(mensagem({ texto: 'quantos produtos eu tenho?' }));
  ok(r.includes('1 produto') && reserva.estado.chamadas === chamadasReserva + 1, 'Fallback para a reserva quando o primário falha');
  const { data: registro } = await supabaseAdmin
    .from('mensagens')
    .select('provedor_ia, usou_fallback, tokens_entrada')
    .eq('canal', 'telegram')
    .eq('id_externo', `${REMETENTE}:${msgId}`)
    .single();
  ok(registro?.provedor_ia === NOME_RESERVA && registro.usou_fallback && registro.tokens_entrada === 10, 'Rastreio de provedor, fallback e tokens');

  // 9. Falha depois de alterar dados: não repete no outro provedor
  const reservaAntes = reserva.estado.chamadas;
  primario.programar(chamarTool('pausar_produto', { numero: blusa!.numero }), falhar());
  r = await enviarEEsperar(mensagem({ texto: 'pausa a #1' }));
  const { data: pausada } = await supabaseAdmin.from('produtos').select('ativo').eq('id', blusa!.id).single();
  ok(pausada?.ativo === false && /Feito/.test(r) && reserva.estado.chamadas === reservaAntes, 'Sem retentativa depois de executar uma ação');

  // 10. Álbum com legenda: espera as fotos e cria com todas
  primario.limpar();
  primario.programar(chamarTool('criar_produto', { nome: 'Vestido Midi', preco: 159 }), responderTexto('✅ #2 Vestido Midi'));
  const antes = enviadas.length;
  await receber([
    { ...foto(), grupoMidia: 'album-1', texto: 'vestido midi 159' },
    { ...foto(), grupoMidia: 'album-1' },
  ]);
  const fim = Date.now() + 15000;
  while (enviadas.length === antes && Date.now() < fim) await esperar(100);
  const { data: vestido } = await supabaseAdmin
    .from('produtos')
    .select('nome, imagens:produto_imagens (id)')
    .eq('loja_id', loja.id)
    .eq('numero', 2)
    .maybeSingle();
  ok(vestido?.imagens.length === 2, 'Álbum com legenda cria o produto com todas as fotos');

  // 11. Áudio sem provedor de transcrição configurado → resposta amigável
  r = await enviarEEsperar(mensagem({ tipo: 'audio', baixarMidia: async () => ({ conteudo: Buffer.from('x'), mimeType: 'audio/ogg' }) }));
  ok(/Não consegui entender o áudio/.test(r), 'Falha na transcrição gera resposta (nenhuma mensagem fica sem resposta)');

  // 12. Limite de uso (429 com prazo, como a cota diária do Gemini): o primário fica pausado pelo prazo pedido
  primario.limpar();
  primario.programar(() => {
    throw new APICallError({
      message: 'You exceeded your current quota',
      url: 'https://ia.simulada',
      requestBodyValues: {},
      statusCode: 429,
      responseBody: '{"error":{"details":[{"retryDelay": "3600s"}]}}',
      isRetryable: false,
    });
  });
  reserva.programar(responderTexto('Você tem 2 produtos.'), responderTexto('Você tem 2 produtos ainda.'));
  await enviarEEsperar(mensagem({ texto: 'quantos produtos?' }));
  const primarioAntes = primario.estado.chamadas;
  r = await enviarEEsperar(mensagem({ texto: 'e agora?' }));
  ok(r.includes('2 produtos ainda') && primario.estado.chamadas === primarioAntes, 'Provedor no limite fica pausado (não é chamado de novo)');
} finally {
  // Limpeza: arquivos (produtos e pendentes), loja (cascata) e mensagens do remetente de teste.
  const [{ data: imgs }, { data: pend }] = await Promise.all([
    supabaseAdmin.from('produto_imagens').select('chave_storage').eq('loja_id', loja.id),
    supabaseAdmin.from('midias_pendentes').select('chave_storage').eq('loja_id', loja.id),
  ]);
  const chaves = [...new Set([...(imgs ?? []), ...(pend ?? [])].map((i) => i.chave_storage))];
  if (chaves.length) await excluirImagens(chaves);
  await supabaseAdmin.from('lojas').delete().eq('id', loja.id);
  await supabaseAdmin.from('mensagens').delete().eq('remetente', REMETENTE);
  await app.close();
}

console.log(falhas ? `\n💥 ${falhas} verificação(ões) falharam` : '\n🎉 Todos os testes do bot passaram (dados de teste removidos).');
process.exit(falhas ? 1 : 0);
