import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getServiceSupabase } from '@/lib/supabase';
import {
  ANNUAL_BILLING_PERIOD_DAYS,
  BILLING_PERIOD_DAYS,
  computeAnnualPricing,
  isPaidPlan,
  type BillingInterval,
  type CommercialAddons,
  type PaidPlanId,
  type PlanDefinition,
  type PlanId,
} from '@/lib/plans';
import { getAddonsConfig, getPlansConfig } from '@/lib/billing/plans-config';
import { cancelSubscription } from '@/lib/billing/asaas';
import { addExtraCredits } from '@/lib/billing/usage';

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

type ParsedRef =
  | {
      kind: 'topup';
      tenantId: string;
      topupReplies: number;
      expectedPrice: number;
    }
  | {
      kind: 'subscription';
      tenantId: string | null;
      planId: PaidPlanId | null;
      interval: BillingInterval | null;
    };

function parseExternalRef(raw?: string | null): ParsedRef {
  if (!raw) return { kind: 'subscription', tenantId: null, planId: null, interval: null };
  const trimmed = String(raw).trim();

  const topupMatch = /^erbots_topup:([0-9a-f-]{36}):(\d+)(?::([0-9.]+))?$/i.exec(trimmed);
  if (topupMatch) {
    return {
      kind: 'topup',
      tenantId: topupMatch[1],
      topupReplies: Math.max(0, Number(topupMatch[2]) || 0),
      expectedPrice: Number(topupMatch[3]) || 0,
    };
  }

  const subMatch = /^erbots:([0-9a-f-]{36}):([a-z0-9_-]+)(?::(monthly|yearly))?$/i.exec(trimmed);
  if (subMatch) {
    const p = subMatch[2].toLowerCase();
    const rawInt = subMatch[3]?.toLowerCase();
    return {
      kind: 'subscription',
      tenantId: subMatch[1],
      planId: isPaidPlan(p) ? p : null,
      interval: rawInt === 'yearly' ? 'yearly' : rawInt === 'monthly' ? 'monthly' : null,
    };
  }

  if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
    return { kind: 'subscription', tenantId: trimmed, planId: null, interval: null };
  }

  return { kind: 'subscription', tenantId: null, planId: null, interval: null };
}

/**
 * Determina o plano e o ciclo (mensal/anual) pagos com proteção contra divergência de valor.
 */
