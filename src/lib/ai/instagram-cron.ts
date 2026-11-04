import { getServiceSupabase } from '../supabase';
import { generateViralPost, generatePostImage } from './instagram-agent';
import { normalizeBrPhone, sendTextMessage } from '../evolution';

export interface DailyPostResult {
  success: boolean;
  postId?: string;
  hookTitle?: string;
  error?: string;
  dispatchedToWhatsApp?: boolean;
}

const PILLAR_CONFIG = [
  { day: 0, pillar: 'Autoridade', format: 'reel_script' as const, hint: 'Planejamento e estratégia para dominar a semana sem erros' },
  { day: 1, pillar: 'Atração', format: 'reel_script' as const, hint: 'Gancho viral ou quebra de crença comum do nicho' },
  { day: 2, pillar: 'Autoridade', format: 'carousel' as const, hint: 'Passo a passo didático de como resolver a principal dor' },
  { day: 3, pillar: 'Conexão', format: 'single_image' as const, hint: 'História real, bastidores autênticos e compromisso com o cliente' },
  { day: 4, pillar: 'Venda', format: 'single_image' as const, hint: 'Oferta direta com prova social e convite para atendimento no WhatsApp' },
  { day: 5, pillar: 'Atração', format: 'carousel' as const, hint: 'Lista prática e altamente compartilhável de dicas rápidas' },
  { day: 6, pillar: 'Conexão', format: 'single_image' as const, hint: 'Reflexão humanizada de fim de semana e celebração de resultados' },
];

/**
 * Gera o post estratégico do dia e despacha imediatamente para o WhatsApp do lojista
 */
