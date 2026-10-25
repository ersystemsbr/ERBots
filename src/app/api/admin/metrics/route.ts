import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/auth';
import { getPlan } from '@/lib/plans';
import { getPlansConfig } from '@/lib/billing/plans-config';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();

    // 1. Busca todos os Tenants
    const { data: tenants, error: tenantsErr } = await supabase
      .from('xerb_tenants')
      .select('id, name, slug, plan, subscription_status, is_super_admin, created_at, trial_ends_at');

    if (tenantsErr) throw tenantsErr;

    // 2. Busca todas as Instâncias
    const { data: instances, error: instErr } = await supabase
      .from('xerb_instances')
      .select('id, tenant_id, status, phone_connected, instance_name');

    if (instErr) console.warn('[Admin Metrics] Erro ao buscar instâncias:', instErr);

    // 3. Contagem total de Mensagens
    const { count: totalMessages } = await supabase
      .from('xerb_messages')
      .select('*', { count: 'exact', head: true });

    // 4. Métricas consolidadas (exclui contas internas de Super Admin do MRR comercial)
    const allTenants = tenants || [];
    const customerTenants = allTenants.filter((t) => !t.is_super_admin);
    const allInstances = instances || [];

    const totalClients = customerTenants.length;
    const activeSubscribers = customerTenants.filter((t) => t.subscription_status === 'active').length;
    const trialingClients = customerTenants.filter((t) => t.subscription_status === 'trialing').length;
    const pastDueClients = customerTenants.filter(
      (t) => t.subscription_status === 'past_due' || t.subscription_status === 'canceled'
    ).length;

    const connectedWhatsApps = allInstances.filter((i) => i.status === 'CONNECTED').length;
    const disconnectedWhatsApps = allInstances.filter((i) => i.status !== 'CONNECTED').length;

    // MRR estimado: soma apenas assinantes comerciais reais (sem contas Super Admin)
    const plansCfg = await getPlansConfig();
    let estimatedMRR = 0;
    customerTenants.forEach((t) => {
      if (t.subscription_status === 'active') {
        estimatedMRR += getPlan(t.plan, plansCfg).price;
      }
    });

    const plansBreakdown = {
      trial: customerTenants.filter((t) => t.plan === 'trial').length,
      start: customerTenants.filter((t) => t.plan === 'start').length,
      pro: customerTenants.filter((t) => t.plan === 'pro').length,
      business: customerTenants.filter((t) => t.plan === 'business').length,
    };

    // O painel admin consome `metrics` com estes nomes de campo
    return NextResponse.json({
      metrics: {
        mrr: estimatedMRR,
        totalTenants: totalClients,
        activeSubscribers,
        trialTenants: trialingClients,
        pastDueTenants: pastDueClients,
        connectedInstances: connectedWhatsApps,
        disconnectedInstances: disconnectedWhatsApps,
        totalInstances: allInstances.length,
        totalMessages: totalMessages || 0,
        plansBreakdown,
      },
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Metrics] Erro fatal:', err);
    return NextResponse.json({ error: 'Erro interno ao calcular métricas.' }, { status: 500 });
  }
}