function resolveVerifiedPlan(args: {
  tenant: any;
  plans: Record<PlanId, PlanDefinition>;
  addons: CommercialAddons;
  subId?: string | null;
  refPlan?: PaidPlanId | null;
  refInterval?: BillingInterval | null;
  paidValue?: number;
}): { plan: PaidPlanId; interval: BillingInterval } | null {
  const { tenant, plans, addons, subId, refPlan, refInterval, paidValue } = args;
  const amount = Number(paidValue) || 0;
  const paidPlans = (Object.values(plans) as PlanDefinition[]).filter((p) => isPaidPlan(p.id) && p.price > 0);

  let candidate: PaidPlanId | null = refPlan || null;
  let interval: BillingInterval =
    refInterval ||
    (subId && tenant.pending_subscription_id === subId && tenant.pending_interval === 'yearly'
      ? 'yearly'
      : subId && tenant.billing_subscription_id === subId && tenant.billing_interval === 'yearly'
      ? 'yearly'
      : 'monthly');

  if (!candidate && subId && tenant.pending_subscription_id === subId && isPaidPlan(tenant.pending_plan)) {
    candidate = tenant.pending_plan;
  }
  if (!candidate && subId && tenant.billing_subscription_id === subId && isPaidPlan(tenant.billing_plan)) {
    candidate = tenant.billing_plan;
  }

  const expectedFor = (pid: PaidPlanId, intv: BillingInterval) =>
    intv === 'yearly'
      ? computeAnnualPricing(plans[pid].price, addons.annualDiscountPercent).yearlyTotal
      : plans[pid].price;

  if (candidate && amount > 0) {
    const expected = expectedFor(candidate, interval);
    if (expected > 0 && amount >= expected * 0.9) {
      // Também detecta automaticamente caso tenha pago o valor anual sem o sufixo
      const yearlyExpected = expectedFor(candidate, 'yearly');
      if (interval === 'monthly' && yearlyExpected > plans[candidate].price * 3 && Math.abs(amount - yearlyExpected) < 0.5) {
        return { plan: candidate, interval: 'yearly' };
      }
      return { plan: candidate, interval };
    }

    // Valor pago diverge do esperado: tenta casar pelo valor exato cobrado (mensal ou anual)
    for (const p of paidPlans) {
      if (!isPaidPlan(p.id)) continue;
      const yPrice = expectedFor(p.id, 'yearly');
      if (Math.abs(yPrice - amount) < 0.25) return { plan: p.id, interval: 'yearly' };
      if (Math.abs(p.price - amount) < 0.25) return { plan: p.id, interval: 'monthly' };
    }
    return null;
  }

  if (amount > 0) {
    for (const p of paidPlans) {
      if (!isPaidPlan(p.id)) continue;
      const yPrice = expectedFor(p.id, 'yearly');
      if (Math.abs(yPrice - amount) < 0.25) return { plan: p.id, interval: 'yearly' };
      if (Math.abs(p.price - amount) < 0.25) return { plan: p.id, interval: 'monthly' };
    }
  }

  if (candidate) return { plan: candidate, interval };
  if (isPaidPlan(tenant.billing_plan)) return { plan: tenant.billing_plan, interval };
  return isPaidPlan(tenant.plan) ? { plan: tenant.plan, interval } : null;
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
    const parsedRef = parseExternalRef(extRefRaw);
    const refTenantId = parsedRef.tenantId;

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

    // 2.5 Fluxo dedicado: Pacote Avulso de Respostas Extras de IA (erbots_topup:...)
    if (parsedRef.kind === 'topup') {
      if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
        const paidAmount = Number(payment?.value) || 0;
        if (parsedRef.expectedPrice > 0 && paidAmount < parsedRef.expectedPrice * 0.9) {
          console.error('[Asaas Webhook] Valor divergente em pacote avulso:', payment?.id);
          return NextResponse.json({ received: true, error: 'topup_amount_mismatch' });
        }

        if (!parsedRef.topupReplies || !payment?.id) {
          return NextResponse.json({ received: true, error: 'invalid_topup_payload' });
        }

        let alreadyProcessed = false;
        const { error: payErr } = await supabase.from('xerb_payments').insert({
          tenant_id: tenant.id,
          amount: paidAmount || parsedRef.expectedPrice,
          plan: 'extra_pack',
          payment_method: mapMethod(payment?.billingType),
          status: 'confirmed',
          gateway_id: payment.id,
          paid_at: nowIso,
          expires_at: null,
          notes: `extra_credits:${parsedRef.topupReplies}`,
          invoice_url: payment?.invoiceUrl || null,
          billing_type: payment?.billingType || null,
        });

        if (payErr) {
          if ((payErr as any).code === '23505') {
            alreadyProcessed = true;
          } else {
            throw payErr;
          }
        }

        if (!alreadyProcessed) {
          await addExtraCredits(supabase, tenant.id, parsedRef.topupReplies);
          await supabase
            .from('xerb_tenants')
            .update({ quota_alert_period: null, updated_at: nowIso })
            .eq('id', tenant.id);
        }

        return NextResponse.json({
          received: true,
          topupCredited: !alreadyProcessed,
          creditsAdded: alreadyProcessed ? 0 : parsedRef.topupReplies,
        });
      }

      if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_CHARGEBACK_REQUESTED') {
        if (payment?.id) {
          await supabase.from('xerb_payments').update({ status: 'refunded' }).eq('gateway_id', payment.id);
        }
        if (parsedRef.topupReplies > 0) {
          await addExtraCredits(supabase, tenant.id, -parsedRef.topupReplies);
        }
        return NextResponse.json({ received: true, topupRefunded: true });
      }

      // Cobranças avulsas vencidas (PAYMENT_OVERDUE) não afetam a assinatura recorrente
      return NextResponse.json({ received: true, topupIgnored: event });
    }

    // 3. Pagamento confirmado/recebido de assinatura (Mensal ou Anual)
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const [plansCfg, addonsCfg] = await Promise.all([getPlansConfig(), getAddonsConfig()]);
      const verified = resolveVerifiedPlan({
        tenant,
        plans: plansCfg,
        addons: addonsCfg,
        subId,
        refPlan: parsedRef.planId,
        refInterval: parsedRef.interval,
        paidValue: payment?.value,
      });

      if (!verified) {
        console.error('[Asaas Webhook] Não foi possível validar plano/valor do pagamento', payment?.id);
        return NextResponse.json({ received: true, error: 'plan_unresolved_or_amount_mismatch' });
      }

      const { plan, interval } = verified;
      const periodDays = interval === 'yearly' ? ANNUAL_BILLING_PERIOD_DAYS : BILLING_PERIOD_DAYS;

      const isUpgradeSwap = Boolean(
        subId && tenant.billing_subscription_id && tenant.billing_subscription_id !== subId
      );
      const oldSubToCancel = isUpgradeSwap ? tenant.billing_subscription_id : null;

      const currentUntil = tenant.trial_ends_at ? new Date(tenant.trial_ends_at).getTime() : 0;
      const isSamePlanRenewal =
        !isUpgradeSwap &&
        tenant.plan === plan &&
        (tenant.billing_interval || 'monthly') === interval &&
        tenant.subscription_status === 'active' &&
        currentUntil > Date.now();
      const base = isSamePlanRenewal ? currentUntil : Date.now();
      const expiresAt = new Date(base + periodDays * DAY_MS).toISOString();

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
        notes: `Asaas ${event} (${interval})`,
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
          billing_interval: interval,
          subscription_status: 'active',
          trial_ends_at: expiresAt,
          pending_subscription_id: null,
          pending_plan: null,
          pending_interval: null,
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

      return NextResponse.json({ received: true, activated: !alreadyProcessed, plan, interval });
    }

    // 4. Cobrança vencida → apenas afeta se for da assinatura principal vigente (não de cobrança avulsa/checkout abandonado)
    if (event === 'PAYMENT_OVERDUE') {
      if (
        subId &&
        tenant.subscription_status === 'active' &&
        (!tenant.billing_subscription_id || subId === tenant.billing_subscription_id)
      ) {
        await supabase
          .from('xerb_tenants')
          .update({ subscription_status: 'past_due', updated_at: nowIso })
          .eq('id', tenant.id);
      }
      return NextResponse.json({ received: true });
    }

    // 5. Estorno / chargeback → verifica se foi pacote avulso antes de cancelar assinatura principal
    if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_CHARGEBACK_REQUESTED') {
      if (payment?.id) {
        const { data: existingPay } = await supabase
          .from('xerb_payments')
          .select('id, plan, notes')
          .eq('gateway_id', payment.id)
          .maybeSingle();

        await supabase.from('xerb_payments').update({ status: 'refunded' }).eq('gateway_id', payment.id);

        if (existingPay?.plan === 'extra_pack') {
          const m = /extra_credits:(\d+)/.exec(existingPay.notes || '');
          const credits = m ? Number(m[1]) || 0 : 0;
          if (credits > 0) await addExtraCredits(supabase, tenant.id, -credits);
          return NextResponse.json({ received: true, topupRefunded: true });
        }
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
            pending_interval: null,
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
