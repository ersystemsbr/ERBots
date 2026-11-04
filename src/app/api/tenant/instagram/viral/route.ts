import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { analyzeViralVideoAndCreateScript, formatAIError } from '@/lib/ai/instagram-agent';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const { viralReference, mode } = await req.json().catch(() => ({}));
    if (!viralReference || !viralReference.trim()) {
      return NextResponse.json(
        { error: 'Informe a palavra-chave do nicho, @ do perfil ou link/texto para dissecação.' },
        { status: 400 }
      );
    }

    const db = getServiceSupabase();
    const { data: account } = await db
      .from('xerb_instagram_accounts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    const analysis = await analyzeViralVideoAndCreateScript({
      niche: account?.niche || 'Geral',
      viralReference: viralReference.trim(),
      mode: mode || 'video_link_or_text',
      companyName: account?.account_name || tenant.name || 'Sua Empresa',
      brandVoice: account?.brand_voice || 'Profissional',
      knowledgeDigest: account?.brand_knowledge_digest,
    });

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error('[API Instagram Viral POST]', err);
    const cleanError = formatAIError(err).message;
    return NextResponse.json(
      { error: cleanError },
      { status: 500 }
    );
  }
}
