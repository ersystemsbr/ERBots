import { getServiceSupabase } from '@/lib/supabase';
import { GoogleGenAI } from '@google/genai';

export interface GoogleBusinessConfig {
  is_active: boolean;
  place_id: string;
  maps_review_url: string;
  auto_reply_5_star: boolean;
  alert_owner_low_rating: boolean;
  custom_thank_you_template?: string;
}

export const DEFAULT_GOOGLE_BUSINESS_CONFIG: GoogleBusinessConfig = {
  is_active: false,
  place_id: '',
  maps_review_url: '',
  auto_reply_5_star: true,
  alert_owner_low_rating: true,
};

export async function getGoogleBusinessConfig(tenantId: string): Promise<GoogleBusinessConfig> {
  const supabase = getServiceSupabase();
  try {
    const key = `integration_google_business_${tenantId}`;
    const { data } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      return { ...DEFAULT_GOOGLE_BUSINESS_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('[getGoogleBusinessConfig] Erro ao carregar config:', err);
  }
  return DEFAULT_GOOGLE_BUSINESS_CONFIG;
}

export async function saveGoogleBusinessConfig(
  tenantId: string,
  settings: Partial<GoogleBusinessConfig>
): Promise<boolean> {
  const supabase = getServiceSupabase();
  try {
    const current = await getGoogleBusinessConfig(tenantId);
    const updated = { ...current, ...settings };
    const key = `integration_google_business_${tenantId}`;

    await supabase.from('xerb_system_config').upsert(
      {
        key,
        value: JSON.stringify(updated),
        description: `Configurações do Google Meu Negócio para o tenant ${tenantId}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    return true;
  } catch (err) {
    console.error('[saveGoogleBusinessConfig] Erro ao salvar:', err);
    return false;
  }
}

/**
 * Gera uma resposta humanizada com IA para uma avaliação no Google Maps
 */
export async function generateGoogleReviewReply(
  restaurantName: string,
  review: {
    author: string;
    rating: number;
    comment?: string;
  }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return `Olá, ${review.author}! Muito obrigado pela sua avaliação e preferência no ${restaurantName}. Esperamos te ver de novo em breve!`;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Você é o gerente simpático e profissional do restaurante "${restaurantName}".
Responda a esta avaliação recebida no Google Maps de forma humanizada, calorosa e concisa (máximo 2 a 3 frases).

Nome do cliente: ${review.author}
Nota dada: ${review.rating} de 5 estrelas
Comentário do cliente: "${review.comment || 'Sem comentário, apenas estrelas'}"

Diretrizes:
- Se a nota for 4 ou 5 estrelas: Agradeça efusivamente, mencione o carinho da equipe em servir bem e convide para voltar.
- Se a nota for 1, 2 ou 3 estrelas: Peça desculpas sinceras, mostre que a opinião é crucial para a evolução da casa e convide o cliente a conversar no WhatsApp para solucionar qualquer detalhe.
- Nunca use placeholders nem markdown com negrito asteriscos, pois a resposta vai direto para o Google Maps.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || `Muito obrigado pela avaliação, ${review.author}!`;
  } catch (err) {
    console.warn('[generateGoogleReviewReply] Fallback devido a erro na IA:', err);
    return `Olá, ${review.author}! Muito obrigado pela sua avaliação e carinho com o ${restaurantName}!`;
  }
}
