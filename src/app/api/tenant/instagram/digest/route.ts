import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { generateKnowledgeDigest } from '@/lib/ai/instagram-agent';

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
      return NextResponse.json({ error: 'Configure primeiro os dados da conta do Instagram.' }, { status: 400 });
    }

    // Gera o Knowledge Digest sintetizado
    const digest = await generateKnowledgeDigest({
      companyName: tenant?.name || 'Sua Empresa',
      niche: account.niche || 'Geral',
      targetAudience: account.target_audience || 'Clientes locais',
      brandVoice: account.brand_voice || 'Profissional e acolhedor',
      visualStyle: account.visual_style || 'Fotografia realista',
    });

    const now = new Date().toISOString();
    const { error } = await db
      .from('xerb_instagram_accounts')
      .update({
        brand_knowledge_digest: digest,
        digest_updated_at: now,
        updated_at: now,
      })
      .eq('id', account.id);

    if (error) throw error;

    return NextResponse.json({ success: true, digest, updated_at: now });
  } catch (err: any) {
    console.error('[API Instagram Digest POST]', err);
    return NextResponse.json({ error: err?.message || 'Erro ao gerar Knowledge Digest' }, { status: 500 });
  }
}
