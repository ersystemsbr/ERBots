import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/auth';

export const maxDuration = 60;

const VALID_PLANS = ['trial', 'start', 'pro', 'business', 'custom'];
const VALID_METHODS = ['pix', 'credit_card', 'boleto', 'manual', 'transfer'];

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();

    // 1. Tenta buscar histórico na tabela xerb_payments
    try {
      const { data: payments, error: payErr } = await supabase
        .from('xerb_payments')
        .select(`
          id,
          tenant_id,
          amount,
          plan,
          payment_method,
          status,
          paid_at,
          expires_at,
          notes,
          created_at,
          xerb_tenants (
            name,
            email,
            slug
          )
        `)
        .order('created_at', { ascending: false });

      if (payErr) {
        console.warn('[Admin Payments] Tabela xerb_payments ainda não criada no Supabase:', payErr.message);
        return NextResponse.json({
          payments: [],
          tablePending: true,
          hint: 'Execute o script database/add_super_admin_payments.sql no SQL Editor do Supabase.',
        });
      }

      return NextResponse.json({ payments: payments || [], tablePending: false });
    } catch (e: any) {
      return NextResponse.json({ payments: [], tablePending: true });
    }
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Payments GET] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao listar pagamentos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const {
      tenant_id,
      amount,
      plan,
      payment_method = 'pix',
      notes = '',
      extend_days = 30,
    } = body;

    if (!tenant_id || amount === undefined || amount === null || !plan) {
      return NextResponse.json({ error: 'Campos obrigatórios: tenant_id, amount, plan.' }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 100000) {
      return NextResponse.json({ error: 'Valor do pagamento inválido.' }, { status: 400 });
    }
    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    }
    if (!VALID_METHODS.includes(payment_method)) {
      return NextResponse.json({ error: 'Forma de pagamento inválida.' }, { status: 400 });
    }

    const numDays = Number(extend_days) || 30;
    if (numDays < 1 || numDays > 366) {
      return NextResponse.json({ error: 'extend_days deve estar entre 1 e 366.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data: tenantExists } = await supabase
      .from('xerb_tenants')
      .select('id')
      .eq('id', tenant_id)
      .maybeSingle();
    if (!tenantExists) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString();

    // 1. Tenta inserir na tabela xerb_payments
    let paymentRecord: any = null;
    try {
      const { data, error } = await supabase
        .from('xerb_payments')
        .insert({
          tenant_id,
          amount: numAmount,
          plan,
          payment_method,
          status: 'confirmed',
          paid_at: new Date().toISOString(),
          expires_at: expiresAt,
          notes: String(notes || '').slice(0, 500),
        })
        .select()
        .single();

      if (!error) {
        paymentRecord = data;
      }
    } catch (payInsertErr) {
      console.warn('[Admin Payments] Não foi possível salvar em xerb_payments:', payInsertErr);
    }

    // 2. Atualiza automaticamente a assinatura do cliente
    const tenantPlan = plan === 'custom' ? 'business' : plan;
    const { data: updatedTenant, error: tenantUpdateErr } = await supabase
      .from('xerb_tenants')
      .update({
        plan: tenantPlan,
        subscription_status: 'active',
        trial_ends_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant_id)
      .select()
      .single();

    if (tenantUpdateErr) throw tenantUpdateErr;

    return NextResponse.json({
      success: true,
      payment: paymentRecord,
      tenant: updatedTenant,
      message: `Assinatura do plano ${String(plan).toUpperCase()} ativada com sucesso por ${numDays} dias!`,
    });
  } catch (err: any) {
    console.error('[Admin Payments POST] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao registrar pagamento.' }, { status: 500 });
  }
}
