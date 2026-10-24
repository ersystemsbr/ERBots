import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { getServiceSupabase } from '../supabase';

export interface BotContext {
  tenant: {
    id: string;
    name: string;
    segment?: string;
  };
  botSettings: {
    bot_name?: string;
    tone?: 'formal' | 'friendly' | 'enthusiastic' | 'direct';
    system_prompt?: string;
    business_hours?: {
      enabled: boolean;
      days: number[]; // 0=domingo, 1=segunda...
      start: string; // "08:00"
      end: string; // "18:00"
      out_of_hours_message: string;
    };
    human_handoff_enabled?: boolean;
    human_handoff_keywords?: string[];
    human_handoff_message?: string;
    is_active?: boolean;
    gemini_model?: string;
  };
  knowledgeBase: Array<{
    category: string;
    title: string;
    content: string;
  }>;
  conversationHistory: Array<{
    sender: 'user' | 'ai' | 'human';
    content: string;
  }>;
  incomingMessage: string;
  customerName?: string;
}

/** Modelo padrão ÚNICO do ERBots (usado por cadastro, motor de IA e fallback). */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

/** Modelos alternativos, na ordem, caso o preferido falhe por cota/indisponibilidade. */
const FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
];

/** Modelos leves para interpretar áudio/imagem. */
const TRANSCRIBE_MODELS = ['gemini-3.5-flash-lite', DEFAULT_GEMINI_MODEL, 'gemini-flash-latest'];

/** Último modelo que respondeu com sucesso (cache por instância do servidor; não grava no banco). */
let lastGoodModel: string | null = null;

/** Marcador que a IA acrescenta quando decide transferir para um humano. */
const HANDOFF_MARKER = /\[\[\s*HANDOFF\s*\]\]/i;

/** Palavras-chave padrão de transbordo (frases específicas; evitam falsos positivos como "suporte" ou "pessoa"). */
export const DEFAULT_HANDOFF_KEYWORDS = [
  'atendente',
  'atendimento humano',
  'falar com humano',
  'falar com um humano',
  'falar com uma pessoa',
  'falar com alguem',
  'falar com o dono',
  'falar com o gerente',
  'falar com o responsavel',
  'quero um humano',
  'reclamacao',
  'reclamar',
  'estorno',
  'reembolso',
  'procon',
];

/** Lista que vinha como padrão do banco; é tratada como "não personalizada" e substituída pela nova. */
const LEGACY_HANDOFF_KEYWORDS = ['atendente', 'humano', 'falar com atendente', 'pessoa', 'suporte'];

