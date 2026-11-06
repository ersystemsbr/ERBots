import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import {
  mapAnotaAiStatus,
  generateAnotaAiWhatsAppMessage,
  getAnotaAiIntegration,
} from '@/lib/integrations/anota-ai';
import { scheduleOrderNps } from '@/lib/reengagement';
import { sendTextMessage } from '@/lib/evolution';

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

    const orderId = body.order_id || body.orderId || body.id || body.order?.id;
    const displayId = String(body.display_id || body.short_id || body.order?.short_id || orderId || '').slice(-4);
    const rawStatus = body.status || body.event || body.order?.status || '';
    const customerPhone = body.customer?.phone || body.phone || body.order?.customer?.phone || '';
    const customerName = body.customer?.name || body.name || body.order?.customer?.name || 'Cliente';

    const { status, label, emoji } = mapAnotaAiStatus(rawStatus);

    const supabase = getServiceSupabase();

    // 1. Atualiza registro se existir no banco
    if (orderId || displayId) {
      try {
        let query = supabase.from('xerb_pos_orders').update({
          status,
          updated_at: new Date().toISOString(),
        });
        if (orderId) query = query.eq('external_order_id', orderId);
        else if (displayId) query = query.eq('display_id', displayId);
        await query.eq('tenant_id', tenantId);
      } catch (e) {
        console.warn('[Webhook Anota AI] Update ignorado:', e);
      }
    }

    // 2. Notificação no WhatsApp do Cliente
    const anotaConfig = await getAnotaAiIntegration(tenantId);
    let notifiedWhatsApp = false;

    if (anotaConfig.is_active && anotaConfig.settings.notify_customer_whatsapp && customerPhone) {
      const { data: inst } = await supabase
        .from('xerb_instances')
        .select('instance_name, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'CONNECTED')
        .maybeSingle();

      if (inst?.instance_name) {
        const msg = generateAnotaAiWhatsAppMessage(status, customerName, displayId);
        notifiedWhatsApp = await sendTextMessage(inst.instance_name, customerPhone, msg).catch(() => false);
      }
    }

    // 3. Se entregue, dispara agendamento de NPS
    if (status === 'DELIVERED' && customerPhone) {
      scheduleOrderNps(tenantId, {
        displayId: displayId || orderId || 'Recente',
        customerName,
        customerPhone,
      }).catch((err) => console.warn('[Webhook Anota AI] Erro ao agendar NPS:', err));
    }

    return NextResponse.json({
      success: true,
      received: true,
      order: {
        orderId,
        displayId,
        status,
        label,
        emoji,
      },
      notifiedWhatsApp,
    });
  } catch (err: any) {
    console.error('[Webhook Anota AI Error]', err);
    return NextResponse.json({ error: 'Erro ao processar webhook do Anota AI.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'ERBots Anota AI Webhook Listener',
    version: '1.0.0',
  });
}
