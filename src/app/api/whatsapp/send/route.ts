import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/evolution';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, conversation_id, text } = body;

    if (!tenant_id || !conversation_id || !text?.trim()) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Busca a conversa
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('id, remote_jid, tenant_id')
      .eq('id', conversation_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    // 2. Busca a instância ativa do tenant
    const { data: inst, error: instErr } = await supabase
      .from('instances')
      .select('instance_name, status')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (instErr || !inst || inst.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'WhatsApp não está conectado para esta empresa' }, { status: 400 });
    }

    // 3. Envia mensagem via Evolution API
    const sent = await sendTextMessage(inst.instance_name, conv.remote_jid, text.trim());
    if (!sent) {
      return NextResponse.json({ error: 'Falha ao despachar mensagem pelo WhatsApp' }, { status: 500 });
    }

    // 4. Salva no histórico de mensagens
    await supabase.from('messages').insert({
      conversation_id: conv.id,
      tenant_id: tenant_id,
      sender: 'human',
      content: text.trim(),
    });

    // 5. Atualiza a conversa (mantém como HUMAN)
    await supabase
      .from('conversations')
      .update({
        handling_status: 'HUMAN',
        last_message: text.trim(),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conv.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API Send] Erro:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}
