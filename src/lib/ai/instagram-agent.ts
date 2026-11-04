import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './gemini';

/**
 * Motor de IA para o Agente de Instagram do ERBots.
 * Baseado nas melhores práticas do `jakeschincariol/instagram-agent-skill`:
 * 1. Síntese do Guia de Voz e Knowledge Digest (voice.md - economia de tokens)
 * 2. Criação de posts com ganchos virais e humanizador anti-IA (ig-human / ig-reel / ig-caption / ig-carousel)
 * 3. Geração de comentários estratégicos para outros perfis (ig-comment / Social Selling)
 * 4. Planejador semanal de conteúdo com os 4 pilares (ig-plan)
 * 5. Geração de imagens comerciais via Imagen 3 / Gemini
 */

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

export function formatAIError(err: any): Error {
  const msg = String(err?.message || '');
  if (
    msg.includes('503') ||
    msg.toLowerCase().includes('high demand') ||
    msg.includes('UNAVAILABLE') ||
    err?.status === 503 ||
    err?.code === 503
  ) {
    return new Error(
      'Os servidores de IA estão com alta demanda momentânea. Tentamos modelos alternativos automaticamente; por favor, aguarde alguns instantes e tente novamente.'
    );
  }
  if (
    msg.includes('429') ||
    msg.toLowerCase().includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    err?.status === 429 ||
    err?.code === 429
  ) {
    return new Error('Limite temporário de requisições atingido. Por favor, aguarde alguns segundos.');
  }
  try {
    const parsed = JSON.parse(msg);
    if (parsed?.error?.message) {
      return new Error(parsed.error.message);
    }
  } catch {}
  return err instanceof Error ? err : new Error(msg || 'Erro inesperado no motor de inteligência artificial.');
}

async function getGenAI(): Promise<GoogleGenAI> {
  let apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    apiKey = await getGeminiApiKey();
  }
  if (!apiKey) {
    throw new Error('Chave da API do Gemini não configurada.');
  }
  return new GoogleGenAI({ apiKey });
}

async function callGeminiWithFallback(ai: GoogleGenAI, config: any): Promise<any> {
  let lastErr: any = null;
  for (const model of GEMINI_MODELS) {
    try {
      return await ai.models.generateContent({
        ...config,
        model,
      });
    } catch (err: any) {
      lastErr = err;
      console.warn(`[InstagramAgent] Falha no modelo ${model}:`, err?.message || err);
      // Sempre tenta o próximo modelo da lista para garantir resiliência contra 503, 429, 404, etc.
      continue;
    }
  }
  throw formatAIError(lastErr);
}

export interface BrandKnowledgeInput {
  companyName: string;
  niche: string;
  targetAudience: string;
  brandVoice: string;
  visualStyle: string;
  wordsIUse?: string;
  wordsINeverSay?: string;
  offLimitsTopics?: string;
}

export interface ReelBeat {
  time: string; // Ex: '0-3s', '4-15s', '16-30s'
  visual: string; // O que aparece no vídeo
  speech: string; // O que a pessoa fala
}

export interface CarouselSlide {
  slide_number: number;
  title: string;
  content: string;
}

export interface GeneratedPostData {
  hook_title: string;
  hook_score: number; // 0 a 100
  post_type: 'single_image' | 'carousel' | 'reel_script';
  caption: string;
  hashtags: string[];
  image_prompt: string;
  visual_notes: string;
  reel_script?: {
    hook_3s: string;
    beat_sheet: ReelBeat[];
    on_screen_text: string[];
  };
  carousel_slides?: CarouselSlide[];
}

export interface WeeklyPlanItem {
  day: string; // 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'
  pillar: 'Autoridade' | 'Conexão' | 'Venda' | 'Atração';
  format: 'Reels' | 'Carrossel' | 'Post com Foto';
  hook_title: string;
  key_message: string;
  cta: string;
}

/**
 * 1. MÉTODO DE ECONOMIA DE TOKENS & GUIA DE VOZ (voice.md + Knowledge Digest)
 * Sintetiza as diretrizes da marca em um documento ultracompacto (~400 tokens),
 * aplicando o padrão voice.md do repositório jakeschincariol/instagram-agent-skill.
 */
