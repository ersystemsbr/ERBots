import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import {
  sendTextMessage,
  getMediaBase64,
  normalizeBrPhone,
  parseWhatsAppAddress,
  tryReconnectInstance,
  findHealthyNotifierInstance,
} from '@/lib/evolution';
import { processAIMessage, transcribeMedia, CapturedLead } from '@/lib/ai/gemini';
import { verifyWebhookToken } from '@/lib/webhook';
import { checkAiGate, recordUsage } from '@/lib/billing/usage';
import { getAddonsConfig, getPlansConfig } from '@/lib/billing/plans-config';
import { currentUsagePeriod, formatBRL, getPlan, computeAnnualPricing } from '@/lib/plans';
import { logSystemEvent } from '@/lib/monitoring';

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Parâmetros de comportamento do atendimento
// ---------------------------------------------------------------------------
/** Espera para agrupar mensagens seguidas do cliente em UMA resposta */
const DEBOUNCE_MS = 2500;
/** Janela para reconhecer o "eco" de mensagens que o próprio sistema enviou */
const ECHO_WINDOW_MS = 2 * 60 * 1000;
const ECHO_RECHECK_MS = 1500;
/** Após esse tempo sem nenhuma resposta (humano/IA), a conversa volta automaticamente para a IA */
const HUMAN_TIMEOUT_HOURS = 12;
/** Mensagem de "fora do horário" é enviada no máximo 1x neste intervalo, por conversa */
const OUT_OF_HOURS_COOLDOWN_HOURS = 6;
const MAX_AUDIO_SECONDS = 180;
const MAX_MEDIA_BASE64_CHARS = 14_000_000; // ~10 MB

type Db = ReturnType<typeof getServiceSupabase>;

/** Vira false se o SQL database/ai_quality.sql ainda não foi aplicado (sem dedupe por ID). */
let waIdSupported = true;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HOUR_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Extração do conteúdo da mensagem
// ---------------------------------------------------------------------------
type Content =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; seconds: number; mimeType: string }
  | { kind: 'image'; caption: string; mimeType: string }
  | { kind: 'document'; fileName: string; caption: string; mimeType: string }
  | { kind: 'media_notice'; label: string }
  | { kind: 'ignored' };

function unwrapMessage(raw: any): any {
  let cur = raw;
  for (let i = 0; i < 3 && cur; i++) {
    const inner =
      cur.ephemeralMessage?.message ||
      cur.viewOnceMessage?.message ||
      cur.viewOnceMessageV2?.message ||
      cur.documentWithCaptionMessage?.message ||
      cur.editedMessage?.message;
    if (!inner) break;
    cur = inner;
  }
  return cur;
}

function extractContent(raw: any): Content {
  const m = unwrapMessage(raw);
  if (!m) return { kind: 'ignored' };

  const text =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    '';
  if (text) return { kind: 'text', text: String(text) };

  if (m.audioMessage) {
    return {
      kind: 'audio',
      seconds: Number(m.audioMessage.seconds) || 0,
      mimeType: String(m.audioMessage.mimetype || 'audio/ogg').split(';')[0],
    };
  }
  if (m.imageMessage) {
    return {
      kind: 'image',
      caption: String(m.imageMessage.caption || ''),
      mimeType: String(m.imageMessage.mimetype || 'image/jpeg').split(';')[0],
    };
  }
  if (m.documentMessage) {
    const fileName = String(m.documentMessage.fileName || m.documentMessage.title || 'arquivo').slice(0, 120);
    return {
      kind: 'document',
      fileName,
      caption: String(m.documentMessage.caption || ''),
      mimeType: String(m.documentMessage.mimetype || 'application/octet-stream').split(';')[0],
    };
  }
  if (m.videoMessage) {
    const cap = String(m.videoMessage.caption || '').trim();
    return { kind: 'media_notice', label: `🎥 [Vídeo recebido]${cap ? ` ${cap}` : ''}` };
  }
  if (m.locationMessage || m.liveLocationMessage) {
    const loc = m.locationMessage || m.liveLocationMessage;
    const locName = String(loc?.name || loc?.address || '').trim();
    return { kind: 'media_notice', label: `📍 [Localização compartilhada${locName ? `: ${locName}` : ''}]` };
  }
  if (m.contactMessage || m.contactsArrayMessage) {
    const cname = String(m.contactMessage?.displayName || '').trim();
    return { kind: 'media_notice', label: `👤 [Contato compartilhado${cname ? `: ${cname}` : ''}]` };
  }
  return { kind: 'ignored' };
}

function samePhone(a?: string | null, b?: string | null): boolean {
  const da = (a || '').replace(/\D/g, '');
  const db = (b || '').replace(/\D/g, '');
  if (da.length < 8 || db.length < 8) return false;
  // Compara os 8 últimos dígitos (tolera diferença do 9º dígito dos celulares BR)
  return da.slice(-8) === db.slice(-8);
}

