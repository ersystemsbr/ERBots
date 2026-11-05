import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import {
  mapSaiposStatus,
  generateStatusWhatsAppMessage,
  sendOrderStatusWhatsAppNotification,
  getTenantIntegration,
} from '@/lib/integrations/saipos';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenant_id');

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
    }

    const tenantId = tenantIdParam || body.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Parâmetro tenant_id obrigatório.' }, { status: 400 });
    }

    // Extrai dados da notificação do webhook da Saipos
    const externalOrderId = body.order_id || body.external_id || body.id || body.order?.id;
    const displayId = String(body.display_id || body.order?.display_id || body.short_id || '');
    const rawStatus = body.status || body.event || body.order_status || body.order?.status || '';
    const customerPhone = body.customer?.phone || body.phone || body.order?.customer?.phone || '';
    const customerName = body.customer?.name || body.name || body.order?.customer?.name || 'Cliente';
    const reason = body.reason || body.cancel_reason || body.cancellation_reason || '';

    const { status, label, emoji } = mapSaiposStatus(rawStatus);

    const supabase = getServiceSupabase();

    // 1. Atualiza registro do pedido se encontrado no banco
    if (externalOrderId || displayId) {
      try {
        let query = supabase.from('xerb_pos_orders').update({
          status,
          updated_at: new Date().toISOString(),
        });

        if (externalOrderId) {
          query = query.eq('external_order_id', externalOrderId);
        } else if (displayId) {
          query = query.eq('display_id', displayId);
        }
        await query.eq('tenant_id', tenantId);
      } catch (e) {
        console.warn('[Webhook Saipos] Tabela xerb_pos_orders update ignorado:', e);
      }
    }

    // 2. Verifica se o tenant ativou as notificações para o cliente no WhatsApp
    const saiposConfig = await getTenantIntegration(tenantId, 'saipos');
    const shouldNotify = saiposConfig.is_active && saiposConfig.settings?.notify_customer_whatsapp !== false;

    let notifiedWhatsApp = false;
    if (shouldNotify && customerPhone) {
      const message = generateStatusWhatsAppMessage(status, customerName, displayId, { reason });
      notifiedWhatsApp = await sendOrderStatusWhatsAppNotification(tenantId, customerPhone, message);
    }

    return NextResponse.json({
      success: true,
      received: true,
      order: {
        externalOrderId,
        displayId,
        status,
        label,
        emoji,
      },
      notifiedWhatsApp,
    });
  } catch (err: any) {
    console.error('[Webhook Saipos Error]', err);
    return NextResponse.json({ error: 'Erro ao processar webhook da Saipos.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'online',
    service: 'ERBots Saipos Webhook Listener',
    version: '1.0.0',
    documentation: 'Configure esta URL no Painel da Saipos em Webhooks / Notificações de Pedido',
  });
}