export async function generateKnowledgeDigest(input: BrandKnowledgeInput): Promise<string> {
  const ai = await getGenAI();

  const prompt = `Você é um estrategista de conteúdo para Instagram e arquiteto de IA especializado em tom de voz autêntico (voice.md).
Sua missão é criar o "Knowledge Digest & Guia de Voz" condensado para a empresa "${input.companyName}".

DADOS DA EMPRESA:
- Nicho: ${input.niche}
- Público-Alvo: ${input.targetAudience}
- Tom de Voz Base: ${input.brandVoice}
- Estilo Visual: ${input.visualStyle}
${input.wordsIUse ? `- Palavras/expressões que a marca REALMENTE usa: ${input.wordsIUse}` : ''}
${input.wordsINeverSay ? `- Palavras/jargões que NUNCA deve falar: ${input.wordsINeverSay}` : ''}
${input.offLimitsTopics ? `- Temas fora de limite (proibidos): ${input.offLimitsTopics}` : ''}

REQUISITOS (PADRÃO VOICE.MD CONDENSADO):
1. Deve ter entre 300 e 500 palavras, em Markdown limpo e objetivo.
2. Elimine qualquer clichê de IA ("mergulhe conosco", "no mundo dinâmico de hoje", "desvende o segredo", etc.).
3. Estrutura obrigatória:
   - [DNA & Posicionamento]: 2 frases diretas sobre quem é a marca e o que ela resolve.
   - [Top 5 Ganchos Virais]: 5 estruturas de títulos dos primeiros 3 segundos validadas para este nicho.
   - [Filtro de Humanização]: Lista de palavras naturais permitidas vs palavras artificiais proibidas.
   - [Diretrizes Visuais]: Regras de iluminação, cores e composição para artes/fotos de IA.
   - [Gatilhos de Conversão]: O que faz esse público comentar e comprar no direct.

Retorne EXCLUSIVAMENTE o conteúdo em Markdown do Knowledge Digest, sem introduções.`;

  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      temperature: 0.3,
    },
  });

  return response.text || '';
}

/**
 * 2. GERAÇÃO DE POST VIRAL HUMANIZADO (ig-reel / ig-caption / ig-carousel / ig-human)
 * Suporta 3 formatos:
 * - single_image: Post de feed com imagem fotográfica gerada por IA
 * - reel_script: Roteiro de vídeo curto com gancho dos 3s, beat sheet e texto na tela
 * - carousel: Carrossel didático slide a slide
 */
