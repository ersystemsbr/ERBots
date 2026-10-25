import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireTenantAccess } from '@/lib/auth';
import { isPaidPlan, isValidCpfCnpj, onlyDigits } from '@/lib/plans';
import { getPlansConfig } from '@/lib/billing/plans-config';
import {
  AsaasError,
  cancelSubscription,
  createSubscription,
  getLatestInvoiceUrl,
  isAsaasConfigured,
  upsertCustomer,
} from '@/lib/billing/asaas';

export const maxDuration = 60;

/**
 * Inicia a contratação ou troca de plano:
 * - Cria/atualiza o cliente no Asaas;
 * - NÃO cancela uma assinatura ativa antes da confirmação do novo pagamento (evita perder o plano se desistir no checkout);
 * - Grava `erbots:<tenantId>:<plan>` no `externalReference` para validação exata no webhook;
 * - Salva `pending_invoice_url` para abrir direto mesmo em navegadores mobile que bloqueiam pop-up.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, plan, cpf_cnpj } = body;

    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;

    if (!isPaidPlan(plan)) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    }
    if (!isAsaasConfigured()) {
      return NextResponse.json(
        { error: 'O pagamento online ainda não está disponível. Fale com o suporte para ativar sua assinatura.' },
        { status: 503 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: tenant, error: tenantErr } = await supabase
      .from('xerb_tenants')
      .select('*')
      .eq('id', guard.tenant.id)
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const doc = onlyDigits(String(cpf_cnpj || tenant.cpf_cnpj || ''));
    if (!isValidCpfCnpj(doc)) {
      return NextResponse.json({ error: 'Informe um CPF ou CNPJ válido para emitir a cobrança.' }, { status: 400 });
    }

    const hasActivePaidSub = Boolean(tenant.subscription_status === 'active' && tenant.billing_subscription_id);

    if (hasActivePaidSub && tenant.plan === plan) {
      return NextResponse.json({ error: 'Você já possui este plano ativo.' }, { status: 409 });
    }

    // 1. Cliente no gateway
    const customerId = await upsertCustomer(tenant.billing_customer_id, {
      name: tenant.name,
      email: tenant.email,
      cpfCnpj: doc,
      mobilePhone: tenant.phone ? onlyDigits(tenant.phone) : null,
      externalReference: tenant.id,
    });

    // 2. Limpa apenas checkout pendente anterior não pago (preserva assinatura ativa atual!)
    if (tenant.pending_subscription_id && tenant.pending_subscription_id !== tenant.billing_subscription_id) {
      await cancelSubscription(tenant.pending_subscription_id).catch(() => {});
    }
    if (!hasActivePaidSub && tenant.billing_subscription_id) {
      await cancelSubscription(tenant.billing_subscription_id).catch(() => {});
    }

    // 3. Nova assinatura com referência explícita do plano contratado
    const def = (await getPlansConfig())[plan];
    const subscription = await createSubscription({
      customerId,
      value: def.price,
      description: `ERBots - Plano ${def.name} (mensal)`,
      externalReference: `erbots:${tenant.id}:${plan}`,
    });

    // Aguarda a primeira cobrança ser gerada para obter o link da fatura
    let invoiceUrl: string | null = null;
    for (let i = 0; i < 4 && !invoiceUrl; i++) {
      invoiceUrl = await getLatestInvoiceUrl(subscription.id);
      if (!invoiceUrl) await new Promise((r) => setTimeout(r, 800));
    }

    // Se já tem assinatura ativa, mantém billing_subscription_id intacto e guarda a nova em pending_*
    const updateData: Record<string, any> = {
      cpf_cnpj: doc,
      billing_customer_id: customerId,
      pending_subscription_id: subscription.id,
      pending_plan: plan,
      pending_invoice_url: invoiceUrl,
      updated_at: new Date().toISOString(),
    };

    if (!hasActivePaidSub) {
      updateData.billing_subscription_id = subscription.id;
      updateData.billing_plan = plan;
    }

    const { error: updErr } = await supabase
      .from('xerb_tenants')
      .update(updateData)
      .eq('id', tenant.id);

    if (updErr) {
      console.error('[Billing Checkout] Erro ao salvar dados de cobrança:', updErr);
      return NextResponse.json(
        { error: 'Assinatura criada, mas houve falha ao registrar. Contate o suporte antes de pagar.' },
        { status: 500 }
      );
    }

    if (!invoiceUrl) {
      return NextResponse.json(
        { error: 'Assinatura criada, mas o link de pagamento ainda não ficou pronto. Tente novamente em instantes.' },
        { status: 202 }
      );
    }

    return NextResponse.json({ success: true, invoiceUrl, plan });
  } catch (err: any) {
    if (err instanceof AsaasError) {
      console.error('[Billing Checkout] Asaas:', err.message);
      return NextResponse.json({ error: err.message }, { status: err.status >= 500 ? 502 : 400 });
    }
    console.error('[Billing Checkout] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao iniciar o pagamento.' }, { status: 500 });
  }
}
