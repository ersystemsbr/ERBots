import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { generateKnowledgeDigest, formatAIError } from '@/lib/ai/instagram-agent';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const db = getServiceSupabase();
    const { data: account } = await db
      .from('xerb_instagram_accounts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json(
        { error: 'Configure primeiro os dados básicos da conta do Instagram no painel.' },
        { status: 400 }
      );
    }

    // Gera o Knowledge Digest sintetizado (padrão voice.md)
    const digest = await generateKnowledgeDigest({
      companyName: account.account_name || tenant?.name || 'Sua Empresa',
      niche: body.niche || account.niche || 'Geral',
      targetAudience: body.target_audience || account.target_audience || 'Clientes locais',
      brandVoice: body.brand_voice || account.brand_voice || 'Profissional e acolhedor',
      visualStyle: body.visual_style || account.visual_style || 'Fotografia comercial em estúdio',
      wordsIUse: body.wordsIUse,
      wordsINeverSay: body.wordsINeverSay,
      offLimitsTopics: body.offLimitsTopics,
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
    const cleanError = formatAIError(err).message;
    return NextResponse.json(
      { error: cleanError },
      { status: 500 }
    );
  }
}
