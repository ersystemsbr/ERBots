import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { generateStrategicComments } from '@/lib/ai/instagram-agent';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const { competitorPostText } = await req.json();
    if (!competitorPostText) {
      return NextResponse.json({ error: 'Informe o texto ou tema do post concorrente.' }, { status: 400 });
    }

    const db = getServiceSupabase();
    const { data: account } = await db
      .from('xerb_instagram_accounts')
      .select('niche, brand_voice')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    const comments = await generateStrategicComments({
      niche: account?.niche || 'Geral',
      competitorPostText,
      brandVoice: account?.brand_voice || 'Profissional',
    });

    return NextResponse.json({ success: true, comments });
  } catch (err: any) {
    console.error('[API Instagram Comments POST]', err);
    return NextResponse.json({ error: err?.message || 'Erro ao gerar comentários' }, { status: 500 });
  }
}