export async function generateViralPost(params: {
  companyName: string;
  niche: string;
  format?: 'single_image' | 'carousel' | 'reel_script';
  knowledgeDigest?: string | null;
  topicHint?: string;
  visualStyle?: string;
}): Promise<GeneratedPostData> {
  const ai = await getGenAI();
  const format = params.format || 'single_image';

  const digestContext = params.knowledgeDigest
    ? `\n### GUIA DE VOZ & KNOWLEDGE DIGEST ATIVO:\n${params.knowledgeDigest}\n`
    : `\nNicho: ${params.niche}\n`;

  const prompt = `Você é o Agente Autônomo de Instagram do ERBots, operando com as habilidades do repositório jakeschincariol/instagram-agent-skill.
Sua missão é criar uma publicação de altíssimo engajamento para a empresa "${params.companyName}".
FORMATO SOLICITADO: ${format.toUpperCase()} (single_image = post fotográfico único, reel_script = roteiro de Reels, carousel = carrossel educativo)

${digestContext}
${params.topicHint ? `TEMA ESPECÍFICO DO DIA: "${params.topicHint}"` : 'TEMA: Escolha um tema de forte atração, curiosidade ou quebra de mito dentro do nicho.'}

DIRETRIZES DE HUMANIZAÇÃO ANTI-IA (PADRÃO ig-human):
1. NUNCA use clichês de IA: "você sabia?", "vamos mergulhar", "no cenário atual", "o segredo é simples", "desbloqueie seu potencial".
2. Sem travessões duplos (—) em excesso.
3. Escreva como uma pessoa experiente conversando com um amigo no café. Frases curtas, diretas e naturais.
4. Os primeiros 125 caracteres da legenda DEVEM prender a atenção antes do botão "...mais".
5. CTA claro para automação: Estimule uma palavra-chave simples ("Comente X para receber o guia completo no Direct").
6. hook_score: Avalie de 0 a 100 a força do gancho (capacidade de parar a rolagem no feed).

INSTRUÇÕES ESPECÍFICAS POR FORMATO:
- Se single_image: crie um prompt detalhado em inglês para foto realista de produto/cena em estúdio.
- Se reel_script: forneça beat_sheet com tempos (0-3s gancho, 4-15s conteúdo, 16-30s CTA), ações visuais e falas, mais on_screen_text.
- Se carousel: forneça 5 slides numerados (Slide 1: Capa com gancho, Slides 2 a 4: Conteúdo de alto valor, Slide 5: Chamada para ação).

FORMATO DE RESPOSTA OBRIGATÓRIO (JSON VÁLIDO):
{
  "hook_title": "Título forte e magnético (1 linha)",
  "hook_score": 94,
  "post_type": "${format}",
  "caption": "Legenda completa formatada...",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "image_prompt": "Commercial photography prompt in English, studio lighting, 8k",
  "visual_notes": "explicação visual",
  "reel_script": {
    "hook_3s": "Frase de abertura impactante nos primeiros 3 segundos",
    "beat_sheet": [
      { "time": "0-3s", "visual": "Olhando para a câmera com expressão intrigada", "speech": "Frase de abertura" },
      { "time": "4-15s", "visual": "Mostrando o processo na prática", "speech": "Explicação rápida" },
      { "time": "16-30s", "visual": "Apontando para a tela", "speech": "Comente X que eu te mando agora" }
    ],
    "on_screen_text": ["TEXTO 1 NA TELA", "TEXTO 2 NA TELA"]
  },
  "carousel_slides": [
    { "slide_number": 1, "title": "Capa Magnética", "content": "Gancho principal" },
    { "slide_number": 2, "title": "O Maior Erro", "content": "Ponto de dor" },
    { "slide_number": 3, "title": "O Que Fazer", "content": "Passo prático 1" },
    { "slide_number": 4, "title": "O Segredo Real", "content": "Passo prático 2" },
    { "slide_number": 5, "title": "Próximo Passo", "content": "Comente X para receber o material completo" }
  ]
}`;

  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.6,
    },
  });

  const rawText = response.text || '{}';
  try {
    const data = JSON.parse(rawText) as GeneratedPostData;
    return {
      hook_title: data.hook_title || 'Dica Prática para Você Hoje',
      hook_score: typeof data.hook_score === 'number' ? data.hook_score : 92,
      post_type: format,
      caption: data.caption || 'Confira os detalhes no post!',
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : ['#dica', `#${params.niche.replace(/\s+/g, '')}`],
      image_prompt: data.image_prompt || `Commercial photography for ${params.niche}, warm cinematic lighting, high resolution, 8k`,
      visual_notes: data.visual_notes || 'Imagem promocional realista',
      reel_script: data.reel_script,
      carousel_slides: data.carousel_slides,
    };
  } catch (err) {
    console.error('[InstagramAgent] Erro ao parsear JSON de post:', rawText, err);
    throw new Error('Falha ao processar o post gerado pela IA.');
  }
}

/**
 * 3. SOCIAL SELLING: GERADOR DE COMENTÁRIOS ESTRATÉGICOS (ig-comment)
 * Gera 3 comentários inteligentes para deixar em posts de outros perfis e atrair tráfego qualificado.
 */
