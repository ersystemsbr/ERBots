import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireTenantAccess } from '@/lib/auth';
import { AsaasError, cancelSubscription, isAsaasConfigured } from '@/lib/billing/asaas';

export const maxDuration = 30;

/**
 * Cancela a renovação automática. O cliente mantém o acesso até o fim do período já pago.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const guard = await requireTenantAccess(req, body.tenant_id);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    const { data: tenant } = await supabase
      .from('xerb_tenants')
      .select('id, billing_subscription_id, pending_subscription_id, subscription_status')
      .eq('id', guard.tenant.id)
      .single();

    if (!tenant?.billing_subscription_id && !tenant?.pending_subscription_id) {
      return NextResponse.json({ error: 'Nenhuma assinatura recorrente encontrada.' }, { status: 404 });
    }
    if (!isAsaasConfigured()) {
      return NextResponse.json({ error: 'Gateway de pagamento indisponível. Contate o suporte.' }, { status: 503 });
    }

    if (tenant.billing_subscription_id) {
      await cancelSubscription(tenant.billing_subscription_id);
    }
    if (tenant.pending_subscription_id && tenant.pending_subscription_id !== tenant.billing_subscription_id) {
      await cancelSubscription(tenant.pending_subscription_id).catch(() => {});
    }

    const { data: updated, error } = await supabase
      .from('xerb_tenants')
      .update({
        subscription_status: 'canceled',
        billing_subscription_id: null,
        pending_subscription_id: null,
        pending_plan: null,
        pending_invoice_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, tenant: updated });
  } catch (err: any) {
    if (err instanceof AsaasError) {
      return NextResponse.json({ error: err.message }, { status: err.status >= 500 ? 502 : 400 });
    }
    console.error('[Billing Cancel] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao cancelar a assinatura.' }, { status: 500 });
  }
}
