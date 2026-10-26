import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getEvolutionConfig, findHealthyNotifierInstance } from '@/lib/evolution';
import { getGeminiApiKey } from '@/lib/ai/gemini';
import { isAsaasConfigured } from '@/lib/billing/asaas';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    const evoConfig = await getEvolutionConfig();

    // 1. Checagem Evolution API
    let evoReachable = false;
    let evoLatencyMs = 0;
    let instancesList: any[] = [];
    const t0 = Date.now();

    if (evoConfig.apiUrl && evoConfig.apiKey) {
      try {
        const res = await fetch(`${evoConfig.apiUrl}/instance/fetchInstances`, {
          headers: { apikey: evoConfig.apiKey },
          cache: 'no-store',
          signal: AbortSignal.timeout(6000),
        });
        evoLatencyMs = Date.now() - t0;
        if (res.ok) {
          evoReachable = true;
          const data = await res.json().catch(() => []);
          if (Array.isArray(data)) {
            instancesList = data.map((i: any) => ({
              name: String(i.name || i.instance?.instanceName || ''),
              state: String(i.connectionStatus || i.instance?.state || 'close'),
              profileName: i.profileName || null,
              ownerJid: i.ownerJid || null,
            }));
          }
        }
      } catch {
        evoLatencyMs = Date.now() - t0;
      }
    }

    // 2. Checagem Supabase
    let sbReachable = false;
    let sbLatencyMs = 0;
    let tenantsCount = 0;
    let totalMessages = 0;
    const t1 = Date.now();
    try {
      const [tRes, mRes] = await Promise.all([
        supabase.from('xerb_tenants').select('id', { count: 'exact', head: true }),
        supabase.from('xerb_messages').select('id', { count: 'exact', head: true }),
      ]);
      sbLatencyMs = Date.now() - t1;
      sbReachable = true;
      tenantsCount = tRes.count || 0;
      totalMessages = mRes.count || 0;
    } catch {
      sbLatencyMs = Date.now() - t1;
    }

    // 3. Checagem Gemini AI
    const geminiKey = await getGeminiApiKey();
    const geminiConfigured = Boolean(geminiKey);

    // 4. Checagem Guardião WhatsApp
    const notifierInstance = await findHealthyNotifierInstance();
    const { data: superAdmins } = await supabase
      .from('xerb_tenants')
      .select('name, phone, alert_phone')
      .eq('is_super_admin', true)
      .limit(1);

    const alertPhone = superAdmins?.[0]?.alert_phone || superAdmins?.[0]?.phone || null;

    // Resumo de instâncias
    const openCount = instancesList.filter((i) => i.state.toLowerCase() === 'open').length;
    const closedCount = instancesList.filter((i) => i.state.toLowerCase() !== 'open').length;
    const erbotsCount = instancesList.filter((i) => i.name.startsWith('erbots_')).length;
    const gastrosysCount = instancesList.filter((i) => i.name.startsWith('gastrosys_')).length;
    const testCount = instancesList.filter((i) => i.name.startsWith('test_') || i.name.startsWith('teste_')).length;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      evolution: {
        configured: Boolean(evoConfig.apiUrl && evoConfig.apiKey),
        reachable: evoReachable,
        latencyMs: evoLatencyMs,
        apiUrl: evoConfig.apiUrl,
        totalInstances: instancesList.length,
        openInstances: openCount,
        closedInstances: closedCount,
        erbotsInstances: erbotsCount,
        gastrosysInstances: gastrosysCount,
        testInstances: testCount,
        instances: instancesList,
      },
      supabase: {
        reachable: sbReachable,
        latencyMs: sbLatencyMs,
        tenantsCount,
        totalMessages,
      },
      gemini: {
        configured: geminiConfigured,
        modelPrimary: 'gemini-3.5-flash-lite',
        modelFallback: 'gemini-3.6-flash',
      },
      asaas: {
        configured: isAsaasConfigured(),
        environment: process.env.ASAAS_ENV || 'production',
      },
      guardian: {
        active: Boolean(notifierInstance),
        notifierInstance: notifierInstance || null,
        alertPhone: alertPhone || 'Não configurado',
      },
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Monitor GET] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar métricas do monitor.' }, { status: 500 });
  }
}