export async function generateStrategicComments(params: {
  niche: string;
  competitorPostText: string;
  brandVoice?: string;
}): Promise<string[]> {
  const ai = await getGenAI();

  const prompt = `Você é um estrategista de Social Selling no Instagram (habilidade ig-comment).
Sua missão é escrever 3 opções de comentários para deixar no post de OUTRO perfil do nicho "${params.niche}".

TEXTO DO POST DO OUTRO PERFIL:
"${params.competitorPostText}"

REGRAS DO COMENTÁRIO MAGNÉTICO:
1. NÃO faça autopromoção óbvia ("sigam meu perfil" ou "vendo isso também").
2. Adicione uma perspectiva real, cite uma experiência ou faça uma complementação inteligente que faça as pessoas que lerem quererem clicar na sua foto de perfil.
3. Soa como uma pessoa real e autoridade no assunto.
4. Curto: 1 a 3 frases no máximo.

Retorne EXCLUSIVAMENTE um array JSON com 3 strings de comentários:
["Comentário 1...", "Comentário 2...", "Comentário 3..."]`;

  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
  });

  try {
    const arr = JSON.parse(response.text || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [
      'Excelente ponto! Na prática aqui vejo que a consistência nisso faz toda a diferença.',
      'Muito boa essa visão. O detalhe que quase ninguém repara é o impacto disso no longo prazo.',
      'Concordo 100%. Quando ajustamos esse ponto, os resultados mudaram de patamar.',
    ];
  }
}

/**
 * 4. PLANEJADOR SEMANAL DE CONTEÚDO (ig-plan)
 * Distribui 7 dias de publicações nos 4 pilares: Autoridade, Conexão, Venda e Atração.
 */
export async function generateWeeklyPlan(params: {
  companyName: string;
  niche: string;
  knowledgeDigest?: string | null;
}): Promise<WeeklyPlanItem[]> {
  const ai = await getGenAI();

  const prompt = `Você é um estrategista de conteúdo para Instagram (habilidade ig-plan).
Crie um plano semanal completo (7 dias, Segunda a Domingo) para a empresa "${params.companyName}" no nicho "${params.niche}".

PILARES OBRIGATÓRIOS:
- Autoridade: Ensino de técnica, quebra de mito ou demonstração de domínio.
- Conexão: Bastidores, vulnerabilidade controlada ou valores.
- Venda: Oferta direta, prova social ou quebra de objeção comercial.
- Atração: Gancho viral amplo para atrair novas pessoas.

Retorne EXCLUSIVAMENTE um array JSON com 7 objetos:
[
  {
    "day": "Segunda-feira",
    "pillar": "Atração",
    "format": "Reels",
    "hook_title": "O erro que quase todo mundo comete ao começar...",
    "key_message": "Explicar de forma rápida o principal obstáculo e como contornar.",
    "cta": "Comente GUIA para receber o checklist."
  },
  ...
]`;

  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.6,
    },
  });

  try {
    const arr = JSON.parse(response.text || '[]');
    return Array.isArray(arr) && arr.length > 0
      ? arr
      : [
          {
            day: 'Segunda-feira',
            pillar: 'Atração',
            format: 'Reels',
            hook_title: 'O erro número 1 que está custando seus resultados',
            key_message: 'Quebra de mito comum no início da jornada.',
            cta: 'Comente ERRO para ver o diagnóstico.',
          },
          {
            day: 'Terça-feira',
            pillar: 'Autoridade',
            format: 'Carrossel',
            hook_title: '3 passos práticos para aplicar ainda hoje',
            key_message: 'Tutorial educativo passo a passo.',
            cta: 'Salve para consultar depois.',
          },
          {
            day: 'Quarta-feira',
            pillar: 'Conexão',
            format: 'Post com Foto',
            hook_title: 'Os bastidores do que ninguém te conta',
            key_message: 'História real de superação e lição aprendida.',
            cta: 'Você já passou por isso? Me conte nos comentários.',
          },
          {
            day: 'Quinta-feira',
            pillar: 'Venda',
            format: 'Reels',
            hook_title: 'Como nossos clientes alcançam essa meta sem estresse',
            key_message: 'Estudo de caso e chamada para ação direta.',
            cta: 'Comente QUERO para falar com nossa equipe.',
          },
          {
            day: 'Sexta-feira',
            pillar: 'Atração',
            format: 'Carrossel',
            hook_title: 'Lista de ferramentas essenciais que você precisa conhecer',
            key_message: 'Conteúdo altamente compartilhável.',
            cta: 'Compartilhe com um amigo que precisa ver isso.',
          },
          {
            day: 'Sábado',
            pillar: 'Conexão',
            format: 'Post com Foto',
            hook_title: 'O que aprendi esta semana trabalhando no nosso negócio',
            key_message: 'Reflexão rápida e humanizada de fim de semana.',
            cta: 'Bom fim de semana a todos!',
          },
          {
            day: 'Domingo',
            pillar: 'Autoridade',
            format: 'Reels',
            hook_title: 'Planeje sua semana antes de começar na correria',
            key_message: 'Dica estratégica para organizar os próximos 7 dias.',
            cta: 'Pronto para a nova semana? Deixe seu fogo 🔥.',
          },
        ];
  } catch {
    return [];
  }
}

