import { GoogleGenAI } from '@google/genai';
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

export interface AIResponse {
  reply: string;
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

  // 3. Verificação de Transbordo Humano por Palavras-Chave
  if (botSettings.human_handoff_enabled) {
    const keywords = botSettings.human_handoff_keywords || [
      'atendente',
      'humano',
      'falar com atendente',
      'pessoa',
      'suporte',
    ];
    const normalizedIncoming = incomingMessage
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const triggered = keywords.some((kw) => {
      const normKw = kw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      return normKw && normalizedIncoming.includes(normKw);
    });

    if (triggered) {
      const handoffMsg =
        botSettings.human_handoff_message ||
        'Com certeza! Estou transferindo seu atendimento para nossa equipe humana. Aguarde um instante por favor.';
      return {
        reply: handoffMsg,
        triggerHandoff: true,
      };
    }
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

  const preferredModel = botSettings.gemini_model || 'gemini-3.6-flash';
  const FALLBACK_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];
  const modelsToTry = Array.from(new Set([preferredModel, ...FALLBACK_MODELS]));
  let geminiError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.4,
        },
      });

      const replyText = response.text?.trim() || '';
      if (replyText) {
        // Se precisou mudar de modelo por cota/limite, salva o modelo ativo no banco
        // para que as próximas mensagens já comecem direto nele sem gastar tentativas
        if (model !== botSettings.gemini_model && tenant.id) {
          (async () => {
            try {
              const supabase = getServiceSupabase();
              await supabase
                .from('xerb_bot_settings')
                .update({ gemini_model: model, updated_at: new Date().toISOString() })
                .eq('tenant_id', tenant.id);
              console.log(`[Gemini] Modelo padrão do tenant ${tenant.name} atualizado automaticamente para: ${model}`);
            } catch (upErr: any) {
              console.warn('[Gemini] Erro ao persistir novo modelo:', upErr?.message);
            }
          })();
        }

        return {
          reply: replyText,
          triggerHandoff: false,
        };
      }
    } catch (err: any) {
      console.warn(`[Gemini] Falha no modelo ${model} (${err?.status || 'erro'}). Alternando para o próximo modelo...`);
      geminiError = err;
    }
  }

  console.error('[Gemini] Todos os modelos da lista atingiram limite de cota ou falharam:', geminiError?.message || geminiError);
  return {
    reply: 'Olá! Nosso atendente virtual está temporariamente com alta demanda de mensagens, mas já registrei seu contato e nossa equipe responderá em instantes! 😊',
    triggerHandoff: false,
  };
}