function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Casa palavra/frase inteira (não pega "pessoas" por "pessoa" nem "atendentes" por engano de substring). */
export function matchesHandoff(text: string, keywords?: string[] | null): boolean {
  let list = keywords && keywords.length ? keywords : DEFAULT_HANDOFF_KEYWORDS;
  const normList = list.map(normalizeText).filter(Boolean);
  if (
    normList.length === LEGACY_HANDOFF_KEYWORDS.length &&
    LEGACY_HANDOFF_KEYWORDS.every((k) => normList.includes(k))
  ) {
    list = DEFAULT_HANDOFF_KEYWORDS;
  }
  const norm = normalizeText(text);
  return list.some((kw) => {
    const k = normalizeText(kw);
    if (!k) return false;
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}s?([^a-z0-9]|$)`).test(norm);
  });
}

export function defaultHandoffMessage(botSettings: { human_handoff_message?: string }): string {
  return (
    botSettings.human_handoff_message ||
    'Com certeza! Estou transferindo seu atendimento para nossa equipe humana. Aguarde um instante por favor.'
  );
}

export interface AIResponse {
  reply: string;
  /** Presente apenas quando a resposta foi GERADA pelo Gemini (usado para medir consumo por plano) */
  usage?: { tokensIn: number; tokensOut: number };
  triggerHandoff?: boolean;
  isOutOfHours?: boolean;
}

/**
 * Busca chave do Gemini nas variáveis de ambiente ou na tabela system_config
 */
export async function getGeminiApiKey(): Promise<string> {
  try {
    const supabase = getServiceSupabase();

    // 1. Prioridade: busca na tabela system_config global (onde já está configurada)
    const { data: pubKey } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'gemini_api_key')
      .maybeSingle();

    if (pubKey?.value) return pubKey.value;

    // 2. Busca na tabela xerb_system_config
    const { data: erKey } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', 'gemini_api_key')
      .maybeSingle();

    if (erKey?.value) return erKey.value;
  } catch (err) {
    console.warn('[Gemini] Erro ao recuperar chave de system_config:', err);
  }

  // 3. Fallback para variável de ambiente
  return process.env.GEMINI_API_KEY || '';
}

/**
 * Verifica se o momento atual está dentro do horário de atendimento configurado (Fuso Horário de Brasília)
 */
function isWithinBusinessHours(hoursConfig: BotContext['botSettings']['business_hours']): boolean {
  if (!hoursConfig || !hoursConfig.enabled) return true;

  try {
    const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentDay = nowBR.getDay(); // 0 a 6
    const currentMinutes = nowBR.getHours() * 60 + nowBR.getMinutes();

    if (hoursConfig.days && !hoursConfig.days.includes(currentDay)) {
      return false;
    }

    const [startH, startM] = (hoursConfig.start || '08:00').split(':').map(Number);
    const [endH, endM] = (hoursConfig.end || '18:00').split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch (e) {
    return true;
  }
}

/**
 * Processa a mensagem do WhatsApp através do motor de IA do ERBots
 */
export async function processAIMessage(ctx: BotContext): Promise<AIResponse> {
  const { tenant, botSettings, knowledgeBase, conversationHistory, incomingMessage, customerName } = ctx;

  // 1. Se o robô estiver desativado pelo cliente
  if (botSettings.is_active === false) {
    return { reply: '' };
  }

  // 2. Verificação de Horário de Funcionamento
  if (!isWithinBusinessHours(botSettings.business_hours)) {
    const outMsg =
      botSettings.business_hours?.out_of_hours_message ||
      'Olá! No momento estamos fora do horário de atendimento. Deixe sua mensagem que retornaremos em breve!';
    return {
      reply: outMsg,
      isOutOfHours: true,
    };
  }

  // 3. Verificação de Transbordo Humano por Palavras-Chave (frase inteira, sem acentos)
  if (botSettings.human_handoff_enabled && matchesHandoff(incomingMessage, botSettings.human_handoff_keywords)) {
    return {
      reply: defaultHandoffMessage(botSettings),
      triggerHandoff: true,
    };
  }
  // 4. Preparação da Base de Conhecimento
  let kbString = '';
  if (knowledgeBase && knowledgeBase.length > 0) {
    const grouped: Record<string, string[]> = {};
    for (const item of knowledgeBase) {
      const cat = item.category || 'Geral';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(`* ${item.title}: ${item.content}`);
    }

    kbString = '\nBASE DE CONHECIMENTO E INFORMAÇÕES DA EMPRESA:\n';
    for (const [cat, items] of Object.entries(grouped)) {
      kbString += `\n[Categoria: ${cat.toUpperCase()}]\n${items.join('\n')}\n`;
    }
  } else {
    kbString = '\n(Nenhuma base de conhecimento específica cadastrada ainda pelo estabelecimento).\n';
  }

  // 5. Definição do Tom de Voz
  const toneMap = {
    formal: 'extremamente profissional, polido, formal, sem gírias e com linguagem culta.',
    friendly: 'acolhedor, amigável, prestativo e simpático, podendo usar emojis moderados.',
    enthusiastic: 'enérgico, entusiasmado, positivo, motivador e vibrante.',
    direct: 'muito objetivo, direto ao ponto, com respostas curtas, rápidas e práticas.',
  };
  const toneDesc = toneMap[botSettings.tone || 'friendly'] || toneMap.friendly;

  const botName = botSettings.bot_name || 'Atendente Virtual';
  const companyName = tenant.name || 'nossa empresa';
  const segment = tenant.segment || 'Geral';

  // 6. Montagem da System Instruction
  const systemInstruction = `
Você é o(a) atendente virtual inteligente chamado(a) "${botName}", representando a empresa "${companyName}" (Segmento: ${segment}).

SEU OBJETIVO:
Recepcionar os clientes no WhatsApp, esclarecer dúvidas com precisão sobre serviços, produtos, preços e funcionamento da empresa, e prestar um atendimento ágil e de alta qualidade.

TOM DE VOZ:
Seu tom de voz deve ser ${toneDesc}

DIRETRIZES CRÍTICAS:
1. Utilize primordialmente as informações presentes na BASE DE CONHECIMENTO abaixo.
2. NUNCA invente preços, prazos ou regras que não estejam explícitas. Se não souber algo, responda educadamente que irá verificar com a equipe responsável ou sugira que o cliente fale com um atendente humano.
3. Formate suas respostas para WhatsApp: use *negrito* para dar destaque em termos importantes, use listas com hífens ou emojis quando oportuno para facilitar a leitura no celular.
4. Mantenha as mensagens concisas e fáceis de ler na tela do celular. Evite parágrafos longos e monótonos.
5. Se o cliente solicitar agendamento ou orçamento detalhado que não esteja na base, colete as informações principais e avise que a equipe dará andamento.
${customerName ? `6. O cliente se chama "${customerName}". Trate-o cordialmente pelo nome quando for natural.` : ''}
${
  botSettings.human_handoff_enabled
    ? '7. TRANSFERÊNCIA PARA HUMANO: se o cliente pedir para falar com uma pessoa, demonstrar irritação/reclamação séria, ou o assunto exigir decisão humana (cobrança, cancelamento, negociação, casos sensíveis) e você não conseguir resolver com a base, escreva uma mensagem curta e cordial avisando que vai chamar a equipe e finalize a resposta com o marcador exato [[HANDOFF]] (o cliente não verá o marcador). Nunca use o marcador sem necessidade.'
    : ''
}

${botSettings.system_prompt ? `INSTRUÇÕES PERSONALIZADAS DO PROPRIETÁRIO DA EMPRESA:\n${botSettings.system_prompt}\n` : ''}

${kbString}
`.trim();

  // 7. Chamada à API do Gemini
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    console.error('[Gemini] Chave API não encontrada!');
    return {
      reply: 'Olá! Agradecemos o contato. No momento nosso atendente virtual está em manutenção rápida. Nossa equipe humana já irá te atender!',
      triggerHandoff: true,
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // Converte histórico recente em formato compatível
  const contents: any[] = [];
  const recentHistory = (conversationHistory || []).slice(-8);

  for (const hist of recentHistory) {
    contents.push({
      role: hist.sender === 'user' ? 'user' : 'model',
      parts: [{ text: hist.content }],
    });
  }

  // Adiciona a mensagem atual
  contents.push({
    role: 'user',
    parts: [{ text: incomingMessage }],
  });

  const preferredModel = botSettings.gemini_model || DEFAULT_GEMINI_MODEL;
  const modelsToTry = Array.from(
    new Set([lastGoodModel || preferredModel, preferredModel, DEFAULT_GEMINI_MODEL, ...FALLBACK_MODELS])
  );
  let geminiError: any = null;

  for (const model of modelsToTry) {
    // `temperature` NÃO é enviado: está deprecado nos modelos 3.6+ (ignorado hoje, erro 400 no futuro).
    // Modelos 3.x usam thinking "médio" por padrão — para atendimento no WhatsApp "baixo" é suficiente e mais barato/rápido.
    const baseConfig: any = { systemInstruction };
    const attempts: any[] = /^gemini-3/.test(model)
      ? [{ ...baseConfig, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }, baseConfig]
      : [baseConfig];

    for (const config of attempts) {
      try {
        const response = await ai.models.generateContent({ model, contents, config });

        const rawText = response.text?.trim() || '';
        if (rawText) {
          // Cache em memória do último modelo que funcionou (NÃO persiste nada no banco do cliente)
          lastGoodModel = model;

          const handoffRequested = Boolean(botSettings.human_handoff_enabled) && HANDOFF_MARKER.test(rawText);
          const replyText = rawText.replace(new RegExp(HANDOFF_MARKER.source, 'gi'), '').trim();

          return {
            reply: replyText || (handoffRequested ? defaultHandoffMessage(botSettings) : ''),
            triggerHandoff: handoffRequested,
            usage: {
              tokensIn: Number(response.usageMetadata?.promptTokenCount) || 0,
              tokensOut: Number(response.usageMetadata?.candidatesTokenCount) || 0,
            },
          };
        }
        break; // resposta vazia: tenta o próximo modelo
      } catch (err: any) {
        geminiError = err;
        const status = err?.status || err?.code;
        // 400 por causa do thinkingConfig: repete o mesmo modelo sem ele
        if (status === 400 && config !== baseConfig) continue;
        console.warn(`[Gemini] Falha no modelo ${model} (${status || 'erro'}). Alternando para o próximo modelo...`);
        break;
      }
    }
  }

  console.error('[Gemini] Todos os modelos da lista atingiram limite de cota ou falharam:', geminiError?.message || geminiError);
  return {
    reply: 'Olá! Nosso atendente virtual está temporariamente com alta demanda de mensagens, mas já registrei seu contato e nossa equipe responderá em instantes! 😊',
    triggerHandoff: false,
  };
}

/**
 * Converte mídia (áudio/imagem) em texto para o restante do fluxo (histórico, transbordo, resposta).
 * Retorna null se não conseguir (o chamador pede ao cliente que escreva).
 */
export async function transcribeMedia(params: {
  kind: 'audio' | 'image';
  base64: string;
  mimeType: string;
  caption?: string;
}): Promise<{ text: string; tokensIn: number; tokensOut: number } | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });

  const instruction =
    params.kind === 'audio'
      ? 'Transcreva fielmente este áudio de WhatsApp em português, sem comentários e sem aspas. Se não houver fala compreensível, responda apenas: [inaudível]'
      : `Descreva objetivamente esta imagem enviada por um cliente no WhatsApp (e transcreva qualquer texto visível, como preços, nomes ou comprovantes), em no máximo 3 frases.${
          params.caption ? ` Legenda enviada pelo cliente: "${params.caption}".` : ''
        }`;

  for (const model of TRANSCRIBE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType: params.mimeType, data: params.base64 } }, { text: instruction }],
          },
        ],
      });
      const text = response.text?.trim() || '';
      if (text) {
        return {
          text,
          tokensIn: Number(response.usageMetadata?.promptTokenCount) || 0,
          tokensOut: Number(response.usageMetadata?.candidatesTokenCount) || 0,
        };
      }
    } catch (err: any) {
      console.warn(`[Gemini] Falha ao interpretar mídia no modelo ${model} (${err?.status || 'erro'}).`);
    }
  }
  return null;
}
