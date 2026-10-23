import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { isSuperAdminEmail } from '@/lib/admin';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('x-user-email') || '';
    const isAdmin = await isSuperAdminEmail(authHeader);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    // 1. Busca todos os Tenants
    const { data: tenants, error: tenantsErr } = await supabase
      .from('xerb_tenants')
      .select('id, name, slug, plan, subscription_status, created_at, trial_ends_at');

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

    // 4. Métricas consolidadas
    const allTenants = tenants || [];
    const allInstances = instances || [];

    const totalClients = allTenants.length;
    const activeSubscribers = allTenants.filter((t) => t.subscription_status === 'active').length;
    const trialingClients = allTenants.filter((t) => t.subscription_status === 'trialing').length;
    const pastDueClients = allTenants.filter(
      (t) => t.subscription_status === 'past_due' || t.subscription_status === 'canceled'
    ).length;

    const connectedWhatsApps = allInstances.filter((i) => i.status === 'CONNECTED').length;
    const disconnectedWhatsApps = allInstances.filter((i) => i.status !== 'CONNECTED').length;

    // Estimativa de MRR
    const planPrices: Record<string, number> = {
      start: 97,
      pro: 197,
      business: 397,
      trial: 0,
    };

    let estimatedMRR = 0;
    allTenants.forEach((t) => {
      if (t.subscription_status === 'active') {
        estimatedMRR += planPrices[t.plan || 'trial'] || 0;
      }
    });

    return NextResponse.json({
      totalClients,
      activeSubscribers,
      trialingClients,
      pastDueClients,
      connectedWhatsApps,
      disconnectedWhatsApps,
      totalMessages: totalMessages || 0,
      estimatedMRR,
      plansBreakdown: {
        trial: allTenants.filter((t) => t.plan === 'trial').length,
        start: allTenants.filter((t) => t.plan === 'start').length,
        pro: allTenants.filter((t) => t.plan === 'pro').length,
        business: allTenants.filter((t) => t.plan === 'business').length,
      },
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Metrics] Erro fatal:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}
