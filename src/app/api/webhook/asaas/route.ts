import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getServiceSupabase } from '@/lib/supabase';
import { BILLING_PERIOD_DAYS, isPaidPlan, type PaidPlanId, type PlanDefinition, type PlanId } from '@/lib/plans';
import { getPlansConfig } from '@/lib/billing/plans-config';
import { cancelSubscription } from '@/lib/billing/asaas';

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

function parseExternalRef(raw?: string | null): { tenantId: string | null; planId: PaidPlanId | null } {
  if (!raw) return { tenantId: null, planId: null };
  const trimmed = String(raw).trim();
  const m = /^erbots:([0-9a-f-]{36}):([a-z0-9_-]+)$/i.exec(trimmed);
  if (m) {
    const p = m[2].toLowerCase();
    return { tenantId: m[1], planId: isPaidPlan(p) ? p : null };
  }
  if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
    return { tenantId: trimmed, planId: null };
  }
  return { tenantId: null, planId: null };
}

/**
 * Determina o plano pago com proteção contra divergência de valor (ex.: boleto antigo Start pago após iniciar Business).
 */
function resolveVerifiedPlan(args: {
  tenant: any;
  plans: Record<PlanId, PlanDefinition>;
  subId?: string | null;
  refPlan?: PaidPlanId | null;
  paidValue?: number;
}): PaidPlanId | null {
  const { tenant, plans, subId, refPlan, paidValue } = args;
  const amount = Number(paidValue) || 0;
  const paidPlans = (Object.values(plans) as PlanDefinition[]).filter((p) => isPaidPlan(p.id) && p.price > 0);

  let candidate: PaidPlanId | null = refPlan || null;
  if (!candidate && subId && tenant.pending_subscription_id === subId && isPaidPlan(tenant.pending_plan)) {
    candidate = tenant.pending_plan;
  }
  if (!candidate && subId && tenant.billing_subscription_id === subId && isPaidPlan(tenant.billing_plan)) {
    candidate = tenant.billing_plan;
  }

  // Se sabemos o valor efetivamente pago, confere se é compatível com o plano candidato
  if (candidate && amount > 0) {
    const expected = plans[candidate]?.price || 0;
    if (expected > 0 && amount < expected * 0.9) {
      // Valor pago é menor que o plano candidato: mapeia pelo valor real cobrado
      const exactMatch = paidPlans.find((p) => Math.abs(p.price - amount) < 0.05);
      if (exactMatch && isPaidPlan(exactMatch.id)) return exactMatch.id;
      return null;
    }
    return candidate;
  }

  if (amount > 0) {
    const byValue = paidPlans.find((p) => Math.abs(p.price - amount) < 0.05);
    if (byValue && isPaidPlan(byValue.id)) return byValue.id;
  }

  if (candidate) return candidate;
  if (isPaidPlan(tenant.billing_plan)) return tenant.billing_plan;
  return isPaidPlan(tenant.plan) ? tenant.plan : null;
}

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

    // 1. Localiza o tenant (por assinatura ativa/pendente, externalReference ou cliente)
    const subId = payment?.subscription || subscription?.id || null;
    const customerId = payment?.customer || subscription?.customer || null;
    const extRefRaw = payment?.externalReference || subscription?.externalReference || null;
    const { tenantId: refTenantId, planId: refPlan } = parseExternalRef(extRefRaw);

    let tenant: any = null;
    if (subId) {
      const { data } = await supabase
        .from('xerb_tenants')
        .select('*')
        .or(`billing_subscription_id.eq.${subId},pending_subscription_id.eq.${subId}`)
        .limit(1)
        .maybeSingle();
      tenant = data;
    }
    if (!tenant && refTenantId) {
      const { data } = await supabase.from('xerb_tenants').select('*').eq('id', refTenantId).maybeSingle();
      tenant = data;
    }
    if (!tenant && customerId) {
      const { data } = await supabase
        .from('xerb_tenants')
        .select('*')
        .eq('billing_customer_id', customerId)
        .maybeSingle();
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

    // 3. Pagamento confirmado/recebido → ativa plano verificado e substitui assinatura antiga (se houve upgrade)
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const plansCfg = await getPlansConfig();
      const plan = resolveVerifiedPlan({
        tenant,
        plans: plansCfg,
        subId,
        refPlan,
        paidValue: payment?.value,
      });

      if (!plan) {
        console.error('[Asaas Webhook] Não foi possível validar plano/valor do pagamento', payment?.id);
        return NextResponse.json({ received: true, error: 'plan_unresolved_or_amount_mismatch' });
      }

      const isUpgradeSwap = Boolean(
        subId && tenant.billing_subscription_id && tenant.billing_subscription_id !== subId
      );
      const oldSubToCancel = isUpgradeSwap ? tenant.billing_subscription_id : null;

      // Na troca de plano começa ciclo novo de 31 dias a partir de agora; na renovação do mesmo plano soma ao vencimento
      const currentUntil = tenant.trial_ends_at ? new Date(tenant.trial_ends_at).getTime() : 0;
      const isSamePlanRenewal =
        !isUpgradeSwap && tenant.plan === plan && tenant.subscription_status === 'active' && currentUntil > Date.now();
      const base = isSamePlanRenewal ? currentUntil : Date.now();
      const expiresAt = new Date(base + BILLING_PERIOD_DAYS * DAY_MS).toISOString();

      let alreadyProcessed = false;
      const { error: payErr } = await supabase.from('xerb_payments').insert({
        tenant_id: tenant.id,
        amount: Number(payment?.value) || plansCfg[plan].price,
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
        const tenantUpdate: Record<string, any> = {
          plan,
          billing_plan: plan,
          subscription_status: 'active',
          trial_ends_at: expiresAt,
          pending_subscription_id: null,
          pending_plan: null,
          pending_invoice_url: null,
          updated_at: nowIso,
        };
        if (subId) {
          tenantUpdate.billing_subscription_id = subId;
        }

        const { error: updErr } = await supabase.from('xerb_tenants').update(tenantUpdate).eq('id', tenant.id);
        if (updErr) throw updErr;

        // Cancela a assinatura anterior SOMENTE depois que o novo plano já foi pago e gravado!
        if (oldSubToCancel) {
          await cancelSubscription(oldSubToCancel).catch((e) =>
            console.warn('[Asaas Webhook] Falha ao cancelar assinatura anterior substituída:', e)
          );
        }
      }

      return NextResponse.json({ received: true, activated: !alreadyProcessed, plan });
    }

    // 4. Cobrança vencida → apenas afeta se for da assinatura principal vigente (não de um checkout abandonado)
    if (event === 'PAYMENT_OVERDUE') {
      if (
        tenant.subscription_status === 'active' &&
        (!subId || !tenant.billing_subscription_id || subId === tenant.billing_subscription_id)
      ) {
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

    // 6. Assinatura removida/inativada → ignora se for assinatura antiga substituída em upgrade
    if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
      if (subscription?.id && tenant.billing_subscription_id === subscription.id) {
        await supabase
          .from('xerb_tenants')
          .update({ subscription_status: 'canceled', billing_subscription_id: null, updated_at: nowIso })
          .eq('id', tenant.id);
      } else if (subscription?.id && tenant.pending_subscription_id === subscription.id) {
        await supabase
          .from('xerb_tenants')
          .update({
            pending_subscription_id: null,
            pending_plan: null,
            pending_invoice_url: null,
            updated_at: nowIso,
          })
          .eq('id', tenant.id);
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, ignored: event });
  } catch (err: any) {
    console.error('[Asaas Webhook] Erro:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
