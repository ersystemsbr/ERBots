import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getGeminiApiKey } from '@/lib/ai/gemini';
import { getEvolutionConfig } from '@/lib/evolution';
import { isWebhookSecretConfigured } from '@/lib/webhook';

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
 * Diagnóstico de configuração de produção (sem expor valores de segredos).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const evo = await getEvolutionConfig();
    const gemini = await getGeminiApiKey();

    return NextResponse.json({
      serviceRoleKey: {
        configured: Boolean(serviceKey),
        validRole: jwtRole(serviceKey) === 'service_role',
      },
      webhookSecretConfigured: isWebhookSecretConfigured(),
      evolutionConfigured: Boolean(evo.apiUrl && evo.apiKey),
      evolutionUrlIsTemporaryTunnel: /trycloudflare\.com/i.test(evo.apiUrl || ''),
      geminiConfigured: Boolean(gemini),
      appUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Health] Erro:', err);
    return NextResponse.json({ error: 'Erro interno no diagnóstico.' }, { status: 500 });
  }
}
