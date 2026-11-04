import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { analyzeViralVideoAndCreateScript, formatAIError } from '@/lib/ai/instagram-agent';

export async function GET(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const db = getServiceSupabase();
    const { data: posts, error } = await db
      .from('xerb_instagram_posts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('post_type', 'reel_script')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const researches = (posts || [])
      .filter((p: any) => p.metrics?.is_viral_research === true)
      .map((p: any) => {
        let parsedNotes: any = null;
        try {
          parsedNotes = p.visual_notes ? JSON.parse(p.visual_notes) : null;
        } catch {}

        return {
          id: p.id,
          created_at: p.created_at,
          title: p.hook_title,
          reference: p.image_prompt || p.hook_title,
          mode: p.metrics?.mode || 'video_link_or_text',
          virality_score: p.metrics?.virality_score || 95,
          analysis: parsedNotes || {
            source_topic: p.metrics?.source_topic || p.hook_title,
            hook_breakdown: p.metrics?.hook_breakdown || {},
            new_script: p.metrics?.new_script || {
              title: p.hook_title,
              caption: p.caption,
              beat_sheet: [],
              hook_3s: '',
              on_screen_text: [],
              cta: '',
              virality_score: p.metrics?.virality_score || 95,
            },
          },
        };
      });

    return NextResponse.json({ success: true, researches });
  } catch (err: any) {
    console.error('[API Instagram Viral GET]', err);
    return NextResponse.json({ error: err?.message || 'Erro ao carregar histórico viral' }, { status: 500 });
  }
}

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

    // Salva a pesquisa automaticamente no banco de dados para nunca perder o histórico
    const { data: savedPost, error: saveErr } = await db
      .from('xerb_instagram_posts')
      .insert({
        tenant_id: tenant.id,
        account_id: account?.id || null,
        post_type: 'reel_script',
        hook_title: analysis.new_script.title || analysis.source_topic || 'Roteiro Viral',
        caption: analysis.new_script.caption || '',
        image_prompt: viralReference.trim(),
        status: 'draft',
        visual_notes: JSON.stringify(analysis),
        metrics: {
          is_viral_research: true,
          mode: mode || 'video_link_or_text',
          virality_score: analysis.new_script.virality_score || 95,
          source_topic: analysis.source_topic,
          hook_breakdown: analysis.hook_breakdown,
          new_script: analysis.new_script,
        },
      })
      .select()
      .single();

    if (saveErr) {
      console.warn('[API Instagram Viral] Aviso ao salvar histórico no DB:', saveErr);
    }

    return NextResponse.json({
      success: true,
      analysis,
      savedId: savedPost?.id || null,
    });
  } catch (err: any) {
    console.error('[API Instagram Viral POST]', err);
    const cleanError = formatAIError(err).message;
    return NextResponse.json(
      { error: cleanError },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID da pesquisa não informado' }, { status: 400 });
    }

    const db = getServiceSupabase();
    await db
      .from('xerb_instagram_posts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API Instagram Viral DELETE]', err);
    return NextResponse.json({ error: err?.message || 'Erro ao excluir pesquisa' }, { status: 500 });
  }
}
