import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth.ok) return auth.response;

    const { tenant } = auth;
    const body = await req.json();
    const { phone, action } = body;

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Campo "phone" é obrigatório.' }, { status: 400 });
    }

    if (action !== 'pause' && action !== 'resume') {
      return NextResponse.json({ error: 'Campo "action" deve ser "pause" ou "resume".' }, { status: 400 });
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = `55${cleanPhone}`;
    }

    const remoteJid = `${cleanPhone}@s.whatsapp.net`;
    const targetStatus = action === 'pause' ? 'HUMAN' : 'AI';

    const supabase = getServiceSupabase();

    // 1. Localiza a conversa pelo JID ou telefone
    const { data: conv, error: convErr } = await supabase
      .from('xerb_conversations')
      .select('id, handling_status')
      .eq('tenant_id', tenant.id)
      .eq('remote_jid', remoteJid)
      .maybeSingle();

    if (!conv) {
      // Se não existir, cria a conversa já no estado desejado
      await supabase.from('xerb_conversations').insert({
        tenant_id: tenant.id,
        remote_jid: remoteJid,
        contact_phone: cleanPhone,
        handling_status: targetStatus,
      });
    } else {
      await supabase
        .from('xerb_conversations')
        .update({
          handling_status: targetStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conv.id);
    }

    return NextResponse.json({
      success: true,
      phone: cleanPhone,
      action,
      handlingStatus: targetStatus,
    });
  } catch (err: any) {
    console.error('[API v1 Pause AI] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao alternar estado da IA.' }, { status: 500 });
  }
}