// ---------------------------------------------------------------------------
// Persistência de mensagens (com deduplicação opcional por ID do WhatsApp)
// ---------------------------------------------------------------------------
async function isDuplicate(db: Db, tenantId: string, waId?: string | null): Promise<boolean> {
  if (!waId || !waIdSupported) return false;
  const { data, error } = await db
    .from('xerb_messages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('wa_message_id', waId)
    .limit(1)
    .maybeSingle();
  if (error) {
    if (/wa_message_id/i.test(error.message || '') || (error as any).code === '42703') waIdSupported = false;
    return false;
  }
  return Boolean(data);
}

/** Retorna o id da mensagem, 'DUPLICATE' (ID já processado) ou null (falha). */
async function insertMessage(
  db: Db,
  row: Record<string, any>,
  waId?: string | null
): Promise<string | 'DUPLICATE' | null> {
  if (waId && waIdSupported) {
    const { data, error } = await db
      .from('xerb_messages')
      .insert({ ...row, wa_message_id: waId })
      .select('id')
      .single();
    if (!error) return data?.id || null;
    if ((error as any).code === '23505') return 'DUPLICATE';
    if (/wa_message_id/i.test(error.message || '') || ['42703', 'PGRST204'].includes((error as any).code)) {
      waIdSupported = false; // coluna ainda não existe: segue sem dedupe
    } else {
      console.error('[Webhook] Erro ao salvar mensagem:', error);
      return null;
    }
  }
  const { data, error } = await db.from('xerb_messages').insert(row).select('id').single();
  if (error) {
    console.error('[Webhook] Erro ao salvar mensagem:', error);
    return null;
  }
  return data?.id || null;
}

/** A mensagem fromMe recente é "eco" de algo que NÓS enviamos (IA ou painel)? */
async function isOwnEcho(db: Db, conversationId: string, text: string): Promise<boolean> {
  const since = new Date(Date.now() - ECHO_WINDOW_MS).toISOString();
  const { data } = await db
    .from('xerb_messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .in('sender', ['ai', 'human'])
    .eq('content', text)
    .gte('created_at', since)
    .limit(1);
  return Boolean(data && data.length);
}

// ---------------------------------------------------------------------------
// Registro de Oportunidades (xerb_leads) e avisos ao dono no WhatsApp
// ---------------------------------------------------------------------------
async function persistCapturedLead(
  db: Db,
  params: {
    tenantId: string;
    conversationId: string;
    customerName: string;
    cleanPhone: string;
    remoteJid: string;
    lead: CapturedLead;
  }
): Promise<{ saved: boolean; shouldNotify: boolean }> {
  try {
    const sinceIso = new Date(Date.now() - 2 * HOUR_MS).toISOString();
    const nowIso = new Date().toISOString();

    const { data: existing, error: selErr } = await db
      .from('xerb_leads')
      .select('id, customer_name, interest, preferred_slot, notes')
      .eq('tenant_id', params.tenantId)
      .eq('conversation_id', params.conversationId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selErr) {
      console.warn('[Webhook] Aviso ao consultar xerb_leads:', selErr.message);
      return { saved: false, shouldNotify: false };
    }

    const finalName =
      params.lead.customerName || params.customerName || params.cleanPhone;

    if (existing) {
      const changed =
        existing.interest !== params.lead.interest ||
        Boolean(params.lead.preferredSlot && existing.preferred_slot !== params.lead.preferredSlot);

      await db
        .from('xerb_leads')
        .update({
          customer_name: finalName || existing.customer_name,
          customer_phone: params.cleanPhone,
          interest: params.lead.interest,
          preferred_slot: params.lead.preferredSlot || existing.preferred_slot || null,
          notes: params.lead.notes || existing.notes || null,
          updated_at: nowIso,
        })
        .eq('id', existing.id);

      return { saved: true, shouldNotify: changed };
    }

    const { error: insErr } = await db.from('xerb_leads').insert({
      tenant_id: params.tenantId,
      conversation_id: params.conversationId,
      customer_name: finalName,
      customer_phone: params.cleanPhone,
      remote_jid: params.remoteJid,
      interest: params.lead.interest,
      preferred_slot: params.lead.preferredSlot || null,
      notes: params.lead.notes || null,
      status: 'new',
    });

    if (insErr) {
      console.warn('[Webhook] Erro ao inserir em xerb_leads:', insErr.message);
      return { saved: false, shouldNotify: false };
    }
    return { saved: true, shouldNotify: true };
  } catch (err) {
    console.warn('[Webhook] Exceção ao registrar lead:', err);
    return { saved: false, shouldNotify: false };
  }
}

async function notifyOwner(args: {
  instanceName: string;
  tenant: { phone?: string | null; alert_phone?: string | null; name?: string | null };
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  handoff: boolean;
  lead?: CapturedLead;
  conversationId?: string;
}) {
  try {
    const owner = normalizeBrPhone(args.tenant.alert_phone) || normalizeBrPhone(args.tenant.phone);
    if (!owner || samePhone(owner, args.customerPhone)) return;

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.erbots.com.br').replace(/\/+$/, '');
    const isLid = args.customerPhone.startsWith('LID:');
    const phoneDigits = args.customerPhone.replace(/\D/g, '');
    const phoneDisplay = isLid ? args.customerPhone : `+${phoneDigits || args.customerPhone}`;
    const waLink = !isLid && phoneDigits.length >= 10 ? `https://wa.me/${phoneDigits}` : '';
    const displayName = args.lead?.customerName || args.customerName || args.customerPhone;
    const chatLink = args.conversationId
      ? `${appUrl}/dashboard?tab=chat&chat=${encodeURIComponent(args.conversationId)}`
      : `${appUrl}/dashboard?tab=chat`;

    if (args.lead) {
      const header = args.handoff
        ? '🎯 *ERBots – Oportunidade + Confirmação Humana*'
        : '🎯 *ERBots – Nova Oportunidade Capturada*';

      const lines = [
        header,
        '',
        `👤 Cliente: *${displayName}* (${phoneDisplay})`,
        `💼 Interesse: *${args.lead.interest}*`,
      ];
      if (args.lead.preferredSlot) lines.push(`📅 Preferência: *${args.lead.preferredSlot}*`);
      if (args.lead.notes) lines.push(`📝 Obs: ${args.lead.notes}`);
      if (waLink) lines.push('', `📲 Chamar cliente no WhatsApp: ${waLink}`);
      lines.push(`💬 Abrir no LiveChat do Painel: ${chatLink}`);
      if (args.handoff) {
        lines.push(
          '',
          `⏸️ A IA pausou nesta conversa para sua confirmação (retoma sozinha após ${HUMAN_TIMEOUT_HOURS}h sem resposta).`
        );
      }

      await sendTextMessage(args.instanceName, owner, lines.join('\n'));
      return;
    }

    if (args.handoff) {
      const preview = args.lastMessage.length > 220 ? `${args.lastMessage.slice(0, 220)}…` : args.lastMessage;
      const lines = [
        '🔔 *ERBots – Atendimento Humano Solicitado*',
        '',
        `👤 Cliente: *${displayName}* (${phoneDisplay})`,
        `💬 Mensagem: "${preview}"`,
      ];
      if (waLink) lines.push('', `📲 Chamar cliente no WhatsApp: ${waLink}`);
      lines.push(`💬 Assumir no LiveChat do Painel: ${chatLink}`);
      lines.push(
        '',
        `⏸️ A IA está pausada nesta conversa. Responda direto pelo WhatsApp ou pelo LiveChat.`,
        `(Se ninguém responder em ${HUMAN_TIMEOUT_HOURS}h, a IA volta a atender sozinha.)`
      );
      await sendTextMessage(args.instanceName, owner, lines.join('\n'));
    }
  } catch (err) {
    console.warn('[Webhook] Falha ao avisar o dono:', err);
  }
}

// ---------------------------------------------------------------------------
// Mensagem enviada pelo próprio dono (celular) → pausa a IA nessa conversa
// ---------------------------------------------------------------------------
async function handleOwnerMessage(
  db: Db,
  params: { tenant: any; tenantId: string; remoteJid: string; cleanPhone: string; waId?: string | null; content: Content }
) {
  const { tenant, tenantId, remoteJid, cleanPhone, waId, content } = params;

  // Mensagens para o próprio número do dono / alerta (ex.: avisos de transbordo) não são conversas de cliente
  if (
    !cleanPhone.startsWith('LID:') &&
    (samePhone(cleanPhone, normalizeBrPhone(tenant.phone)) ||
      samePhone(cleanPhone, normalizeBrPhone(tenant.alert_phone)))
  ) {
    return NextResponse.json({ skipped: true, reason: 'owner self chat' });
  }

  let text = '';
  if (content.kind === 'text') text = content.text.trim();
  else if (content.kind === 'media_notice') text = content.label;
  else if (content.kind === 'document') text = `📎 [Documento enviado pelo atendente: ${content.fileName}]`;
  else if (content.kind === 'audio' || content.kind === 'image') text = '📎 [Mídia enviada pelo atendente]';
  if (!text) return NextResponse.json({ skipped: true, reason: 'fromMe ignored' });

  // Ecos de alertas automáticos da plataforma (régua de trial, queda, franquia) não abrem conversa humana
  if (/^(?:⚠️|🚀|⏳|⚡|📈|🔔|🎯)\s*\*ERBots\b/.test(text)) {
    return NextResponse.json({ skipped: true, reason: 'system alert echo' });
  }

  if (await isDuplicate(db, tenantId, waId)) {
    return NextResponse.json({ skipped: true, reason: 'duplicate' });
  }

  const findConv = async () => {
    const { data } = await db
      .from('xerb_conversations')
      .select('id, handling_status')
      .eq('tenant_id', tenantId)
      .eq('remote_jid', remoteJid)
      .maybeSingle();
    return data;
  };

  let conv = await findConv();
  if (conv && (await isOwnEcho(db, conv.id, text))) {
    return NextResponse.json({ skipped: true, reason: 'own echo' });
  }

  // Dá tempo de a rota que enviou (painel/IA) gravar a mensagem e confere de novo
  await sleep(ECHO_RECHECK_MS);
  conv = await findConv();
  if (conv && (await isOwnEcho(db, conv.id, text))) {
    return NextResponse.json({ skipped: true, reason: 'own echo' });
  }

  const nowIso = new Date().toISOString();
  if (!conv) {
    // O dono iniciou a conversa pelo celular: já nasce em modo humano (a IA não interrompe)
    const { data: created } = await db
      .from('xerb_conversations')
      .insert({
        tenant_id: tenantId,
        remote_jid: remoteJid,
        contact_name: cleanPhone,
        contact_phone: cleanPhone,
        handling_status: 'HUMAN',
        last_message: text,
        last_message_at: nowIso,
        unread_count: 0,
      })
      .select('id, handling_status')
      .single();
    conv = created;
  } else {
    await db
      .from('xerb_conversations')
      .update({ handling_status: 'HUMAN', last_message: text, last_message_at: nowIso, updated_at: nowIso })
      .eq('id', conv.id);
  }

  if (!conv) return NextResponse.json({ error: 'Failed to record owner message' }, { status: 500 });

  await insertMessage(db, { conversation_id: conv.id, tenant_id: tenantId, sender: 'human', content: text }, waId);
  return NextResponse.json({ success: true, ownerReplied: true, aiPaused: true });
}

// ---------------------------------------------------------------------------
// Webhook principal
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // Segurança: só aceita chamadas da Evolution API com o token secreto do webhook
    if (!verifyWebhookToken(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const rawEvent = (payload.event || '').toLowerCase();
    const instanceName = payload.instance || '';

    if (!instanceName) {
      return NextResponse.json({ skipped: true, reason: 'No instance provided' });
    }

    const supabase = getServiceSupabase();

    // 1. Trata evento de conexão (CONNECTION_UPDATE) com reconexão suave + alerta de queda
    if (rawEvent.includes('connection')) {
      const state = payload.data?.state || payload.state;
      const statusReason = Number(payload.data?.statusReason || 0);
      const statusMap: Record<string, string> = {
        open: 'CONNECTED',
        connecting: 'CONNECTING',
        close: 'DISCONNECTED',
      };
      const mappedStatus = statusMap[state] || 'DISCONNECTED';
      const nowIso = new Date().toISOString();

      const { data: instRow } = await supabase
        .from('xerb_instances')
        .select('id, tenant_id, instance_name, status, last_connected_at, last_disconnect_alert_at, intentional_logout')
        .eq('instance_name', instanceName)
        .maybeSingle();

      if (!instRow) {
        return NextResponse.json({ skipped: true, reason: 'Instance not managed by ERBots' });
      }

      if (mappedStatus === 'CONNECTED') {
        await supabase
          .from('xerb_instances')
          .update({
            status: 'CONNECTED',
            last_connected_at: nowIso,
            disconnected_at: null,
            intentional_logout: false,
            updated_at: nowIso,
          })
          .eq('id', instRow.id);

        if (instRow.status === 'DISCONNECTED' && instRow.last_connected_at) {
          await logSystemEvent({
            level: 'info',
            source: 'whatsapp.reconnected',
            message: `Instância ${instanceName} voltou a ficar online.`,
            tenantId: instRow.tenant_id,
            metadata: { instanceName },
          });
        }
        return NextResponse.json({ success: true, event: 'connection.update', status: 'CONNECTED' });
      }

      if (mappedStatus === 'CONNECTING') {
        await supabase
          .from('xerb_instances')
          .update({ status: 'CONNECTING', updated_at: nowIso })
          .eq('id', instRow.id);
        return NextResponse.json({ success: true, event: 'connection.update', status: 'CONNECTING' });
      }

      // Estado: DISCONNECTED (close)
      // Se foi logout intencional pelo painel ou nunca esteve conectado (ex.: QR expirado), apenas registra
      if (instRow.intentional_logout || !instRow.last_connected_at) {
        await supabase
          .from('xerb_instances')
          .update({ status: 'DISCONNECTED', updated_at: nowIso })
          .eq('id', instRow.id);
        return NextResponse.json({ success: true, event: 'connection.update', status: 'DISCONNECTED' });
      }

      // Se não foi revogado no celular (statusReason !== 401), tenta reconexão suave antes de alarmar
      if (statusReason !== 401) {
        await sleep(2500);
        const recovered = await tryReconnectInstance(instanceName);
        if (recovered === 'open') {
          await supabase
            .from('xerb_instances')
            .update({
              status: 'CONNECTED',
              last_connected_at: new Date().toISOString(),
              disconnected_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', instRow.id);
          return NextResponse.json({ success: true, event: 'connection.update', autoReconnected: true });
        }
      }

      // Permaneceu desconectado: atualiza banco, grava alerta em xerb_system_logs e avisa o dono (cooldown 4h)
      await supabase
        .from('xerb_instances')
        .update({
          status: 'DISCONNECTED',
          disconnected_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', instRow.id);

      const { data: tenantInfo } = await supabase
        .from('xerb_tenants')
        .select('id, name, email, phone, alert_phone')
        .eq('id', instRow.tenant_id)
        .maybeSingle();

      await logSystemEvent({
        level: 'warn',
        source: 'whatsapp.disconnect',
        message: `WhatsApp desconectado (${tenantInfo?.name || instanceName})`,
        tenantId: instRow.tenant_id,
        metadata: { instanceName, statusReason },
      });

      const DISCONNECT_ALERT_COOLDOWN_MS = 4 * HOUR_MS;
      const lastAlertMs = instRow.last_disconnect_alert_at ? new Date(instRow.last_disconnect_alert_at).getTime() : 0;

      if (!lastAlertMs || Date.now() - lastAlertMs > DISCONNECT_ALERT_COOLDOWN_MS) {
        await supabase
          .from('xerb_instances')
          .update({ last_disconnect_alert_at: nowIso })
          .eq('id', instRow.id);

        const ownerPhone = normalizeBrPhone(tenantInfo?.alert_phone) || normalizeBrPhone(tenantInfo?.phone);
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.erbots.com.br').replace(/\/+$/, '');
        const notifier = await findHealthyNotifierInstance(instanceName);

        if (ownerPhone && notifier) {
          const alertMsg = [
            '⚠️ *ERBots – Alerta de Desconexão*',
            '',
            `O WhatsApp comercial da empresa *${tenantInfo?.name || 'sua conta'}* desconectou e o atendimento automático foi pausado.`,
            '',
            `Acesse o painel para ler o QR Code e reconectar em segundos: ${appUrl}/dashboard`,
          ].join('\n');
          await sendTextMessage(notifier, ownerPhone, alertMsg).catch(() => false);
        }

        // Caso de Atenção para o Super Admin (Eric)
        const { data: sysAlertCfg } = await supabase
          .from('xerb_system_config')
          .select('value')
          .eq('key', 'system_alert_phone')
          .maybeSingle();
        const adminAlertPhone = normalizeBrPhone(sysAlertCfg?.value);
        if (adminAlertPhone && notifier && !samePhone(adminAlertPhone, ownerPhone)) {
          const sysMsg = [
            '🛡️ *[Guardião ERBots] Caso de Atenção no Sistema*',
            '',
            `A empresa *${tenantInfo?.name || 'Cliente'}* desconectou o WhatsApp.`,
            `Instância: *${instanceName}*`,
            `Status: ${statusReason || 'close'}`,
            '',
            `O cliente foi notificado no número dele. Acompanhe pelo painel: ${appUrl}/admin`,
          ].join('\n');
          await sendTextMessage(notifier, adminAlertPhone, sysMsg).catch(() => false);
        }

        // E-mail opcional via Resend caso RESEND_API_KEY esteja configurada
        const resendKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.ALERT_FROM_EMAIL || 'ERBots <alertas@erbots.com.br>';
        if (resendKey && tenantInfo?.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [tenantInfo.email],
              subject: `⚠️ WhatsApp desconectado — ${tenantInfo.name || 'ERBots'}`,
              html: `<p>Olá, <strong>${tenantInfo.name || ''}</strong>!</p><p>Detectamos que o WhatsApp conectado ao seu ERBots perdeu a sessão e o robô pausou as respostas.</p><p><a href="${appUrl}/dashboard">Clique aqui para abrir o painel e reconectar</a>.</p>`,
            }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
        }
      }

      return NextResponse.json({ success: true, event: 'connection.update', status: 'DISCONNECTED', alerted: true });
    }

    // 2. Filtra apenas eventos de mensagem (MESSAGES_UPSERT)
    if (!rawEvent.includes('message')) {
      return NextResponse.json({ skipped: true, reason: 'Ignored non-message event' });
    }

    const data = payload.data || {};
    const key = data.key || {};
    const message = data.message;
    const pushName = data.pushName || '';
    const waId: string | null = key.id || null;

    const rawRemoteJid = String(key.remoteJid || '').trim();
    if (!rawRemoteJid || rawRemoteJid.includes('@g.us') || rawRemoteJid.includes('@broadcast')) {
      return NextResponse.json({ skipped: true, reason: 'Group or broadcast' });
    }

    const content = extractContent(message);
    if (content.kind === 'ignored') {
      return NextResponse.json({ skipped: true, reason: 'Unsupported message type' });
    }

    // 3. Localiza a instância e o Tenant correspondente
    const { data: instanceRow } = await supabase
      .from('xerb_instances')
      .select('id, tenant_id, instance_name, status')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (!instanceRow || !instanceRow.tenant_id) {
      console.warn(`[Webhook] Instância '${instanceName}' não encontrada na base do ERBots.`);
      return NextResponse.json({ skipped: true, reason: 'Instance not found' });
    }

    const tenantId = instanceRow.tenant_id;
    const { remoteJid, contactPhone: cleanPhone } = parseWhatsAppAddress(key, data);

    // Busca dados do tenant, bot_settings, knowledge_base e tabela de planos vigente
    const [tenantRes, botSettingsRes, kbRes, plansCfg] = await Promise.all([
      supabase
        .from('xerb_tenants')
        .select(
          'id, name, segment, phone, alert_phone, plan, subscription_status, trial_ends_at, is_super_admin, extra_ai_credits, quota_alert_period'
        )
        .eq('id', tenantId)
        .single(),
      supabase.from('xerb_bot_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('xerb_knowledge_base').select('category, title, content').eq('tenant_id', tenantId).eq('is_active', true),
      getPlansConfig(),
    ]);

    const tenant = tenantRes.data;
    if (!tenant) {
      return NextResponse.json({ skipped: true, reason: 'Tenant not found' });
    }

    // 3.1 Mensagem enviada pelo próprio número conectado (dono respondendo pelo celular, eco do painel/IA)
    if (key.fromMe) {
      return await handleOwnerMessage(supabase, { tenant, tenantId, remoteJid, cleanPhone, waId, content });
    }

    // 3.2 Idempotência: a Evolution pode reenviar o mesmo webhook
    if (await isDuplicate(supabase, tenantId, waId)) {
      return NextResponse.json({ skipped: true, reason: 'duplicate' });
    }

    const botSettings = botSettingsRes.data || {
      bot_name: 'Atendente Virtual',
      tone: 'friendly',
      is_active: true,
      human_handoff_enabled: true,
    };
    const rawKb = kbRes.data || [];
    let knowledgeBase = rawKb;

    // Se for o bot oficial da ER Systems (Super Admin), garante sincronização dinâmica dos planos com plans_config
    if (tenant.is_super_admin) {
      const discount = (await getAddonsConfig()).annualDiscountPercent || 20;
      knowledgeBase = rawKb.map((item: any) => {
        if (item.title === 'Plano Start') {
          return {
            ...item,
            content: `Ideal para autônomos, consultórios e pequenos negócios. Valor: ${formatBRL(plansCfg.start.price)}/mês (ou ${formatBRL(computeAnnualPricing(plansCfg.start.price, discount).monthlyEquivalent)}/mês no plano anual com ${discount}% OFF). Inclui: 1 conexão de WhatsApp, até ${plansCfg.start.monthlyAiReplies.toLocaleString('pt-BR')} respostas de IA por mês, atendente IA Gemini 24/7, base de conhecimento (FAQ e serviços), personalização de tom de voz, horário de atendimento e suporte via WhatsApp.`
          };
        }
        if (item.title === 'Plano Pro') {
          return {
            ...item,
            content: `O mais escolhido por empresas que buscam automação e controle. Valor: ${formatBRL(plansCfg.pro.price)}/mês (ou ${formatBRL(computeAnnualPricing(plansCfg.pro.price, discount).monthlyEquivalent)}/mês no plano anual com ${discount}% OFF). Inclui: 1 conexão de WhatsApp, até ${plansCfg.pro.monthlyAiReplies.toLocaleString('pt-BR')} respostas de IA por mês, base de conhecimento ilimitada, transbordo humano inteligente, Live Chat / CRM em tempo real, histórico completo e suporte prioritário.`
          };
        }
        if (item.title === 'Plano Business') {
          return {
            ...item,
            content: `Para empresas maiores, clínicas de alto fluxo e operações intensas. Valor: ${formatBRL(plansCfg.business.price)}/mês (ou ${formatBRL(computeAnnualPricing(plansCfg.business.price, discount).monthlyEquivalent)}/mês no plano anual com ${discount}% OFF). Inclui: 1 conexão de WhatsApp, até ${plansCfg.business.monthlyAiReplies.toLocaleString('pt-BR')} respostas de IA por mês, IA com ajuste fino de prompts complexos, transbordo com roteamento de equipe, treinamento e setup assistido, e gerente de contas dedicado.`
          };
        }
        return item;
      });
    }

    // 3.3 Portão de monetização (assinatura/trial vigente + limite mensal do plano)
    const gate = await checkAiGate(supabase, tenant);
    const canUseAI = gate.allowed && botSettings.is_active !== false;

    // 4. Texto da mensagem (áudio, imagem e PDF são interpretados pelo Gemini; outros arquivos aparecem no LiveChat)
    let userText = '';
    let mediaFailed = false;

    if (content.kind === 'text') {
      userText = content.text.trim();
    } else if (content.kind === 'media_notice') {
      userText = content.label;
    } else if (content.kind === 'document' && content.mimeType !== 'application/pdf') {
      userText = `📄 [Documento recebido: ${content.fileName}]${content.caption ? ` ${content.caption}` : ''}`;
    } else if (!canUseAI) {
      if (content.kind === 'audio') userText = '🎤 [Áudio recebido]';
      else if (content.kind === 'document') {
        userText = `📄 [PDF recebido: ${content.fileName}]${content.caption ? ` ${content.caption}` : ''}`;
      } else {
        userText = `🖼️ [Imagem recebida]${content.caption ? ` ${content.caption}` : ''}`;
      }
    } else if (content.kind === 'audio' && content.seconds > MAX_AUDIO_SECONDS) {
      userText = '🎤 [Áudio muito longo]';
      mediaFailed = true;
    } else {
      const media = (data.message?.base64
        ? { base64: String(data.message.base64), mimeType: content.mimeType }
        : await getMediaBase64(instanceName, { id: key.id, remoteJid: rawRemoteJid, fromMe: false })) as
        | { base64: string; mimeType: string }
        | null;

      const tooBig = media ? media.base64.length > MAX_MEDIA_BASE64_CHARS : false;
      const result =
        media && !tooBig
          ? await transcribeMedia({
              kind: content.kind,
              base64: media.base64,
              mimeType: media.mimeType || content.mimeType,
              caption: content.kind === 'image' || content.kind === 'document' ? content.caption : undefined,
              fileName: content.kind === 'document' ? content.fileName : undefined,
            })
          : null;

      if (result) {
        await recordUsage(supabase, tenantId, { tokensIn: result.tokensIn, tokensOut: result.tokensOut });
        if (content.kind === 'audio') {
          userText = `🎤 ${result.text}`;
        } else if (content.kind === 'document') {
          userText = `📄 [PDF ${content.fileName}: ${result.text}]${content.caption ? ` Legenda: ${content.caption}` : ''}`;
        } else {
          userText = `🖼️ [Imagem: ${result.text}]${content.caption ? ` Legenda: ${content.caption}` : ''}`;
        }
      } else if (content.kind === 'document') {
        userText = `📄 [PDF recebido: ${content.fileName}]${content.caption ? ` ${content.caption}` : ''}`;
      } else {
        userText = content.kind === 'audio' ? '🎤 [Áudio não pôde ser interpretado]' : '🖼️ [Imagem recebida]';
        mediaFailed = content.kind === 'audio';
        // Imagem sem interpretação: segue só com a legenda, se houver
        if (content.kind === 'image' && content.caption) userText = `🖼️ [Imagem] ${content.caption}`;
      }
    }

    if (!userText) {
      return NextResponse.json({ skipped: true, reason: 'No text extracted' });
    }

    // 5. Cria ou recupera a Conversa no banco (tolerante a concorrência no primeiro contato)
    let { data: conversation } = await supabase
      .from('xerb_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('remote_jid', remoteJid)
      .maybeSingle();

    if (!conversation) {
      const nowIso = new Date().toISOString();
      const { data: newConv, error: convErr } = await supabase
        .from('xerb_conversations')
        .insert({
          tenant_id: tenantId,
          remote_jid: remoteJid,
          contact_name: pushName || cleanPhone,
          contact_phone: cleanPhone,
          handling_status: 'AI',
          last_message: userText,
          last_message_at: nowIso,
          unread_count: 1,
        })
        .select()
        .single();

      if (convErr && (convErr as any).code === '23505') {
        const { data: racedConv } = await supabase
          .from('xerb_conversations')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('remote_jid', remoteJid)
          .maybeSingle();
        conversation = racedConv;
      } else if (convErr) {
        console.error('[Webhook] Erro ao criar conversa:', convErr);
      } else {
        conversation = newConv;
      }
    } else {
      await supabase
        .from('xerb_conversations')
        .update({
          contact_name: pushName || conversation.contact_name,
          contact_phone:
            cleanPhone && !cleanPhone.startsWith('LID:') ? cleanPhone : conversation.contact_phone || cleanPhone,
          last_message: userText,
          last_message_at: new Date().toISOString(),
          unread_count: (conversation.unread_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Failed to find or create conversation' }, { status: 500 });
    }

    // 6. Salva a mensagem recebida (sempre: o dono vê no painel)
    const userMsgId = await insertMessage(
      supabase,
      { conversation_id: conversation.id, tenant_id: tenantId, sender: 'user', content: userText },
      waId
    );
    if (userMsgId === 'DUPLICATE') {
      return NextResponse.json({ skipped: true, reason: 'duplicate' });
    }
    await recordUsage(supabase, tenantId, { messagesIn: 1 });

    // 7. Conversa com atendente humano: a IA NÃO responde (até o dono devolver ou o prazo vencer)
    if (conversation.handling_status === 'HUMAN') {
      const { data: lastOut } = await supabase
        .from('xerb_messages')
        .select('created_at')
        .eq('conversation_id', conversation.id)
        .in('sender', ['ai', 'human'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const fallbackAnchor = conversation.updated_at || conversation.created_at;
      const lastOutAt = lastOut?.created_at
        ? new Date(lastOut.created_at).getTime()
        : fallbackAnchor
        ? new Date(fallbackAnchor).getTime()
        : 0;
      if (lastOutAt && Date.now() - lastOutAt > HUMAN_TIMEOUT_HOURS * HOUR_MS) {
        // Ninguém respondeu: devolve a conversa para a IA
        await supabase
          .from('xerb_conversations')
          .update({ handling_status: 'AI', updated_at: new Date().toISOString() })
          .eq('id', conversation.id);
        conversation.handling_status = 'AI';
      } else {
        return NextResponse.json({ success: true, handledBy: 'HUMAN' });
      }
    }

    // 7.1 Bloqueado por assinatura/limite (a mensagem já foi salva; avisa 1x no mês se bateu o teto da franquia)
    if (!gate.allowed) {
      console.warn(`[Webhook] IA bloqueada para o tenant ${tenantId}: ${gate.reason}`);
      if (gate.reason === 'limit_reached') {
        const curPeriod = currentUsagePeriod();
        if (tenant.quota_alert_period !== curPeriod) {
          await supabase
            .from('xerb_tenants')
            .update({ quota_alert_period: curPeriod, updated_at: new Date().toISOString() })
            .eq('id', tenantId);

          const ownerPhone = normalizeBrPhone(tenant.alert_phone) || normalizeBrPhone(tenant.phone);
          if (ownerPhone && !samePhone(ownerPhone, cleanPhone)) {
            const addons = await getAddonsConfig();
            const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.erbots.com.br').replace(/\/+$/, '');
            const quotaMsg = [
              '📈 *ERBots – Franquia mensal de IA atingida*',
              '',
              `Sua atendente virtual atingiu 100% das respostas mensais do plano *${getPlan(tenant.plan, plansCfg).name}* e pausou temporariamente.`,
              '',
              `Libere *+${addons.extraPackReplies.toLocaleString('pt-BR')} respostas avulsas* por apenas *${formatBRL(addons.extraPackPrice)}* (não expiram na virada do mês) ou faça upgrade em 1 clique:`,
              `👉 ${appUrl}/dashboard`,
            ].join('\n');
            await sendTextMessage(instanceName, ownerPhone, quotaMsg).catch(() => false);
          }
        }
      }
      return NextResponse.json({ success: true, skipped: true, reason: gate.reason });
    }

    // 7.2 Áudio que não deu para ouvir: pede para o cliente escrever (não consome IA)
    if (mediaFailed && botSettings.is_active !== false) {
      const failText = 'Não consegui ouvir seu áudio 😕 Poderia escrever sua mensagem, por favor?';
      const failId = await insertMessage(supabase, {
        conversation_id: conversation.id,
        tenant_id: tenantId,
        sender: 'ai',
        content: failText,
      });
      const sent = await sendTextMessage(instanceName, remoteJid, failText);
      if (!sent && failId && failId !== 'DUPLICATE') await supabase.from('xerb_messages').delete().eq('id', failId);
      return NextResponse.json({ success: true, replied: sent, reason: 'audio_unavailable' });
    }

    // 8. Agrupa mensagens seguidas (debounce) e monta o histórico a partir do banco
    let incomingBlock = userText;
    let history: Array<{ sender: 'user' | 'ai' | 'human'; content: string }> = [];

    if (userMsgId) {
      await sleep(DEBOUNCE_MS);

      const { data: recent } = await supabase
        .from('xerb_messages')
        .select('id, sender, content, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(30);
      const rows = recent || [];

      // Chegou outra mensagem depois (a outra execução responde por todas) ou alguém já respondeu
      if (!rows.length || rows[0].id !== userMsgId) {
        return NextResponse.json({ success: true, skipped: true, reason: 'debounced' });
      }

      // O dono pode ter assumido a conversa durante a espera
      const { data: convNow } = await supabase
        .from('xerb_conversations')
        .select('handling_status')
        .eq('id', conversation.id)
        .maybeSingle();
      if (convNow?.handling_status === 'HUMAN') {
        return NextResponse.json({ success: true, handledBy: 'HUMAN' });
      }

      const block: string[] = [];
      let i = 0;
      while (i < rows.length && rows[i].sender === 'user' && block.length < 8) {
        block.unshift(rows[i].content);
        i++;
      }
      incomingBlock = block.join('\n');
      history = rows
        .slice(i, i + 10)
        .reverse()
        .map((m: any) => ({ sender: m.sender as 'user' | 'ai' | 'human', content: m.content }));
    }

    // 9. Processa a resposta com o motor de IA do ERBots
    const planPrice = getPlan(tenant.plan, plansCfg).price;
    const aiResult = await processAIMessage({
      tenant: { ...tenant, planPrice },
      botSettings,
      knowledgeBase,
      conversationHistory: history,
      incomingMessage: incomingBlock,
      customerName: pushName,
    });

    // 9.1 Registra o consumo (apenas respostas geradas pelo Gemini contam no limite do plano)
    if (aiResult.usage) {
      await recordUsage(supabase, tenantId, {
        aiReplies: 1,
        tokensIn: aiResult.usage.tokensIn,
        tokensOut: aiResult.usage.tokensOut,
        consumeExtraCredit: Boolean(gate.usingExtraCredits),
      });
    }

    if (!aiResult.reply) {
      return NextResponse.json({ success: true, replied: false, handoff: false });
    }

    // 9.2 "Fora do horário": avisa no máximo 1x por período, não a cada mensagem
    if (aiResult.isOutOfHours) {
      const since = new Date(Date.now() - OUT_OF_HOURS_COOLDOWN_HOURS * HOUR_MS).toISOString();
      const { data: already } = await supabase
        .from('xerb_messages')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('sender', 'ai')
        .eq('content', aiResult.reply)
        .gte('created_at', since)
        .limit(1);
      if (already && already.length) {
        return NextResponse.json({ success: true, skipped: true, reason: 'out_of_hours_cooldown' });
      }
    }

    // 9.3 Revalida se o dono assumiu a conversa enquanto a IA gerava a resposta
    const { data: convBeforeSend } = await supabase
      .from('xerb_conversations')
      .select('handling_status')
      .eq('id', conversation.id)
      .maybeSingle();
    if (convBeforeSend?.handling_status === 'HUMAN') {
      return NextResponse.json({ success: true, handledBy: 'HUMAN', reason: 'taken_over_during_generation' });
    }

    // 10. Grava a resposta ANTES de enviar (permite reconhecer o eco do envio) e despacha
    const aiMsgId = await insertMessage(supabase, {
      conversation_id: conversation.id,
      tenant_id: tenantId,
      sender: 'ai',
      content: aiResult.reply,
    });

    const sent = await sendTextMessage(instanceName, remoteJid, aiResult.reply);
    if (!sent) {
      if (aiMsgId && aiMsgId !== 'DUPLICATE') await supabase.from('xerb_messages').delete().eq('id', aiMsgId);
      await logSystemEvent({
        level: 'error',
        source: 'webhook.whatsapp.send',
        message: `Falha ao enviar resposta da IA na instância ${instanceName}`,
        tenantId,
        metadata: { instanceName, cleanPhone },
      });
      return NextResponse.json({ success: true, replied: false, reason: 'send_failed' });
    }

    // 11. Atualiza o status da conversa + registra oportunidade (xerb_leads) + avisa o dono
    const newStatus = aiResult.triggerHandoff ? 'HUMAN' : 'AI';
    await supabase
      .from('xerb_conversations')
      .update({
        handling_status: newStatus,
        last_message: aiResult.reply,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id);

    let shouldNotifyLead = false;
    if (aiResult.capturedLead) {
      const leadRes = await persistCapturedLead(supabase, {
        tenantId,
        conversationId: conversation.id,
        customerName: pushName || conversation.contact_name || '',
        cleanPhone,
        remoteJid,
        lead: aiResult.capturedLead,
      });
      shouldNotifyLead = leadRes.shouldNotify;
    }

    if (aiResult.triggerHandoff || shouldNotifyLead) {
      await notifyOwner({
        instanceName,
        tenant,
        customerName: pushName || conversation.contact_name || '',
        customerPhone: cleanPhone,
        lastMessage: incomingBlock,
        handoff: Boolean(aiResult.triggerHandoff),
        lead: shouldNotifyLead ? aiResult.capturedLead : undefined,
        conversationId: conversation.id,
      });
    }

    return NextResponse.json({
      success: true,
      replied: true,
      handoff: Boolean(aiResult.triggerHandoff),
      leadCaptured: Boolean(aiResult.capturedLead),
    });
  } catch (err: any) {
    await logSystemEvent({
      level: 'error',
      source: 'webhook.whatsapp',
      message: 'Erro fatal no processamento do webhook do WhatsApp',
      error: err,
    });
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
