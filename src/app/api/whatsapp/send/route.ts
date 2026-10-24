import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/evolution';
import { requireTenantAccess } from '@/lib/auth';

const last8 = (v?: string | null) => (v || '').replace(/\D/g, '').slice(-8);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, conversation_id, to_phone, text } = body;

    // Autenticação + autorização: apenas o dono do tenant (ou Super Admin)
    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;
    const tenant = guard.tenant;

    if (typeof text !== 'string' || !text.trim() || (!conversation_id && !to_phone)) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: 'Mensagem muito longa (máximo 4000 caracteres).' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Busca a instância ativa do tenant
    const { data: inst, error: instErr } = await supabase
      .from('xerb_instances')
      .select('instance_name, status, phone_connected')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (instErr || !inst || inst.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'WhatsApp não está conectado para esta empresa' }, { status: 400 });
    }

    let remoteJid = '';
    let convId = conversation_id;

    // Se passou to_phone direto (ex: Teste de Disparo Direto)
    if (to_phone) {
      let clean = String(to_phone).replace(/\D/g, '');
      if (clean.length < 10 || clean.length > 15) {
        return NextResponse.json({ error: 'Número de telefone inválido.' }, { status: 400 });
      }
      if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
        clean = `55${clean}`;
      }
      remoteJid = `${clean}@s.whatsapp.net`;

      // Busca conversa existente para esse número
      let { data: existingConv } = await supabase
        .from('xerb_conversations')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('remote_jid', remoteJid)
        .maybeSingle();

      // Anti-spam: disparo direto só para o telefone da empresa, o número conectado
      // ou contatos que já conversaram com este WhatsApp.
      if (!existingConv && !guard.ctx.isSuperAdmin) {
        const target8 = last8(clean);
        const allowed = [last8(tenant.phone), last8(inst.phone_connected)].filter(Boolean);
        if (!allowed.includes(target8)) {
          return NextResponse.json(
            {
              error:
                'Por segurança, o teste direto só pode ser enviado para o telefone cadastrado em "Dados da Empresa" ou para contatos que já conversaram com você.',
            },
            { status: 403 }
          );
        }
      }

      if (!existingConv) {
        const { data: newConv } = await supabase
          .from('xerb_conversations')
          .insert({
            tenant_id: tenant.id,
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
      // Busca a conversa por conversation_id (sempre restrita ao tenant autorizado)
      const { data: conv, error: convErr } = await supabase
        .from('xerb_conversations')
        .select('id, remote_jid, tenant_id')
        .eq('id', conversation_id)
        .eq('tenant_id', tenant.id)
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
        tenant_id: tenant.id,
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
        .eq('id', convId)
        .eq('tenant_id', tenant.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API Send] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao enviar mensagem.' }, { status: 500 });
  }
}
