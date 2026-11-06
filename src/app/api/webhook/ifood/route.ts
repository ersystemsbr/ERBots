import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { mapIfoodEvent, getIfoodIntegration } from '@/lib/integrations/ifood';
import { scheduleOrderNps } from '@/lib/reengagement';

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

    const eventType = body.code || body.event || body.type || body.eventType || '';
    const orderId = body.orderId || body.order_id || body.id || '';
    const displayId = String(body.displayId || body.shortId || orderId).slice(-4);
    const customerPhone = body.customer?.phone || body.phone || '';
    const customerName = body.customer?.name || body.name || 'Cliente iFood';

    const { status, label, emoji } = mapIfoodEvent(eventType);

    // Se o pedido do iFood foi entregue, agenda pesquisa de satisfação no WhatsApp
    if (status === 'DELIVERED' && customerPhone) {
      scheduleOrderNps(tenantId, {
        displayId,
        customerName,
        customerPhone,
      }).catch((err) => console.warn('[iFood Webhook] Erro ao agendar NPS:', err));
    }

    return NextResponse.json({
      success: true,
      received: true,
      event: {
        orderId,
        displayId,
        status,
        label,
        emoji,
      },
    });
  } catch (err: any) {
    console.error('[Webhook iFood Error]', err);
    return NextResponse.json({ error: 'Erro ao processar webhook do iFood.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'ERBots iFood / Open Delivery Webhook Listener',
    version: '1.0.0',
  });
}
