import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './gemini';

/**
 * Motor de IA para o Agente de Instagram do ERBots.
 * Inclui:
 * 1. Síntese do Knowledge Digest (Economia de 90%+ de tokens)
 * 2. Criação de posts com ganchos virais e roteiro persuasivo
 * 3. Geração de imagens via Imagen 3 / Gemini
 */

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

export interface BrandKnowledgeInput {
  companyName: string;
  niche: string;
  targetAudience: string;
  brandVoice: string;
  visualStyle: string;
}

export interface GeneratedPostData {
  hook_title: string;
  caption: string;
  hashtags: string[];
  image_prompt: string;
  visual_notes: string;
}

/**
 * 1. MÉTODO DE ECONOMIA DE TOKENS: Knowledge Digest (Memória Sintética)
 * Transforma todas as informações da marca e tendências do nicho em um documento
 * ultracompacto (apenas ~400 tokens) que é consultado nas próximas gerações,
 * eliminando a necessidade de buscar dezenas de páginas da web a cada postagem.
 */
export async function generateKnowledgeDigest(input: BrandKnowledgeInput): Promise<string> {
  const ai = await getGenAI();

  const prompt = `Você é um estrategista de conteúdo sênior e arquiteto de IA.
Sua missão é criar um "Knowledge Digest" (Documento de Memória Sintética) para uma empresa que atuará com um Agente Autônomo de Instagram.

DADOS DA EMPRESA:
- Nome: ${input.companyName}
- Nicho: ${input.niche}
- Público-Alvo: ${input.targetAudience}
- Tom de Voz: ${input.brandVoice}
- Estilo Visual: ${input.visualStyle}

REQUISITOS DO DOCUMENTO CONDENSADO:
1. Deve ter entre 300 e 500 palavras, em Markdown limpo e objetivo.
2. Seja denso em valor e sem enrolação, para ser reutilizado como contexto de baixo custo de tokens.
3. Inclua:
   - [DNA & Posicionamento]: 2 frases sobre a promessa central da marca.
   - [Top 5 Ganchos Virais do Nicho]: 5 estruturas de títulos/primeiros 3 segundos validados para prender atenção.
   - [Gatilhos de Conversão]: O que faz esse público comentar e comprar.
   - [Diretrizes de Imagem]: Regras de composição, paleta e iluminação para a IA de imagem.
   - [Regras Inegociáveis]: Palavras a evitar e postura recomendada.

Retorne EXCLUSIVAMENTE o conteúdo em Markdown do Knowledge Digest, sem introduções ou saudações.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0.4,
    },
  });

  return response.text || '';
}

/**
 * 2. GERAÇÃO DE POST VIRAL
 * Consulta o Knowledge Digest e gera o gancho, a legenda completa e o prompt de imagem.
 */
export async function generateViralPost(params: {
  companyName: string;
  niche: string;
  knowledgeDigest?: string | null;
  topicHint?: string;
  visualStyle?: string;
}): Promise<GeneratedPostData> {
  const ai = await getGenAI();

  const digestContext = params.knowledgeDigest
    ? `\n### MEMÓRIA DE DIRETRIZES DA MARCA (KNOWLEDGE DIGEST):\n${params.knowledgeDigest}\n`
    : `\nNicho: ${params.niche}\n`;

  const prompt = `Você é o Agente de Social Media Autônomo do ERBots.
Sua tarefa é criar um post viral de altíssimo engajamento para o Instagram da empresa "${params.companyName}".
${digestContext}
${params.topicHint ? `TEMA ESPECÍFICO / FOCO DO DIA: "${params.topicHint}"` : 'TEMA: Escolha um tema de alto interesse e curiosidade para o nicho hoje.'}

REGRAS DA PUBLICAÇÃO:
1. Gancho (Hook): Título curto, impactante e instigante (máximo 1 linha).
2. Legenda (Caption):
   - Linha 1: Gancho forte (quebra de padrão).
   - Corpo: 3 a 4 parágrafos curtos, espaçados, com dicas práticas ou insights valiosos.
   - CTA (Chamada para Ação): Uma pergunta estimulando comentários ou chamada "Comente X para receber mais".
3. Hashtags: 8 a 12 hashtags relevantes, sem spam.
4. Image Prompt: Um prompt fotográfico ultra-detalhado EM INGLÊS para gerar a imagem na IA. Deve descrever iluminação profissional, ângulo de câmera, estilo realista e NÃO conter textos distorcidos na imagem.

FORMATO DE RESPOSTA (OBRIGATORIAMENTE JSON VÁLIDO):
{
  "hook_title": "string",
  "caption": "string com quebras de linha normais",
  "hashtags": ["#tag1", "#tag2"],
  "image_prompt": "detailed photo prompt in english...",
  "visual_notes": "breve explicação visual para o criador"
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
  });

  const rawText = response.text || '{}';
  try {
    const data = JSON.parse(rawText) as GeneratedPostData;
    return {
      hook_title: data.hook_title || 'Novidade Exclusiva para Você',
      caption: data.caption || 'Confira os detalhes no post!',
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : ['#novidade', `#${params.niche.replace(/\s+/g, '')}`],
      image_prompt: data.image_prompt || `Professional photography for ${params.niche}, studio lighting, high resolution, 8k`,
      visual_notes: data.visual_notes || 'Imagem promocional estilizada',
    };
  } catch (err) {
    console.error('[InstagramAgent] Erro ao parsear JSON de post:', rawText, err);
    throw new Error('Falha ao processar o post gerado pela IA.');
  }
}

/**
 * 3. GERAÇÃO DE IMAGENS POR IA (Imagen 3 / Gemini)
 * Gera imagem de alta resolução (1:1 quadrado para feed) e retorna Data URL em base64.
 */
export async function generatePostImage(imagePrompt: string): Promise<string> {
  const ai = await getGenAI();

  try {
    // Tenta gerar com o modelo de imagem oficial Imagen 3
    const response = await (ai.models as any).generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `${imagePrompt}, photorealistic, commercial advertising quality, perfect lighting, 4k`,
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
    console.warn('[InstagramAgent] Imagen 3 indisponível ou cota excedida, tentando fallback:', err?.message || err);
  }

  // Fallback: se a API de imagem específica não estiver disponível, gera uma imagem conceitual em SVG de alta qualidade
  const cleanPrompt = imagePrompt.slice(0, 100).replace(/["<>]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4f46e5" />
        <stop offset="50%" stop-color="#7c3aed" />
        <stop offset="100%" stop-color="#db2777" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)" />
    <circle cx="540" cy="400" r="140" fill="white" opacity="0.1" />
    <text x="540" y="420" font-family="system-ui, sans-serif" font-size="80" font-weight="900" fill="white" text-anchor="middle">ERBOTS</text>
    <text x="540" y="520" font-family="system-ui, sans-serif" font-size="32" font-weight="bold" fill="#fcd34d" text-anchor="middle">POST GERADO POR IA</text>
    <foreignObject x="140" y="600" width="800" height="300">
      <div xmlns="http://www.w3.org/1999/xhtml" style="color: white; font-family: system-ui, sans-serif; font-size: 24px; text-align: center; line-height: 1.5; opacity: 0.9;">
        ${cleanPrompt}
      </div>
    </foreignObject>
  </svg>`;

  const base64Svg = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64Svg}`;
}
