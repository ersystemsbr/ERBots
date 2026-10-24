import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getServiceSupabase } from '@/lib/supabase';
import { BILLING_PERIOD_DAYS, PLANS, isPaidPlan, type PaidPlanId } from '@/lib/plans';

export const maxDuration = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function tokenValid(req: NextRequest): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get('asaas-access-token') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function mapMethod(billingType?: string): string {
  switch (billingType) {
    case 'PIX':
      return 'pix';
    case 'CREDIT_CARD':
      return 'credit_card';
    case 'BOLETO':
      return 'boleto';
    default:
      return 'transfer';
  }
}

/** Descobre o plano pago a partir do tenant (billing_plan) ou, na falta, pelo valor cobrado. */
function resolvePlan(tenant: any, value?: number): PaidPlanId | null {
  if (isPaidPlan(tenant.billing_plan)) return tenant.billing_plan;
  const byValue = (Object.values(PLANS) as any[]).find((p) => p.price > 0 && p.price === Number(value));
  if (byValue) return byValue.id;
  return isPaidPlan(tenant.plan) ? tenant.plan : null;
}

/**
 * Webhook do Asaas. Configure no painel do Asaas:
 *   URL:   https://SEU-DOMINIO/api/webhook/asaas
 *   Token de autenticação: o mesmo valor de ASAAS_WEBHOOK_TOKEN
 *   Eventos: PAYMENT_* e SUBSCRIPTION_*
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.ASAAS_WEBHOOK_TOKEN) {
      console.error('[Asaas Webhook] ASAAS_WEBHOOK_TOKEN não configurado.');
      return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 503 });
    }
    if (!tokenValid(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const event: string = payload.event || '';
    const payment = payload.payment || null;
    const subscription = payload.subscription || null;
    const eventId: string | undefined = payload.id;

    const supabase = getServiceSupabase();

    // 1. Localiza o tenant (por assinatura, cliente ou externalReference)
    const subId = payment?.subscription || subscription?.id || null;
    const customerId = payment?.customer || subscription?.customer || null;
    const extRef = payment?.externalReference || subscription?.externalReference || null;

    let tenant: any = null;
    if (subId) {
      const { data } = await supabase.from('xerb_tenants').select('*').eq('billing_subscription_id', subId).maybeSingle();
      tenant = data;
    }
    if (!tenant && customerId) {
      const { data } = await supabase.from('xerb_tenants').select('*').eq('billing_customer_id', customerId).maybeSingle();
      tenant = data;
    }
    if (!tenant && extRef && /^[0-9a-f-]{36}$/i.test(extRef)) {
      const { data } = await supabase.from('xerb_tenants').select('*').eq('id', extRef).maybeSingle();
      tenant = data;
    }

    // 2. Idempotência por id de evento (o Asaas pode reenviar)
    if (eventId) {
      const { error: evErr } = await supabase.from('xerb_billing_events').insert({
        id: eventId,
        event,
        tenant_id: tenant?.id || null,
        payload,
      });
      if (evErr && (evErr as any).code === '23505') {
        return NextResponse.json({ received: true, duplicate: true });
      }
      if (evErr) console.warn('[Asaas Webhook] Não foi possível registrar o evento:', evErr.message);
    }

    if (!tenant) {
      console.warn(`[Asaas Webhook] Evento ${event} sem tenant correspondente (sub=${subId}, cus=${customerId}).`);
      return NextResponse.json({ received: true, matched: false });
    }

    const nowIso = new Date().toISOString();

    // 3. Pagamento confirmado/recebido → ativa e estende o período
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const plan = resolvePlan(tenant, payment?.value);
      if (!plan) {
        console.error('[Asaas Webhook] Não foi possível determinar o plano do pagamento', payment?.id);
        return NextResponse.json({ received: true, error: 'plan_unresolved' });
      }

      const currentUntil = tenant.trial_ends_at ? new Date(tenant.trial_ends_at).getTime() : 0;
      const base = tenant.subscription_status === 'active' && currentUntil > Date.now() ? currentUntil : Date.now();
      const expiresAt = new Date(base + BILLING_PERIOD_DAYS * DAY_MS).toISOString();

      // Registra o pagamento (gateway_id único). Se já existir (CONFIRMED seguido de RECEIVED), não estende de novo.
      let alreadyProcessed = false;
      const { error: payErr } = await supabase.from('xerb_payments').insert({
        tenant_id: tenant.id,
        amount: Number(payment?.value) || PLANS[plan].price,
        plan,
        payment_method: mapMethod(payment?.billingType),
        status: 'confirmed',
        gateway_id: payment?.id || null,
        paid_at: nowIso,
        expires_at: expiresAt,
        notes: `Asaas ${event}`,
        invoice_url: payment?.invoiceUrl || null,
        billing_type: payment?.billingType || null,
      });

      if (payErr) {
        if ((payErr as any).code === '23505') {
          alreadyProcessed = true;
        } else {
          console.error('[Asaas Webhook] Erro ao registrar pagamento (seguindo com a ativação):', payErr.message);
        }
      }

      if (!alreadyProcessed) {
        const { error: updErr } = await supabase
          .from('xerb_tenants')
          .update({
            plan,
            subscription_status: 'active',
            trial_ends_at: expiresAt,
            updated_at: nowIso,
          })
          .eq('id', tenant.id);
        if (updErr) throw updErr;
      }

      return NextResponse.json({ received: true, activated: !alreadyProcessed });
    }

    // 4. Cobrança vencida → inadimplente (o robô tem alguns dias de tolerância antes de pausar)
    if (event === 'PAYMENT_OVERDUE') {
      if (tenant.subscription_status === 'active') {
        await supabase
          .from('xerb_tenants')
          .update({ subscription_status: 'past_due', updated_at: nowIso })
          .eq('id', tenant.id);
      }
      return NextResponse.json({ received: true });
    }

    // 5. Estorno / chargeback → bloqueia imediatamente
    if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_CHARGEBACK_REQUESTED') {
      if (payment?.id) {
        await supabase.from('xerb_payments').update({ status: 'refunded' }).eq('gateway_id', payment.id);
      }
      await supabase
        .from('xerb_tenants')
        .update({ subscription_status: 'canceled', trial_ends_at: nowIso, updated_at: nowIso })
        .eq('id', tenant.id);
      return NextResponse.json({ received: true });
    }

    // 6. Assinatura removida/inativada → cancela renovação (acesso até o fim do período pago)
    if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
      if (subscription?.id && tenant.billing_subscription_id === subscription.id) {
        await supabase
          .from('xerb_tenants')
          .update({ subscription_status: 'canceled', billing_subscription_id: null, updated_at: nowIso })
          .eq('id', tenant.id);
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, ignored: event });
  } catch (err: any) {
    console.error('[Asaas Webhook] Erro:', err);
    // 500 faz o Asaas reenviar o evento mais tarde
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
