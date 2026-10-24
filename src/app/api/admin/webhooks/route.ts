import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/auth';
import { setInstanceWebhook } from '@/lib/evolution';
import { buildWebhookUrl } from '@/lib/webhook';

export const maxDuration = 60;

/**
 * Re-registra o webhook (agora com token secreto) em TODAS as instâncias existentes.
 * Rodar uma vez após definir WEBHOOK_SECRET na Vercel.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    const { data: instances, error } = await supabase.from('xerb_instances').select('instance_name');
    if (error) throw error;

    const webhookUrl = buildWebhookUrl(req);
    const results = await Promise.all(
      (instances || []).map(async (i) => ({
        instance: i.instance_name as string,
        ok: await setInstanceWebhook(i.instance_name, webhookUrl),
      }))
    );

    return NextResponse.json({
      total: results.length,
      success: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).map((r) => r.instance),
      tokenProtected: webhookUrl.includes('token='),
    });
  } catch (err: any) {
    console.error('[Admin Webhooks Resync] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao ressincronizar webhooks.' }, { status: 500 });
  }
}
