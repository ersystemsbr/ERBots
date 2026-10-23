import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/evolution';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, conversation_id, to_phone, text } = body;

    if (!tenant_id || !text?.trim() || (!conversation_id && !to_phone)) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Busca a instância ativa do tenant
    const { data: inst, error: instErr } = await supabase
      .from('xerb_instances')
      .select('instance_name, status')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (instErr || !inst || inst.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'WhatsApp não está conectado para esta empresa' }, { status: 400 });
    }

    let remoteJid = '';
    let convId = conversation_id;

    // Se passou to_phone direto (ex: Teste de Disparo Direto)
    if (to_phone) {
      let clean = to_phone.replace(/\D/g, '');
      if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
        clean = `55${clean}`;
      }
      remoteJid = `${clean}@s.whatsapp.net`;

      // Busca ou cria conversa para esse número
      let { data: existingConv } = await supabase
        .from('xerb_conversations')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('remote_jid', remoteJid)
        .maybeSingle();

      if (!existingConv) {
        const { data: newConv } = await supabase
          .from('xerb_conversations')
          .insert({
            tenant_id,
            remote_jid: remoteJid,
            contact_name: clean,
            contact_phone: clean,
            handling_status: 'HUMAN',
            last_message: text.trim(),
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        convId = newConv?.id;
      } else {
        convId = existingConv.id;
      }
    } else {
      // Busca a conversa por conversation_id
      const { data: conv, error: convErr } = await supabase
        .from('xerb_conversations')
        .select('id, remote_jid, tenant_id')
        .eq('id', conversation_id)
        .eq('tenant_id', tenant_id)
        .single();

      if (convErr || !conv) {
        return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
      }
      remoteJid = conv.remote_jid;
      convId = conv.id;
    }

    // 2. Envia mensagem via Evolution API
    const sent = await sendTextMessage(inst.instance_name, remoteJid, text.trim());
    if (!sent) {
      return NextResponse.json({ error: 'Falha ao despachar mensagem pelo WhatsApp' }, { status: 500 });
    }

    // 3. Salva no histórico de mensagens se tiver convId
    if (convId) {
      await supabase.from('xerb_messages').insert({
        conversation_id: convId,
        tenant_id: tenant_id,
        sender: 'human',
        content: text.trim(),
      });

      await supabase
        .from('xerb_conversations')
        .update({
          handling_status: 'HUMAN',
          last_message: text.trim(),
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', convId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API Send] Erro:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}
