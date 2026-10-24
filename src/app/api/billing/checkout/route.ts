import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireTenantAccess } from '@/lib/auth';
import { PLANS, isPaidPlan, isValidCpfCnpj, onlyDigits } from '@/lib/plans';
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
 * Inicia a contratação de um plano: cria/atualiza o cliente no Asaas, cria a assinatura mensal
 * e devolve o link da fatura (Pix, boleto ou cartão). O plano só é ativado quando o
 * pagamento for CONFIRMADO pelo webhook do Asaas.
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

    // CPF/CNPJ obrigatório (exigência do gateway e da nota fiscal)
    const doc = onlyDigits(String(cpf_cnpj || tenant.cpf_cnpj || ''));
    if (!isValidCpfCnpj(doc)) {
      return NextResponse.json({ error: 'Informe um CPF ou CNPJ válido para emitir a cobrança.' }, { status: 400 });
    }

    // Já assinante ativo do mesmo plano e dentro do período
    if (tenant.subscription_status === 'active' && tenant.plan === plan && tenant.billing_subscription_id) {
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

    // 2. Se havia assinatura anterior (troca de plano), cancela a antiga para não cobrar em duplicidade
    if (tenant.billing_subscription_id) {
      await cancelSubscription(tenant.billing_subscription_id);
    }

    // 3. Nova assinatura
    const def = PLANS[plan];
    const subscription = await createSubscription({
      customerId,
      value: def.price,
      description: `ERBots - Plano ${def.name} (mensal)`,
      externalReference: tenant.id,
    });

    // Aguarda a primeira cobrança ser gerada para obter o link da fatura
    let invoiceUrl: string | null = null;
    for (let i = 0; i < 4 && !invoiceUrl; i++) {
      invoiceUrl = await getLatestInvoiceUrl(subscription.id);
      if (!invoiceUrl) await new Promise((r) => setTimeout(r, 800));
    }

    const { error: updErr } = await supabase
      .from('xerb_tenants')
      .update({
        cpf_cnpj: doc,
        billing_customer_id: customerId,
        billing_subscription_id: subscription.id,
        billing_plan: plan,
        updated_at: new Date().toISOString(),
      })
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