export type ImageAspectRatio = '4:5' | '9:16' | '1:1';

export interface PostImageOptions {
  hookTitle?: string;
  companyName?: string;
  username?: string;
  niche?: string;
  categoryBadge?: string;
  aspectRatio?: ImageAspectRatio;
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine = 30, maxLines = 3): string[] {
  const words = String(text || '').trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * 5. GERAÇÃO DE IMAGENS POR IA (Imagen 3 / Gemini com Formato Configurável: 4:5, 9:16 ou 1:1)
 */
export async function generatePostImage(imagePrompt: string, options?: PostImageOptions): Promise<string> {
  const ai = await getGenAI();
  const ratio = options?.aspectRatio || '4:5';
  const width = 1080;
  let height = 1350; // Padrão 4:5 (mais usado no Feed do Instagram hoje)
  let imagenRatio = '3:4'; // Proporção mais próxima suportada no Imagen 3

  if (ratio === '9:16') {
    height = 1920;
    imagenRatio = '9:16';
  } else if (ratio === '1:1') {
    height = 1080;
    imagenRatio = '1:1';
  }

  try {
    const response = await (ai.models as any).generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `${imagePrompt}, commercial advertising photography, perfect lighting, ultra-high resolution, 4k`,
      config: {
        numberOfImages: 1,
        aspectRatio: imagenRatio,
        outputMimeType: 'image/jpeg',
      },
    });

    const base64Image = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64Image) {
      return `data:image/jpeg;base64,${base64Image}`;
    }
  } catch (err: any) {
    console.warn('[InstagramAgent] Imagen 3 indisponível ou cota excedida, fallback para card editorial de agência:', err?.message || err);
  }

  // Fallback: Card de Design Editorial de Agência no formato selecionado (4:5, 9:16 ou 1:1)
  const title = options?.hookTitle || 'Estratégia Prática para o Seu Negócio';
  const badge = escapeXml(options?.categoryBadge || 'ESTRATÉGIA PRÁTICA');
  const rawHandle = options?.username || options?.companyName || 'seu_negocio';
  const handle = escapeXml(`@${rawHandle.replace(/^@+/, '')}`);
  const lines = wrapText(title, 28, 3);

  const titleSvgLines = lines
    .map(
      (line, i) =>
        `<text x="0" y="${i * 70}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="56" font-weight="900" fill="${
          i === 0 ? '#ffffff' : '#f8fafc'
        }" letter-spacing="-1">${escapeXml(line)}</text>`
    )
    .join('\n');

  // Ajustes verticais de acordo com o formato da tela
  const cardY = 460;
  const cardHeight = ratio === '9:16' ? 760 : ratio === '4:5' ? 490 : 340;
  const ctaY = height - 190;
  const footerY = height - 85;

  const point1Y = 75;
  const point2Y = ratio === '1:1' ? 175 : 220;
  const point3Y = ratio === '1:1' ? 275 : 365;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="50%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <radialGradient id="glowTop" cx="20%" cy="15%" r="65%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="glowBottom" cx="85%" cy="85%" r="60%">
        <stop offset="0%" stop-color="#6366f1" stop-opacity="0.20" />
        <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="pillGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#059669" />
        <stop offset="100%" stop-color="#10b981" />
      </linearGradient>
      <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#10b981" />
        <stop offset="50%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#818cf8" />
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" fill="url(#bg)" />
    <rect width="${width}" height="${height}" fill="url(#glowTop)" />
    <rect width="${width}" height="${height}" fill="url(#glowBottom)" />

    <rect x="44" y="44" width="${width - 88}" height="${height - 88}" rx="36" fill="none" stroke="#1e293b" stroke-width="2" />

    <g transform="translate(84, 94)">
      <rect x="0" y="0" width="260" height="48" rx="24" fill="#10b981" fill-opacity="0.16" stroke="#10b981" stroke-opacity="0.45" stroke-width="1.5" />
      <text x="130" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#34d399" text-anchor="middle" letter-spacing="1.2">⚡ ${badge}</text>
      <text x="912" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="700" fill="#94a3b8" text-anchor="end">${handle}</text>
    </g>

    <rect x="84" y="174" width="912" height="2" fill="url(#accentLine)" rx="1" />

    <g transform="translate(84, 250)">
      ${titleSvgLines}
    </g>

    <g transform="translate(84, ${cardY})">
      <rect x="0" y="0" width="912" height="${cardHeight}" rx="28" fill="#0f172a" fill-opacity="0.88" stroke="#334155" stroke-width="1.5" />
      
      <circle cx="50" cy="${point1Y}" r="18" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="2" />
      <text x="50" y="${point1Y + 6}" font-family="sans-serif" font-size="16" font-weight="900" fill="#34d399" text-anchor="middle">✓</text>
      <text x="90" y="${point1Y - 4}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#ffffff">01. O ERRO QUE TRAVA SEUS RESULTADOS</text>
      <text x="90" y="${point1Y + 24}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="500" fill="#94a3b8">Fazer postagens sem gancho magnético e sem foco em atrair clientes.</text>

      <circle cx="50" cy="${point2Y}" r="18" fill="#38bdf8" fill-opacity="0.2" stroke="#38bdf8" stroke-width="2" />
      <text x="50" y="${point2Y + 6}" font-family="sans-serif" font-size="16" font-weight="900" fill="#38bdf8" text-anchor="middle">✓</text>
      <text x="90" y="${point2Y - 4}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#ffffff">02. A REGRA DOS PRIMEIROS 3 SEGUNDOS</text>
      <text x="90" y="${point2Y + 24}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="500" fill="#94a3b8">Prender a atenção imediata e eliminar todo e qualquer clichê de IA.</text>

      <circle cx="50" cy="${point3Y}" r="18" fill="#a855f7" fill-opacity="0.2" stroke="#a855f7" stroke-width="2" />
      <text x="50" y="${point3Y + 6}" font-family="sans-serif" font-size="16" font-weight="900" fill="#c084fc" text-anchor="middle">✓</text>
      <text x="90" y="${point3Y - 4}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#ffffff">03. CONVERSÃO DIRETA PARA O WHATSAPP</text>
      <text x="90" y="${point3Y + 24}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="500" fill="#94a3b8">Transformar visualizações em conversas no Zap com o robô ERBots.</text>
    </g>

    <g transform="translate(84, ${ctaY})">
      <rect x="0" y="0" width="912" height="74" rx="20" fill="url(#pillGrad)" />
      <text x="456" y="45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="21" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="0.8">💬 COMENTE "QUERO" PARA RECEBER NO DIRECT / WHATSAPP</text>
    </g>

    <text x="540" y="${footerY}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="600" fill="#64748b" text-anchor="middle" letter-spacing="1.5">PUBLICADO VIA ERBOTS • ATENDIMENTO INTELIGENTE</text>
  </svg>`;

  const base64Svg = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64Svg}`;
}

