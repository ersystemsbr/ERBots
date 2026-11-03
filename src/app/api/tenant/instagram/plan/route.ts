import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { generateWeeklyPlan } from '@/lib/ai/instagram-agent';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const db = getServiceSupabase();
    const { data: account } = await db
      .from('xerb_instagram_accounts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json(
        { error: 'Configure primeiro os dados da conta do Instagram no painel.' },
        { status: 400 }
      );
    }

    const plan = await generateWeeklyPlan({
      companyName: tenant?.name || 'Sua Empresa',
      niche: account.niche || 'Geral',
      knowledgeDigest: account.brand_knowledge_digest,
    });

    return NextResponse.json({ success: true, plan });
  } catch (err: any) {
    console.error('[API Instagram Plan POST]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao gerar planejamento semanal' },
      { status: 500 }
    );
  }
}
