import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getGeminiApiKey } from '@/lib/ai/gemini';
import { getEvolutionConfig, checkEvolutionHealth } from '@/lib/evolution';
import { isWebhookSecretConfigured } from '@/lib/webhook';
import { isAsaasConfigured } from '@/lib/billing/asaas';

export const maxDuration = 30;

/** Decodifica o claim `role` de um JWT do Supabase (sem validar assinatura; só diagnóstico). */
function jwtRole(key?: string): string | null {
  try {
    if (!key) return null;
    const payload = key.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json).role || null;
  } catch {
    return null;
  }
}

/**
 * Diagnóstico de configuração e saúde de produção (sem expor valores de segredos).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const [evo, evoHealth, gemini] = await Promise.all([
      getEvolutionConfig(),
      checkEvolutionHealth(),
      getGeminiApiKey(),
    ]);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');

    return NextResponse.json({
      serviceRoleKey: {
        configured: Boolean(serviceKey),
        // Aceita o formato legado (JWT com role service_role) e o novo (sb_secret_...)
        validRole: jwtRole(serviceKey) === 'service_role' || Boolean(serviceKey?.startsWith('sb_secret_')),
      },
      webhookSecretConfigured: isWebhookSecretConfigured(),
      evolutionConfigured: Boolean(evo.apiUrl && evo.apiKey),
      evolutionUrlIsTemporaryTunnel: evoHealth.isTemporaryTunnel,
      evolutionReachable: evoHealth.reachable,
      evolutionLatencyMs: evoHealth.latencyMs,
      evolutionPublicUrl: evoHealth.publicUrl,
      evolutionErbotsOpen: evoHealth.erbotsOpenInstances,
      evolutionErbotsTotal: evoHealth.erbotsTotalInstances,
      webhookPublicUrl: appUrl ? `${appUrl}/api/webhook/whatsapp` : '',
      geminiConfigured: Boolean(gemini),
      appUrlConfigured: Boolean(appUrl),
      asaasConfigured: isAsaasConfigured(),
      asaasWebhookTokenConfigured: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
      asaasSandbox: process.env.ASAAS_ENV === 'sandbox',
      sentryConfigured: Boolean(process.env.SENTRY_DSN),
      alertWebhookConfigured: Boolean(process.env.ALERT_WEBHOOK_URL),
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Health] Erro:', err);
    return NextResponse.json({ error: 'Erro interno no diagnóstico.' }, { status: 500 });
  }
}