/**
 * 6. VIRALITY SKILL (/ig-viral)
 * Faz o Raio-X de um vídeo/tema viral e cria um roteiro viral inédito adaptado para o perfil.
 */
export type ViralLabMode = 'niche_search' | 'competitor_profile' | 'video_link_or_text';

export interface ViralAnalysisResult {
  source_topic: string;
  hook_breakdown: {
    hook_type: string;
    why_it_worked: string;
    retention_factor: string;
    emotional_trigger: string;
  };
  new_script: {
    title: string;
    hook_3s: string;
    on_screen_text: string[];
    beat_sheet: Array<{ time: string; visual: string; speech: string }>;
    caption: string;
    cta: string;
    virality_score: number;
  };
}

export async function analyzeViralVideoAndCreateScript(params: {
  niche: string;
  viralReference: string;
  mode?: ViralLabMode;
  companyName: string;
  brandVoice?: string;
  knowledgeDigest?: string | null;
}): Promise<ViralAnalysisResult> {
  const ai = await getGenAI();
  const mode = params.mode || 'video_link_or_text';

  let modeInstruction = '';
  if (mode === 'niche_search') {
    modeInstruction = `MODO ATIVO: PESQUISA DE TENDÊNCIAS VIRAIS NO INSTAGRAM & INTERNET
TEMA / PALAVRA-CHAVE DO NICHO PESQUISADA: "${params.viralReference}"
SUA MISSÃO ESPECÍFICA:
1. Mapeie os formatos, temas polêmicos, quebras de mitos e ganchos mais virais do momento (com mais de 500k visualizações) no Instagram/TikTok para este nicho.
2. Faça o Raio-X detalhado de por que essa abordagem retém a audiência (0 a 3s, retenção e gatilho emocional).
3. Desenvolva um roteiro inédito e original de altíssimo potencial de viralização adaptado para "${params.companyName}".`;
  } else if (mode === 'competitor_profile') {
    modeInstruction = `MODO ATIVO: ESPIONAGEM & MODELAGEM DE PERFIL DE SUCESSO NO INSTAGRAM
PERFIL DE REFERÊNCIA INFORMADO: "${params.viralReference}"
SUA MISSÃO ESPECÍFICA:
1. Analise o padrão de conteúdo, ganchos e formato de Reels que geram maior engajamento e novos seguidores para esse tipo de perfil.
2. Faça o Raio-X da estratégia de atração (gancho inicial, dinâmica de cortes e gatilho de conexão).
3. Crie um roteiro inédito superior e mais magnético, customizado para a empresa "${params.companyName}".`;
  } else {
    modeInstruction = `MODO ATIVO: RAIO-X DE VÍDEO OU LINK ESPECÍFICO
REFERÊNCIA VIRAL INFORMADA: "${params.viralReference}"
SUA MISSÃO ESPECÍFICA:
1. Fazer o Raio-X completo do vídeo/gancho (analisar por que viralizou: gancho dos primeiros 3 segundos, ritmo, retenção e gatilho emocional).
2. Criar um roteiro viral inédito e executável para a empresa "${params.companyName}" no nicho "${params.niche}".`;
  }

  const prompt = `Você é o especialista mestre da Virality Skill (/ig-viral) do ecossistema de Instagram.

${modeInstruction}

EMPRESA: "${params.companyName}"
NICHO: "${params.niche}"
${params.knowledgeDigest ? `DIRETRIZES DA MARCA (KNOWLEDGE DIGEST):\n${params.knowledgeDigest}\n` : ''}

DIRETRIZES DE CRIAÇÃO:
- Sem clichês de IA (nada de "você sabia?", "vamos mergulhar", "no mundo de hoje").
- O gancho dos primeiros 3 segundos DEVE parar a rolagem imediatamente com quebra de padrão ou curiosidade extrema.
- O beat sheet deve ser claro e executável (tempo, o que mostrar na câmera, o que falar).

Retorne EXCLUSIVAMENTE um JSON válido com esta estrutura:
{
  "source_topic": "Resumo do tema",
  "hook_breakdown": {
    "hook_type": "Quebra de Crença / Curiosidade Negativa / Promessa Irresistível",
    "why_it_worked": "Explicação do porquê o vídeo viralizou",
    "retention_factor": "Como o ritmo manteve as pessoas assistindo até o fim",
    "emotional_trigger": "Curiosidade / Alívio / Ganância / Ambição"
  },
  "new_script": {
    "title": "Título do novo vídeo",
    "hook_3s": "Frase de abertura exata para falar nos primeiros 3 segundos",
    "on_screen_text": ["TEXTO 1 NA TELA", "TEXTO 2 NA TELA"],
    "beat_sheet": [
      { "time": "0-3s", "visual": "Olhando sério para a lente", "speech": "Frase de abertura" },
      { "time": "4-15s", "visual": "Mostrando o problema na tela", "speech": "Desenvolvimento rápido" },
      { "time": "16-30s", "visual": "Revelando a solução prática", "speech": "O método real" },
      { "time": "31-45s", "visual": "Chamada para ação", "speech": "Comente X que eu te envio" }
    ],
    "caption": "Legenda humanizada com primeiros 125 caracteres magnéticos...",
    "cta": "Comente X para receber...",
    "virality_score": 96
  }
}`;

  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.6,
    },
  });

  const raw = response.text || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {
      source_topic: params.viralReference.slice(0, 80),
      hook_breakdown: {
        hook_type: 'Quebra de Padrão e Curiosidade Extrema',
        why_it_worked: 'Começa desmentindo uma verdade aceita pelo mercado nos primeiros 3 segundos.',
        retention_factor: 'Alternância rápida de cortes e entrega de valor sem rodeios.',
        emotional_trigger: 'Medo de estar perdendo tempo ou dinheiro com o método errado.',
      },
      new_script: {
        title: 'O Maior Erro do Nicho Revelado',
        hook_3s: 'Pare de fazer isso se você não quer jogar dinheiro no lixo.',
        on_screen_text: ['PARE AGORA', 'O JEITO CERTO'],
        beat_sheet: [
          { time: '0-3s', visual: 'Expressão de alerta apontando para a câmera', speech: 'Pare de fazer isso agora mesmo.' },
          { time: '4-15s', visual: 'Exibindo a tela com o erro comum', speech: 'Quase todo mundo faz dessa forma e não entende por que não tem resultado.' },
          { time: '16-30s', visual: 'Mostrando o passo correto e simplificado', speech: 'Quando você muda para esse formato, o resultado vem em metade do tempo.' },
          { time: '31-45s', visual: 'Chamada para ação direta', speech: 'Comente VIRAL que eu te mando o checklist no direct.' },
        ],
        caption: 'O erro que está travando seus resultados no Instagram. Confira o passo a passo completo no vídeo.',
        cta: 'Comente VIRAL para receber o checklist no Direct.',
        virality_score: 95,
      },
    };
  }
}

