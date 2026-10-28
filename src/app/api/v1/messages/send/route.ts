import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/evolution';
import { dispatchOutboundWebhook } from '@/lib/outbound-webhook';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth.ok) return auth.response;

    const { tenant, instance } = auth;

    if (!instance || instance.status !== 'CONNECTED') {
      return NextResponse.json(
        {
          error: 'O WhatsApp desta empresa não está conectado no momento. Conecte o aparelho no painel do ERBots.',
          instanceStatus: instance?.status || 'DISCONNECTED',
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { phone, content, pauseAi = true } = body;

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Campo "phone" é obrigatório.' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Campo "content" é obrigatório e não pode ser vazio.' }, { status: 400 });
    }

    // Normaliza telefone
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return NextResponse.json({ error: 'Formato de telefone inválido (DDD + número).' }, { status: 400 });
    }
    if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = `55${cleanPhone}`;
    }

    const remoteJid = `${cleanPhone}@s.whatsapp.net`;
    const supabase = getServiceSupabase();

    // 1. Envia a mensagem pelo WhatsApp via Evolution API
    const sent = await sendTextMessage(instance.instance_name, remoteJid, content.trim());
    if (!sent) {
      return NextResponse.json(
        { error: 'Falha ao despachar mensagem pelo WhatsApp através do motor ERBots.' },
        { status: 502 }
      );
    }

    // 2. Localiza ou cria a conversa para registrar a mensagem
    let { data: conv } = await supabase
      .from('xerb_conversations')
      .select('id, contact_name')
      .eq('tenant_id', tenant.id)
      .eq('remote_jid', remoteJid)
      .maybeSingle();

    if (!conv) {
      const { data: newConv } = await supabase
        .from('xerb_conversations')
        .insert({
          tenant_id: tenant.id,
          remote_jid: remoteJid,
          contact_phone: cleanPhone,
          handling_status: pauseAi ? 'HUMAN' : 'AI',
          last_message: content.trim(),
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        })
        .select('id, contact_name')
        .single();
      conv = newConv;
    } else {
      await supabase
        .from('xerb_conversations')
        .update({
          handling_status: pauseAi ? 'HUMAN' : undefined,
          last_message: content.trim(),
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conv.id);
    }

    // 3. Registra a mensagem no histórico do tenant
    let messageId = `msg_${Date.now()}`;
    if (conv?.id) {
      const { data: insertedMsg } = await supabase
        .from('xerb_messages')
        .insert({
          tenant_id: tenant.id,
          conversation_id: conv.id,
          sender: 'human',
          content: content.trim(),
        })
        .select('id')
        .single();

      if (insertedMsg?.id) {
        messageId = insertedMsg.id;
      }
    }

    // 4. Dispara webhook de saída informando que a mensagem foi enviada
    dispatchOutboundWebhook(tenant.id, 'message.sent', {
      contactPhone: cleanPhone,
      contactName: conv?.contact_name || null,
      messageContent: content.trim(),
      direction: 'out',
      sender: 'human',
    });

    return NextResponse.json({
      success: true,
      messageId,
      phone: cleanPhone,
      aiPaused: pauseAi,
    });
  } catch (err: any) {
    console.error('[API v1 Send] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao processar envio de mensagem.' }, { status: 500 });
  }
}
