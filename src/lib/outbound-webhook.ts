import { getServiceSupabase } from './supabase';

export interface OutboundEventPayload {
  event: 'message.received' | 'message.sent' | 'lead.captured' | 'human_handoff.requested';
  timestamp: string;
  tenantId: string;
  tenantSlug: string;
  data: {
    contactPhone: string;
    contactName?: string | null;
    messageContent?: string;
    direction?: 'in' | 'out';
    sender?: 'user' | 'ai' | 'human';
    leadData?: {
      interest?: string;
      preferredSlot?: string;
      notes?: string;
    };
    raw?: any;
  };
}

/**
 * Dispara evento via Webhook para sistemas externos (CRM, GastroSys) de forma assíncrona.
 * Nunca bloqueia nem atrasa a resposta da IA ou o recebimento do WhatsApp.
 */
export async function dispatchOutboundWebhook(
  tenantId: string,
  event: OutboundEventPayload['event'],
  eventData: OutboundEventPayload['data']
): Promise<void> {
  try {
    const supabase = getServiceSupabase();

    // 1. Busca configurações de webhook do tenant
    const { data: tenant } = await supabase
      .from('xerb_tenants')
      .select('slug, webhook_url, webhook_secret')
      .eq('id', tenantId)
      .maybeSingle();

    if (!tenant?.webhook_url) {
      return; // Tenant não configurou webhook externo
    }

    const targetUrl = tenant.webhook_url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return;
    }

    const payload: OutboundEventPayload = {
      event,
      timestamp: new Date().toISOString(),
      tenantId,
      tenantSlug: tenant.slug,
      data: eventData,
    };

    // Disparo assíncrono com timeout curto (5s)
    fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ERBots-Outbound-Webhook/1.0',
        'x-erbots-event': event,
        'x-erbots-tenant': tenant.slug,
        ...(tenant.webhook_secret ? { 'x-erbots-secret': tenant.webhook_secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }).catch((err) => {
      console.warn(`[Outbound Webhook] Falha ao entregar evento ${event} para ${targetUrl}:`, err?.message || err);
    });
  } catch (err: any) {
    console.warn('[Outbound Webhook] Erro ao preparar disparo:', err?.message || err);
  }
}
