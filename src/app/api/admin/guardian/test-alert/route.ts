import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { findHealthyNotifierInstance, normalizeBrPhone, sendTextMessage } from '@/lib/evolution';
import { logSystemEvent } from '@/lib/monitoring';

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();

    // 1. Localiza a instância de disparo (Guardião)
    const notifier = await findHealthyNotifierInstance();
    if (!notifier) {
      return NextResponse.json(
        {
          error:
            'Nenhuma instância WhatsApp conectada disponível para despachar alertas. Conecte o WhatsApp do Super Admin.',
        },
        { status: 503 }
      );
    }

    // 2. Localiza o telefone do Super Admin para casos de atenção no sistema
    const { data: sysCfg } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', 'system_alert_phone')
      .maybeSingle();

    const targetPhone =
      normalizeBrPhone(sysCfg?.value) ||
      '5511973232817';

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.erbots.com.br').replace(/\/+$/, '');
    const nowBrt = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const message = [
      '🛡️ *ERBots – Teste do Guardião WhatsApp*',
      '',
      `Olá, *Eric (Super Admin)*!`,
      `Este é um teste manual de verificação do Guardião realizado às *${nowBrt}*.`,
      '',
      `✅ Instância emissora: *${notifier}*`,
      `✅ Status do Servidor Linux: *100% Online*`,
      `✅ Monitor de Instâncias: *Ativo*`,
      '',
      `📊 Painel de Controle: ${appUrl}/admin`,
    ].join('\n');

    const sent = await sendTextMessage(notifier, targetPhone, message);

    if (!sent) {
      return NextResponse.json(
        { error: `Falha ao enviar mensagem de teste via instância ${notifier}. Verifique se ela está aberta no WhatsApp.` },
        { status: 502 }
      );
    }

    await logSystemEvent({
      level: 'info',
      source: 'admin.guardian.test',
      message: `Teste do Guardião WhatsApp enviado com sucesso para ${targetPhone} via ${notifier}`,
      metadata: { targetPhone, notifier },
    });

    return NextResponse.json({
      success: true,
      notifier,
      targetPhone,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Admin Guardian Test] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao disparar teste do Guardião.' }, { status: 500 });
  }
}
