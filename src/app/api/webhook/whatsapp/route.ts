import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/evolution';
import { processAIMessage } from '@/lib/ai/gemini';

export const maxDuration = 60;

function extractText(messageObj: any): string {
  if (!messageObj) return '';
  if (messageObj.conversation) return messageObj.conversation;
  if (messageObj.extendedTextMessage?.text) return messageObj.extendedTextMessage.text;
  if (messageObj.imageMessage?.caption) return messageObj.imageMessage.caption;
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const rawEvent = (payload.event || '').toLowerCase();
    const instanceName = payload.instance || '';

    if (!instanceName) {
      return NextResponse.json({ skipped: true, reason: 'No instance provided' });
    }

    const supabase = getServiceSupabase();

    // 1. Trata evento de conexão (CONNECTION_UPDATE)
    if (rawEvent.includes('connection')) {
      const state = payload.data?.state || payload.state;
      const statusMap: Record<string, string> = {
        open: 'CONNECTED',
        connecting: 'CONNECTING',
        close: 'DISCONNECTED',
      };
      const mappedStatus = statusMap[state] || 'DISCONNECTED';

      await supabase
        .from('xerb_instances')
        .update({
          status: mappedStatus,
          last_connected_at: mappedStatus === 'CONNECTED' ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('instance_name', instanceName);

      return NextResponse.json({ success: true, event: 'connection.update' });
    }

    // 2. Filtra apenas eventos de mensagem recebida (MESSAGES_UPSERT)
    if (!rawEvent.includes('message')) {
      return NextResponse.json({ skipped: true, reason: 'Ignored non-message event' });
    }

    const data = payload.data || {};
    const key = data.key || {};
    const message = data.message;
    const pushName = data.pushName || '';

    // Evita loops: ignora mensagens enviadas pelo próprio robô/atendente
    if (key.fromMe) {
      return NextResponse.json({ skipped: true, reason: 'fromMe message' });
    }

    const remoteJid = key.remoteJid || '';
    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) {
      return NextResponse.json({ skipped: true, reason: 'Group or broadcast' });
    }

    const userText = extractText(message).trim();
    if (!userText) {
      return NextResponse.json({ skipped: true, reason: 'No text extracted' });
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

    // Busca dados do tenant, bot_settings e knowledge_base
    const [tenantRes, botSettingsRes, kbRes] = await Promise.all([
      supabase.from('xerb_tenants').select('id, name, segment').eq('id', tenantId).single(),
      supabase.from('xerb_bot_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('xerb_knowledge_base').select('category, title, content').eq('tenant_id', tenantId).eq('is_active', true),
    ]);

    const tenant = tenantRes.data;
    if (!tenant) {
      return NextResponse.json({ skipped: true, reason: 'Tenant not found' });
    }

    const botSettings = botSettingsRes.data || {
      bot_name: 'Atendente Virtual',
      tone: 'friendly',
      is_active: true,
      human_handoff_enabled: true,
    };
    const knowledgeBase = kbRes.data || [];

    // 4. Cria ou recupera a Conversa no banco
    const cleanPhone = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/:\d+$/, '').replace(/\D/g, '');
    let { data: conversation } = await supabase
      .from('xerb_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('remote_jid', remoteJid)
      .maybeSingle();

    if (!conversation) {
      const { data: newConv, error: convErr } = await supabase
        .from('xerb_conversations')
        .insert({
          tenant_id: tenantId,
          remote_jid: remoteJid,
          contact_name: pushName || cleanPhone,
          contact_phone: cleanPhone,
          handling_status: 'AI',
          last_message: userText,
          last_message_at: new Date().toISOString(),
          unread_count: 1,
        })
        .select()
        .single();

      if (convErr) {
        console.error('[Webhook] Erro ao criar conversa:', convErr);
      }
      conversation = newConv;
    } else {
      await supabase
        .from('xerb_conversations')
        .update({
          contact_name: pushName || conversation.contact_name,
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

    // 5. Salva a mensagem recebida do usuário no histórico
    await supabase.from('xerb_messages').insert({
      conversation_id: conversation.id,
      tenant_id: tenantId,
      sender: 'user',
      content: userText,
    });

    // 6. Se a conversa já estiver com um atendente humano, a IA NÃO responde
    if (conversation.handling_status === 'HUMAN') {
      return NextResponse.json({ success: true, handledBy: 'HUMAN' });
    }

    // 7. Busca histórico recente de mensagens desta conversa
    const { data: rawMessages } = await supabase
      .from('xerb_messages')
      .select('sender, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(10);

    const history = (rawMessages || []).map((m: any) => ({
      sender: m.sender as 'user' | 'ai' | 'human',
      content: m.content,
    }));

    // 8. Processa a resposta com o motor de IA do ERBots
    const aiResult = await processAIMessage({
      tenant,
      botSettings,
      knowledgeBase,
      conversationHistory: history,
      incomingMessage: userText,
      customerName: pushName,
    });

    if (aiResult.reply) {
      // Envia a mensagem pelo WhatsApp via Evolution API
      await sendTextMessage(instanceName, remoteJid, aiResult.reply);

      // Salva a resposta da IA no banco
      await supabase.from('xerb_messages').insert({
        conversation_id: conversation.id,
        tenant_id: tenantId,
        sender: 'ai',
        content: aiResult.reply,
      });

      // Atualiza o status da conversa
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
    }

    return NextResponse.json({
      success: true,
      replied: Boolean(aiResult.reply),
      handoff: Boolean(aiResult.triggerHandoff),
    });
  } catch (err: any) {
    console.error('[Webhook] Erro fatal:', err);
    return NextResponse.json({ error: err?.message || 'Internal Error' }, { status: 500 });
  }
}
