import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireTenantAccess } from '@/lib/auth';
import { isValidCpfCnpj, onlyDigits } from '@/lib/plans';
import { getAddonsConfig } from '@/lib/billing/plans-config';
import {
  AsaasError,
  createOneTimePayment,
  isAsaasConfigured,
  upsertCustomer,
} from '@/lib/billing/asaas';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

/**
 * Emite cobrança avulsa (Pix, Cartão ou Boleto via Asaas) de um Pacote Extra de Respostas IA.
 * Os créditos adicionados não expiram na virada do mês e só são consumidos após a franquia mensal.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, cpf_cnpj } = body;

    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;

    const tid = guard.tenant.id;
    const rl = checkRateLimit(`topup:${tid}`, 8, 10 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas seguidas. Aguarde ${rl.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    if (!isAsaasConfigured()) {
      return NextResponse.json(
        { error: 'O pagamento online ainda não está disponível. Fale com o suporte para adquirir créditos extras.' },
        { status: 503 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: tenant, error: tenantErr } = await supabase
      .from('xerb_tenants')
      .select('*')
      .eq('id', tid)
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const doc = onlyDigits(String(cpf_cnpj || tenant.cpf_cnpj || ''));
    if (!isValidCpfCnpj(doc)) {
      return NextResponse.json({ error: 'Informe um CPF ou CNPJ válido para emitir a cobrança.' }, { status: 400 });
    }

    const addons = await getAddonsConfig();
    const customerId = await upsertCustomer(tenant.billing_customer_id, {
      name: tenant.name,
      email: tenant.email,
      cpfCnpj: doc,
      mobilePhone: tenant.phone ? onlyDigits(tenant.phone) : null,
      externalReference: tenant.id,
    });

    const payment = await createOneTimePayment({
      customerId,
      value: addons.extraPackPrice,
      description: `ERBots - Pacote Avulso +${addons.extraPackReplies.toLocaleString('pt-BR')} Respostas IA`,
      externalReference: `erbots_topup:${tenant.id}:${addons.extraPackReplies}:${addons.extraPackPrice}`,
    });

    await supabase
      .from('xerb_tenants')
      .update({
        cpf_cnpj: doc,
        billing_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant.id);

    if (!payment.invoiceUrl) {
      return NextResponse.json(
        { error: 'Cobrança gerada, mas o link ainda não ficou disponível. Verifique seu e-mail em instantes.' },
        { status: 202 }
      );
    }

    return NextResponse.json({
      success: true,
      invoiceUrl: payment.invoiceUrl,
      paymentId: payment.id,
      replies: addons.extraPackReplies,
      price: addons.extraPackPrice,
    });
  } catch (err: any) {
    if (err instanceof AsaasError) {
      console.error('[Billing Topup] Asaas:', err.message);
      return NextResponse.json({ error: err.message }, { status: err.status >= 500 ? 502 : 400 });
    }
    console.error('[Billing Topup] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao gerar pacote avulso.' }, { status: 500 });
  }
}
