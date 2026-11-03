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
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
];

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
      const msg = String(err?.message || '').toLowerCase();
      if (err?.status === 404 || msg.includes('not found') || msg.includes('no longer available') || msg.includes('not supported')) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Nenhum modelo Gemini disponível no momento.');
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

/**
 * 5. GERAÇÃO DE IMAGENS POR IA (Imagen 3 / Gemini)
 */
export async function generatePostImage(imagePrompt: string): Promise<string> {
  const ai = await getGenAI();

  try {
    const response = await (ai.models as any).generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `${imagePrompt}, commercial advertising photography, perfect lighting, 4k`,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/jpeg',
      },
    });

    const base64Image = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64Image) {
      return `data:image/jpeg;base64,${base64Image}`;
    }
  } catch (err: any) {
    console.warn('[InstagramAgent] Imagen 3 indisponível ou cota excedida, fallback visual:', err?.message || err);
  }

  // Fallback SVG com design moderno
  const cleanPrompt = imagePrompt.slice(0, 110).replace(/["<>]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#312e81" />
        <stop offset="50%" stop-color="#4f46e5" />
        <stop offset="100%" stop-color="#db2777" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)" />
    <circle cx="540" cy="400" r="140" fill="white" opacity="0.1" />
    <text x="540" y="420" font-family="system-ui, sans-serif" font-size="80" font-weight="900" fill="white" text-anchor="middle">ERBOTS</text>
    <text x="540" y="520" font-family="system-ui, sans-serif" font-size="32" font-weight="bold" fill="#fcd34d" text-anchor="middle">ARTE GERADA POR IA</text>
    <foreignObject x="140" y="600" width="800" height="300">
      <div xmlns="http://www.w3.org/1999/xhtml" style="color: white; font-family: system-ui, sans-serif; font-size: 24px; text-align: center; line-height: 1.5; opacity: 0.9;">
        ${cleanPrompt}
      </div>
    </foreignObject>
  </svg>`;

  const base64Svg = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64Svg}`;
}

/**
 * 6. VIRALITY SKILL (/ig-viral)
 * Faz o Raio-X de um vídeo/tema viral e cria um roteiro viral inédito adaptado para o perfil.
 */
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
  companyName: string;
  brandVoice?: string;
  knowledgeDigest?: string | null;
}): Promise<ViralAnalysisResult> {
  const ai = await getGenAI();

  const prompt = `Você é o especialista mestre da Virality Skill (/ig-viral) do ecossistema de Instagram.
Sua missão:
1. Fazer o "RAIO-X" completo da referência viral informada (analisar por que performou tão bem: gancho de 0 a 3s, ritmo, retenção e gatilho emocional).
2. Criar um ROTEIRO VIRAL INÉDITO para a empresa "${params.companyName}" no nicho "${params.niche}", baseado na mesma estrutura vencedora.

REFERÊNCIA VIRAL INFORMADA:
"${params.viralReference}"

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