/**
 * 7. AUDITORIA E OTIMIZAÇÃO DE PERFIL (/ig-profile)
 * Avalia o perfil, calcula uma nota de 0 a 100 e gera melhorias de bio e posicionamento.
 */
export interface ProfileAuditResult {
  score: number;
  headline_evaluation: string;
  strengths: string[];
  improvements: string[];
  suggested_bio: string;
  suggested_name_field: string;
  cta_link_suggestion: string;
}

export async function auditInstagramProfile(params: {
  username: string;
  accountName: string;
  niche: string;
  targetAudience: string;
  currentBio?: string;
}): Promise<ProfileAuditResult> {
  const ai = await getGenAI();

  const prompt = `Você é o auditor sênior de perfis de Instagram da habilidade /ig-profile.
Avalie o perfil abaixo e gere um diagnóstico completo com pontuação de 0 a 100 e recomendações cirúrgicas para transformar visitantes em seguidores e clientes:

PERFIL:
- @: ${params.username}
- Nome: ${params.accountName}
- Nicho: ${params.niche}
- Público: ${params.targetAudience}
- Bio atual: ${params.currentBio || 'Não informada'}

Retorne EXCLUSIVAMENTE um JSON válido com esta estrutura:
{
  "score": 68,
  "headline_evaluation": "Diagnóstico em 1 linha",
  "strengths": ["Ponto forte 1", "Ponto forte 2"],
  "improvements": ["Melhoria 1", "Melhoria 2"],
  "suggested_bio": "Linha 1: Quem ajuda e o que resolve\\nLinha 2: Prova social ou diferencial\\nLinha 3: Chamada para ação com seta 👇",
  "suggested_name_field": "${params.accountName} | ${params.niche}",
  "cta_link_suggestion": "Chamada irresistível para o link na bio"
}`;

  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.5,
    },
  });

  const raw = response.text || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {
      score: 74,
      headline_evaluation: 'Perfil com bom posicionamento básico, necessitando de CTA mais forte na Bio.',
      strengths: ['Nicho bem definido', 'Proposta de valor compreensível'],
      improvements: ['Inserir palavra-chave do nicho no campo Nome', 'Criar CTA mais direto para o Direct/WhatsApp'],
      suggested_bio: 'Transformamos seu negócio com atendimento inteligente 24/7.\\nMais de 1.000 atendimentos diários automatizados.\\nClique abaixo e teste grátis 👇',
      suggested_name_field: `${params.accountName} | ${params.niche}`,
      cta_link_suggestion: 'Fale com nosso robô no WhatsApp agora 👇',
    };
  }
}

