import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticate } from '@/lib/auth';
import { verifyWebhookToken } from '@/lib/webhook';
import { findHealthyNotifierInstance, normalizeBrPhone, sendTextMessage } from '@/lib/evolution';
import { generateFollowupMessage, isWithinBusinessHours } from '@/lib/ai/gemini';
import { checkAiGate, getUsage, recordUsage } from '@/lib/billing/usage';
import { getAddonsConfig, getPlansConfig } from '@/lib/billing/plans-config';
import { formatBRL } from '@/lib/plans';
import { logSystemEvent } from '@/lib/monitoring';

export const maxDuration = 60;

const HOUR_MS = 60 * 60 * 1000;

function safeSecretEqual(aStr: string, bStr: string): boolean {
  if (!aStr || !bStr) return false;
  const a = Buffer.from(aStr);
  const b = Buffer.from(bStr);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function isAuthorizedCron(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET || process.env.WEBHOOK_SECRET || '';
  const headerSecret = req.headers.get('x-cron-secret') || '';
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

  if (cronSecret && (safeSecretEqual(headerSecret, cronSecret) || safeSecretEqual(bearer, cronSecret))) {
    return true;
  }
  if (verifyWebhookToken(req)) {
    return true;
  }
  const authCtx = await authenticate(req);
  return Boolean(authCtx?.isSuperAdmin);
}

function currentBrtMinutes(): number {
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return nowBR.getHours() * 60 + nowBR.getMinutes();
}

async function processLeadFollowups(supabase: ReturnType<typeof getServiceSupabase>): Promise<{
  checked: number;
  sent: number;
}> {
  const nowMs = Date.now();
  const minCreatedIso = new Date(nowMs - 24 * HOUR_MS).toISOString();
  const maxCreatedIso = new Date(nowMs - 30 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from('xerb_leads')
    .select('id, tenant_id, conversation_id, customer_name, customer_phone, remote_jid, interest, preferred_slot, created_at')
    .eq('status', 'new')
    .is('followup_sent_at', null)
    .not('conversation_id', 'is', null)
    .gte('created_at', minCreatedIso)
    .lte('created_at', maxCreatedIso)
    .order('created_at', { ascending: true })
    .limit(15);

  if (error || !candidates?.length) {
    return { checked: 0, sent: 0 };
  }

  let sentCount = 0;

  for (const lead of candidates) {
    try {
      const [tenantRes, botRes, instRes, convRes] = await Promise.all([
        supabase
          .from('xerb_tenants')
          .select('id, name, plan, subscription_status, trial_ends_at, is_super_admin, extra_ai_credits')
          .eq('id', lead.tenant_id)
          .maybeSingle(),
        supabase.from('xerb_bot_settings').select('*').eq('tenant_id', lead.tenant_id).maybeSingle(),
        supabase
          .from('xerb_instances')
          .select('instance_name, status')
          .eq('tenant_id', lead.tenant_id)
          .eq('status', 'CONNECTED')
          .maybeSingle(),
        supabase
          .from('xerb_conversations')
          .select('id, remote_jid, handling_status, followup_sent_at')
          .eq('id', lead.conversation_id)
          .maybeSingle(),
      ]);

      const tenant = tenantRes.data;
      const bot = botRes.data;
      const inst = instRes.data;
      const conv = convRes.data;

      if (!tenant || !inst?.instance_name || !conv) continue;

      // Se o lojista desativou o robô ou desativou o follow-up automático, marca como dispensado
      if (bot?.is_active === false || bot?.auto_followup_enabled === false) {
        await supabase
          .from('xerb_leads')
          .update({ followup_sent_at: new Date().toISOString() })
          .eq('id', lead.id);
        continue;
      }

      // Não interrompe conversas em atendimento humano
      if (conv.handling_status !== 'AI') continue;

      const delayMinutes = Math.max(30, Number(bot?.auto_followup_delay_minutes) || 180);
      if (nowMs - new Date(lead.created_at).getTime() < delayMinutes * 60_000) {
        continue;
      }

      // Respeita o expediente próprio da empresa (se configurado)
      if (!isWithinBusinessHours(bot?.business_hours)) {
        continue;
      }

      // Confere última mensagem da conversa: só envia se a última mensagem foi da IA e já passou o tempo configurado
      const { data: lastMsgs } = await supabase
        .from('xerb_messages')
        .select('id, sender, content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMsg = lastMsgs?.[0];
      if (!lastMsg) continue;

      if (lastMsg.sender !== 'ai') {
        // Cliente ou humano já interagiu depois: encerra pendência de follow-up deste lead
        if (nowMs - new Date(lead.created_at).getTime() > delayMinutes * 60_000) {
          await supabase
            .from('xerb_leads')
            .update({ followup_sent_at: new Date().toISOString() })
            .eq('id', lead.id);
        }
        continue;
      }

      if (nowMs - new Date(lastMsg.created_at).getTime() < delayMinutes * 60_000) {
        continue;
      }

      const gate = await checkAiGate(supabase, tenant);
      if (!gate.allowed) continue;

      // Trava atômica anti-concorrência
      const nowIso = new Date().toISOString();
      const { data: locked } = await supabase
        .from('xerb_leads')
        .update({ followup_sent_at: nowIso, updated_at: nowIso })
        .eq('id', lead.id)
        .is('followup_sent_at', null)
        .select('id')
        .maybeSingle();

      if (!locked) continue;

      const generated = await generateFollowupMessage({
        companyName: tenant.name,
        botName: bot?.bot_name,
        tone: bot?.tone,
        customerName: lead.customer_name,
        interest: lead.interest,
        preferredSlot: lead.preferred_slot,
        lastAiMessage: lastMsg.content,
      });

      // Insere antes do disparo para o detector de eco (isOwnEcho) reconhecer como mensagem da IA
      const { data: msgRow } = await supabase
        .from('xerb_messages')
        .insert({
          conversation_id: conv.id,
          tenant_id: tenant.id,
          sender: 'ai',
          content: generated.text,
        })
        .select('id')
        .single();

      const targetJid = conv.remote_jid || lead.remote_jid;
      const dispatched = targetJid ? await sendTextMessage(inst.instance_name, targetJid, generated.text) : false;

      if (!dispatched) {
        if (msgRow?.id) await supabase.from('xerb_messages').delete().eq('id', msgRow.id);
        continue;
      }

      sentCount++;
      await supabase
        .from('xerb_conversations')
        .update({
          last_message: generated.text,
          last_message_at: nowIso,
          followup_sent_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', conv.id);

      await recordUsage(supabase, tenant.id, {
        aiReplies: 1,
        tokensIn: generated.tokensIn,
        tokensOut: generated.tokensOut,
        consumeExtraCredit: Boolean(gate.usingExtraCredits),
      });
    } catch (err) {
      console.warn('[Cron Followup] Erro ao processar lead:', lead.id, err);
    }
  }

  return { checked: candidates.length, sent: sentCount };
}

async function processTrialNudges(supabase: ReturnType<typeof getServiceSupabase>): Promise<{
  checked: number;
  sent: number;
}> {
  const brtMins = currentBrtMinutes();
  // Régua de Trial dispara apenas em horário comercial estrito (09:00 às 19:30 BRT)
  if (brtMins < 9 * 60 || brtMins > 19 * 60 + 30) {
    return { checked: 0, sent: 0 };
  }

  const notifier = await findHealthyNotifierInstance();
  if (!notifier) {
    return { checked: 0, sent: 0 };
  }

  const nowMs = Date.now();
  const recentSignupFloor = new Date(nowMs - 14 * 24 * HOUR_MS).toISOString();

  const { data: trials, error } = await supabase
    .from('xerb_tenants')
    .select(
      'id, name, phone, alert_phone, subscription_status, trial_ends_at, created_at, is_super_admin, trial_nudge_stage, trial_nudge_sent_at'
    )
    .eq('subscription_status', 'trialing')
    .eq('is_super_admin', false)
    .gte('created_at', recentSignupFloor)
    .limit(20);

  if (error || !trials?.length) {
    return { checked: 0, sent: 0 };
  }

  const [plansCfg, addonsCfg] = await Promise.all([getPlansConfig(), getAddonsConfig()]);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.erbots.com.br').replace(/\/+$/, '');
  const startPrice = formatBRL(plansCfg.start.price);
  let sentCount = 0;

  for (const t of trials) {
    try {
      const ownerPhone = normalizeBrPhone(t.alert_phone) || normalizeBrPhone(t.phone);
      if (!ownerPhone) continue;

      const lastSentMs = t.trial_nudge_sent_at ? new Date(t.trial_nudge_sent_at).getTime() : 0;
      if (lastSentMs && nowMs - lastSentMs < 18 * HOUR_MS) continue;

      const createdMs = t.created_at ? new Date(t.created_at).getTime() : 0;
      const untilMs = t.trial_ends_at ? new Date(t.trial_ends_at).getTime() : 0;
      const stage = t.trial_nudge_stage || '';

      let nextStage: 'day1_activation' | 'day5_roi' | 'expired' | null = null;
      let messageToSend = '';

      if (untilMs && nowMs > untilMs && nowMs - untilMs <= 72 * HOUR_MS && stage !== 'expired') {
        nextStage = 'expired';
        messageToSend = [
          '⚡ *ERBots – Seu período de teste terminou*',
          '',
          `Olá, *${t.name}*! Seu teste grátis encerrou e o atendente virtual pausou as respostas no WhatsApp.`,
          '',
          `Todo o treinamento da sua IA continua salvo! Ative seu plano a partir de *${startPrice}/mês* (ou economize *${addonsCfg.annualDiscountPercent}% no plano anual*) em 1 minuto:`,
          `👉 ${appUrl}/dashboard`,
        ].join('\n');
      } else if (
        untilMs &&
        untilMs > nowMs &&
        untilMs - nowMs <= 54 * HOUR_MS &&
        stage !== 'day5_roi' &&
        stage !== 'expired'
      ) {
        nextStage = 'day5_roi';
        const [usage, leadsCountRes] = await Promise.all([
          getUsage(supabase, t.id),
          supabase.from('xerb_leads').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
        ]);
        const replies = usage.ai_replies || 0;
        const leadsCaptured = leadsCountRes.count || 0;
        const roiLine =
          replies > 0
            ? `Sua IA já realizou *${replies} resposta(s) automática(s)*${
                leadsCaptured > 0 ? ` e capturou *${leadsCaptured} oportunidade(s)*` : ''
              } para sua empresa!`
            : 'Você ainda tem 2 dias para testar sua atendente virtual 24h com seus clientes!';

        messageToSend = [
          '⏳ *ERBots – Faltam 2 dias para o fim do seu Teste Grátis*',
          '',
          `Olá, *${t.name}*! ${roiLine}`,
          '',
          `Para manter seu WhatsApp respondendo 24/7 sem interrupção (a partir de *${startPrice}/mês* ou com *${addonsCfg.annualDiscountPercent}% OFF no anual*), garanta seu plano no painel:`,
          `👉 ${appUrl}/dashboard`,
        ].join('\n');
      } else if (!stage && createdMs && nowMs - createdMs >= 20 * HOUR_MS && nowMs - createdMs <= 60 * HOUR_MS) {
        const { data: inst } = await supabase
          .from('xerb_instances')
          .select('status')
          .eq('tenant_id', t.id)
          .maybeSingle();

        nextStage = 'day1_activation';
        if (inst?.status !== 'CONNECTED') {
          messageToSend = [
            '🚀 *ERBots – Ative sua IA no WhatsApp em 2 minutos*',
            '',
            `Olá, *${t.name}*! Notamos que sua conta já está pronta, mas o WhatsApp ainda não foi conectado.`,
            '',
            'Você pode colar o link do seu site/cardápio para treinar a IA em 1 clique e ler o QR Code agora mesmo:',
            `👉 ${appUrl}/dashboard`,
          ].join('\n');
        }
      }

      if (!nextStage) continue;

      const nowIso = new Date().toISOString();
      await supabase
        .from('xerb_tenants')
        .update({ trial_nudge_stage: nextStage, trial_nudge_sent_at: nowIso, updated_at: nowIso })
        .eq('id', t.id);

      if (messageToSend) {
        const ok = await sendTextMessage(notifier, ownerPhone, messageToSend).catch(() => false);
        if (ok) sentCount++;
      }
    } catch (err) {
      console.warn('[Cron Trial Nudge] Erro no tenant:', t.id, err);
    }
  }

  return { checked: trials.length, sent: sentCount };
}

async function handleCron(req: NextRequest) {
  try {
    if (!(await isAuthorizedCron(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brtMins = currentBrtMinutes();
    // Janela respeitosa de envio no Brasil: 08:30 às 20:30 (Horário de Brasília)
    if (brtMins < 8 * 60 + 30 || brtMins > 20 * 60 + 30) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'outside_commercial_window_brt',
      });
    }

    const supabase = getServiceSupabase();
    const [followups, trialNudges] = await Promise.all([
      processLeadFollowups(supabase),
      processTrialNudges(supabase),
    ]);

    if (followups.sent > 0 || trialNudges.sent > 0) {
      await logSystemEvent({
        level: 'info',
        source: 'cron.automations',
        message: `Automações executadas: ${followups.sent} follow-up(s) e ${trialNudges.sent} aviso(s) de trial enviados.`,
        metadata: { followups, trialNudges },
      });
    }

    return NextResponse.json({
      success: true,
      followups,
      trialNudges,
    });
  } catch (err: any) {
    console.error('[Cron Automations] Erro:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}