export async function generateDailyPostForTenant(tenantId: string): Promise<DailyPostResult> {
  const db = getServiceSupabase();

  // 1. Carrega dados do tenant e da conta de Instagram
  const [tenantRes, accountRes] = await Promise.all([
    db.from('xerb_tenants').select('id, name, phone, alert_phone').eq('id', tenantId).maybeSingle(),
    db.from('xerb_instagram_accounts').select('*').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  const tenant = tenantRes.data;
  const account = accountRes.data;

  if (!tenant || !account) {
    return { success: false, error: 'Conta de Instagram ou empresa não encontrada.' };
  }

  // 2. Define o pilar e formato do dia com base no fuso horário do Brasil
  const nowBr = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dayOfWeek = nowBr.getDay();
  const rule = PILLAR_CONFIG.find((p) => p.day === dayOfWeek) || PILLAR_CONFIG[1];

  // Desempacota formato da imagem (4:5, 9:16 ou 1:1) e horários customizados
  let aspectRatio: '4:5' | '9:16' | '1:1' = '4:5';
  let deliveryTime = '23:00';
  let cleanVisualStyle = account.visual_style || '';

  if (cleanVisualStyle.startsWith('{') && cleanVisualStyle.includes('"ratio"')) {
    try {
      const meta = JSON.parse(cleanVisualStyle);
      if (meta.ratio) aspectRatio = meta.ratio;
      if (meta.deliveryTime) deliveryTime = meta.deliveryTime;
      if (meta.style) cleanVisualStyle = meta.style;
    } catch {}
  }

  // 3. Gera o conteúdo do post com o motor de IA
  const postData = await generateViralPost({
    companyName: account.account_name || tenant.name || 'Sua Empresa',
    niche: account.niche || 'Comércio & Serviços',
    format: rule.format,
    knowledgeDigest: account.brand_knowledge_digest,
    topicHint: rule.hint,
    visualStyle: cleanVisualStyle || undefined,
  });

  // 4. Gera a arte visual com padrão editorial de agência no formato configurado (4:5, 9:16 ou 1:1)
  const imageUrl = await generatePostImage(postData.image_prompt, {
    hookTitle: postData.hook_title,
    companyName: account.account_name || tenant.name,
    username: account.account_username || undefined,
    niche: account.niche || undefined,
    categoryBadge: rule.pillar.toUpperCase(),
    aspectRatio,
  });

  // 5. Configura agendamento e status
  const isApprovalRequired = account.approval_mode === 'whatsapp_required';
  const status = isApprovalRequired ? 'pending_approval' : 'scheduled';

  const preferredTime = account.preferred_post_time ? account.preferred_post_time.slice(0, 5) : '05:30';
  const [hours, minutes] = preferredTime.split(':').map(Number);
  const scheduledFor = new Date(nowBr);
  scheduledFor.setHours(hours ?? 5, minutes ?? 30, 0, 0);
  if (scheduledFor.getTime() <= Date.now()) {
    scheduledFor.setDate(scheduledFor.getDate() + 1);
  }

  let fullVisualNotes = postData.visual_notes || '';
  if (rule.format === 'reel_script' && postData.reel_script) {
    fullVisualNotes = JSON.stringify({
      notes: postData.visual_notes,
      hook_score: postData.hook_score,
      reel_script: postData.reel_script,
    });
  } else if (rule.format === 'carousel' && postData.carousel_slides) {
    fullVisualNotes = JSON.stringify({
      notes: postData.visual_notes,
      hook_score: postData.hook_score,
      carousel_slides: postData.carousel_slides,
    });
  }

  // 6. Insere o post no banco
  const { data: createdPost, error: insertError } = await db
    .from('xerb_instagram_posts')
    .insert({
      tenant_id: tenant.id,
      account_id: account.id,
      post_type: rule.format,
      hook_title: postData.hook_title,
      caption: postData.caption,
      hashtags: postData.hashtags,
      media_urls: [imageUrl],
      image_prompt: postData.image_prompt,
      visual_notes: fullVisualNotes,
      status,
      approval_requested_at: new Date().toISOString(),
      scheduled_for: scheduledFor.toISOString(),
      metrics: {
        likes: 0,
        comments: 0,
        reach: 0,
        saves: 0,
        hook_score: postData.hook_score || 94,
      },
    })
    .select('id')
    .single();

  if (insertError || !createdPost) {
    return { success: false, error: insertError?.message || 'Erro ao gravar post no banco.' };
  }

  // 7. Notifica o dono da empresa no WhatsApp com opções interativas (1, 2, 3)
  let dispatched = false;
  const targetPhone = normalizeBrPhone(tenant.alert_phone) || normalizeBrPhone(tenant.phone);

  if (targetPhone) {
    const { data: instance } = await db
      .from('xerb_instances')
      .select('instance_name')
      .eq('tenant_id', tenant.id)
      .eq('status', 'CONNECTED')
      .maybeSingle();

    if (instance?.instance_name) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.erbots.com.br').replace(/\/+$/, '');
      const formatLabel =
        rule.format === 'reel_script'
          ? '🎬 Roteiro de Reels'
          : rule.format === 'carousel'
          ? '📑 Carrossel Didático'
          : '📸 Post com Foto IA';

      let msg = '';
      if (isApprovalRequired) {
        msg = `🚀 *Seu Post Estratégico de Hoje Está Pronto!* (ERBots IA)

📌 *Gancho (${postData.hook_score || 94}/100):*
"${postData.hook_title}"

🎯 *Pilar:* ${rule.pillar} (${formatLabel})

📝 *Prévia da Legenda:*
${postData.caption.slice(0, 220)}...

🔗 *Ver post e arte completa:*
${appUrl}/dashboard?tab=instagram&post=${createdPost.id}

━━━━━━━━━━━━━━━━━━━━━━
👉 *Responda direto aqui no WhatsApp:*
*1* ➔ Publicar no Instagram (programado para às ${preferredTime})
*2* ➔ Publicar imediatamente agora
*3* ➔ Gerar outra opção de tema`;
      } else {
        msg = `⚡ *Post Diário Agendado no Piloto Automático!* (ERBots IA)

📌 *Gancho (${postData.hook_score || 94}/100):*
"${postData.hook_title}"

🎯 *Pilar:* ${rule.pillar} (${formatLabel})
⏰ *Horário de publicação:* Hoje às ${preferredTime.slice(0, 5)}

O post já foi criado e programado sozinho para manter sua conta crescendo! 🚀
Para revisar acesse: ${appUrl}/dashboard?tab=instagram`;
      }

      dispatched = await sendTextMessage(instance.instance_name, targetPhone, msg).catch(() => false);
    }
  }

  return {
    success: true,
    postId: createdPost.id,
    hookTitle: postData.hook_title,
    dispatchedToWhatsApp: dispatched,
  };
}

/**
 * Rotina diária chamada pelo Cron para processar todos os clientes com módulo ativo
 */
export async function runInstagramDailyCron(): Promise<{ checked: number; generated: number }> {
  const db = getServiceSupabase();

  // Busca todas as contas ativas com geração diária habilitada
  const { data: accounts } = await db
    .from('xerb_instagram_accounts')
    .select('id, tenant_id, approval_mode')
    .eq('is_active', true)
    .neq('auto_generate_daily', false);

  if (!accounts || accounts.length === 0) {
    return { checked: 0, generated: 0 };
  }

  // Janela de hoje em fuso de Brasília
  const nowBr = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const todayStart = new Date(nowBr);
  todayStart.setHours(0, 0, 0, 0);

  let generatedCount = 0;

  for (const acc of accounts) {
    try {
      // Verifica se já gerou post hoje para este tenant
      const { data: existingToday } = await db
        .from('xerb_instagram_posts')
        .select('id')
        .eq('tenant_id', acc.tenant_id)
        .gte('created_at', todayStart.toISOString())
        .limit(1);

      if (existingToday && existingToday.length > 0) {
        continue; // Já tem post gerado hoje
      }

      const res = await generateDailyPostForTenant(acc.tenant_id);
      if (res.success) {
        generatedCount++;
      }
    } catch (err) {
      console.warn(`[Instagram Cron] Falha ao processar tenant ${acc.tenant_id}:`, err);
    }
  }

  return { checked: accounts.length, generated: generatedCount };
}
