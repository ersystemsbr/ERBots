import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { generateViralPost, generatePostImage, formatAIError } from '@/lib/ai/instagram-agent';
import { sendTextMessage, normalizeBrPhone } from '@/lib/evolution';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const { topicHint, format, aspectRatio: reqRatio } = await req.json().catch(() => ({}));
    const selectedFormat = (format === 'carousel' || format === 'reel_script') ? format : 'single_image';

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

    let aspectRatio: '4:5' | '9:16' | '1:1' = '4:5';
    let cleanVisualStyle = account.visual_style || '';
    if (cleanVisualStyle.startsWith('{') && cleanVisualStyle.includes('"ratio"')) {
      try {
        const meta = JSON.parse(cleanVisualStyle);
        if (meta.ratio) aspectRatio = meta.ratio;
        if (meta.style) cleanVisualStyle = meta.style;
      } catch {}
    }

    if (reqRatio && ['4:5', '9:16', '1:1'].includes(reqRatio)) {
      aspectRatio = reqRatio;
    }

    // 1. Gera o conteúdo do post (gancho, legenda, hashtags, roteiro/slides e prompt de imagem)
    const postData = await generateViralPost({
      companyName: tenant?.name || 'Sua Empresa',
      niche: account.niche || 'Geral',
      format: selectedFormat,
      knowledgeDigest: account.brand_knowledge_digest,
      topicHint: topicHint || undefined,
      visualStyle: cleanVisualStyle || undefined,
    });

    // 2. Gera a imagem comercial com IA (capa ou post único com design de agência)
    const imageUrl = await generatePostImage(postData.image_prompt, {
      hookTitle: postData.hook_title,
      companyName: account.account_name || tenant?.name || 'Sua Empresa',
      username: account.account_username || undefined,
      niche: account.niche || undefined,
      categoryBadge:
        selectedFormat === 'reel_script'
          ? 'ROTEIRO REELS'
          : selectedFormat === 'carousel'
          ? 'CARROSSEL DIDÁTICO'
          : 'POST ESTRATÉGICO',
      aspectRatio,
    });

    // 3. Define status inicial e agendamento
    const isApprovalRequired = account.approval_mode === 'whatsapp_required';
    const status = isApprovalRequired ? 'pending_approval' : 'scheduled';

    const preferredTime = account.preferred_post_time || '18:00:00';
    const [hours, minutes] = (preferredTime || '18:00').split(':').map(Number);
    const scheduledFor = new Date();
    scheduledFor.setHours(hours || 18, minutes || 0, 0, 0);
    if (scheduledFor.getTime() <= Date.now()) {
      scheduledFor.setDate(scheduledFor.getDate() + 1);
    }

    // 4. Monta notas visuais com script ou slides se aplicável
    let fullVisualNotes = postData.visual_notes || '';
    if (selectedFormat === 'reel_script' && postData.reel_script) {
      fullVisualNotes = JSON.stringify({
        notes: postData.visual_notes,
        hook_score: postData.hook_score,
        reel_script: postData.reel_script,
      });
    } else if (selectedFormat === 'carousel' && postData.carousel_slides) {
      fullVisualNotes = JSON.stringify({
        notes: postData.visual_notes,
        hook_score: postData.hook_score,
        carousel_slides: postData.carousel_slides,
      });
    }

    // 5. Salva o post no banco de dados
    const { data: createdPost, error: insertError } = await db
      .from('xerb_instagram_posts')
      .insert({
        tenant_id: tenant.id,
        account_id: account.id,
        post_type: selectedFormat,
        hook_title: postData.hook_title,
        caption: postData.caption,
        hashtags: postData.hashtags,
        media_urls: [imageUrl],
        image_prompt: postData.image_prompt,
        visual_notes: fullVisualNotes,
        status,
        approval_requested_at: isApprovalRequired ? new Date().toISOString() : null,
        scheduled_for: scheduledFor.toISOString(),
        metrics: {
          likes: 0,
          comments: 0,
          reach: 0,
          saves: 0,
          hook_score: postData.hook_score || 90,
        },
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 6. Se for aprovação via WhatsApp, despacha a notificação
    if (isApprovalRequired && tenant?.phone) {
      const cleanPhone = normalizeBrPhone(tenant.phone);
      if (cleanPhone) {
        const { data: instance } = await db
          .from('xerb_instances')
          .select('instance_name')
          .eq('tenant_id', tenant.id)
          .eq('status', 'CONNECTED')
          .maybeSingle();

        if (instance?.instance_name) {
          const typeLabel =
            selectedFormat === 'reel_script'
              ? '🎬 Roteiro de Reels'
              : selectedFormat === 'carousel'
              ? '📑 Carrossel Didático'
              : '📸 Post com Foto IA';

          const approvalMsg = `📢 *Novo Post Criado pelo Agente de Instagram!*
          
Formato: *${typeLabel}*
📌 *Gancho (${postData.hook_score || 90}/100):* ${postData.hook_title}

📝 *Prévia da Legenda:*
${postData.caption.slice(0, 240)}...

⏰ *Horário sugerido:* Hoje às ${preferredTime}

👉 *Para aprovar e agendar:* acesse o painel ERBots ou responda com "APROVAR".`;

          sendTextMessage(
            instance.instance_name,
            cleanPhone,
            approvalMsg
          ).catch((e) => console.warn('[Instagram WhatsApp Notify] Falha silenciosa:', e?.message));
        }
      }
    }

    return NextResponse.json({
      success: true,
      post: createdPost,
      details: {
        hook_score: postData.hook_score,
        reel_script: postData.reel_script,
        carousel_slides: postData.carousel_slides,
      },
    });
  } catch (err: any) {
    console.error('[API Instagram Generate POST]', err);
    const cleanError = formatAIError(err).message;
    return NextResponse.json(
      { error: cleanError },
      { status: 500 }
    );
  }
}
