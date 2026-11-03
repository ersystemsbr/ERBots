import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { generateViralPost, generatePostImage } from '@/lib/ai/instagram-agent';
import { sendTextMessage, normalizeBrPhone } from '@/lib/evolution';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const { topicHint } = await req.json().catch(() => ({}));

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

    // 1. Gera o conteúdo do post (gancho, legenda, hashtags e prompt de imagem)
    const postData = await generateViralPost({
      companyName: tenant?.name || 'Sua Empresa',
      niche: account.niche || 'Geral',
      knowledgeDigest: account.brand_knowledge_digest,
      topicHint: topicHint || undefined,
      visualStyle: account.visual_style || undefined,
    });

    // 2. Gera a imagem promocional com IA (Imagen 3 / Gemini)
    const imageUrl = await generatePostImage(postData.image_prompt);

    // 3. Define status inicial e agendamento
    const isApprovalRequired = account.approval_mode === 'whatsapp_required';
    const status = isApprovalRequired ? 'pending_approval' : 'scheduled';

    const preferredTime = account.preferred_post_time || '18:00:00';
    const [hours, minutes] = preferredTime.split(':').map(Number);
    const scheduledFor = new Date();
    scheduledFor.setHours(hours || 18, minutes || 0, 0, 0);
    if (scheduledFor.getTime() <= Date.now()) {
      scheduledFor.setDate(scheduledFor.getDate() + 1);
    }

    // 4. Salva o post no banco de dados
    const { data: createdPost, error: insertError } = await db
      .from('xerb_instagram_posts')
      .insert({
        tenant_id: tenant.id,
        account_id: account.id,
        post_type: 'single_image',
        hook_title: postData.hook_title,
        caption: postData.caption,
        hashtags: postData.hashtags,
        media_urls: [imageUrl],
        image_prompt: postData.image_prompt,
        visual_notes: postData.visual_notes,
        status,
        approval_requested_at: isApprovalRequired ? new Date().toISOString() : null,
        scheduled_for: scheduledFor.toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 5. Se for aprovação via WhatsApp, despacha a notificação
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
          const approvalMsg = `📢 *Novo Post Criado pelo Agente de Instagram!*
          
📌 *Gancho:* ${postData.hook_title}

📝 *Prévia da Legenda:*
${postData.caption.slice(0, 280)}...

⏰ *Horário sugerido:* Hoje às ${preferredTime}

👉 Responda para gerenciar:
*1* - Aprovar e Agendar Publicação
*2* - Gerar Outra Opção`;

          await sendTextMessage(instance.instance_name, cleanPhone, approvalMsg).catch((e) => {
            console.warn('[InstagramAgent] Falha ao enviar WhatsApp de aprovação:', e?.message || e);
          });
        }
      }
    }

    return NextResponse.json({ success: true, post: createdPost });
  } catch (err: any) {
    console.error('[API Instagram Generate POST]', err);
    return NextResponse.json({ error: err?.message || 'Erro ao gerar publicação' }, { status: 500 });
  }
}
