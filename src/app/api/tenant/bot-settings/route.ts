import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

const VALID_TONES = new Set(['formal', 'friendly', 'enthusiastic', 'direct']);

export async function GET(req: NextRequest) {
  try {
    const tenantId = new URL(req.url).searchParams.get('tenant_id');
    const guard = await requireTenantAccess(req, tenantId);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('xerb_bot_settings')
      .select('*')
      .eq('tenant_id', guard.tenant.id)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({
      settings: data || null,
      alert_phone: guard.tenant.alert_phone || '',
    });
  } catch (err) {
    console.error('[BotSettings GET] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar configurações da IA.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const guard = await requireTenantAccess(req, body.tenant_id);
    if (!guard.ok) return guard.response;

    const botName = String(body.bot_name || 'Assistente Virtual').trim().slice(0, 80);
    if (!botName) {
      return NextResponse.json({ error: 'Informe um nome válido para o atendente.' }, { status: 400 });
    }

    const tone = VALID_TONES.has(body.tone) ? body.tone : 'friendly';
    const isActive = body.is_active !== false;
    const systemPrompt = String(body.system_prompt || '').trim().slice(0, 4000);

    const bhRaw = body.business_hours || {};
    const days = Array.isArray(bhRaw.days)
      ? bhRaw.days.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)
      : [1, 2, 3, 4, 5];
    const timeRegex = /^\d{2}:\d{2}$/;
    const businessHours = {
      enabled: Boolean(bhRaw.enabled),
      days,
      start: timeRegex.test(String(bhRaw.start || '')) ? String(bhRaw.start) : '08:00',
      end: timeRegex.test(String(bhRaw.end || '')) ? String(bhRaw.end) : '18:00',
      out_of_hours_message: String(
        bhRaw.out_of_hours_message ||
          'Olá! No momento estamos fora do nosso horário de atendimento. Deixe sua mensagem que responderemos assim que retornarmos!'
      )
        .trim()
        .slice(0, 500),
    };

    const handoffEnabled = body.human_handoff_enabled !== false;
    const keywords = Array.isArray(body.human_handoff_keywords)
      ? body.human_handoff_keywords
          .map((k: any) => String(k || '').trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 40)
      : [];
    const handoffMessage = String(
      body.human_handoff_message ||
        'Com certeza! Estou transferindo seu atendimento para nossa equipe humana. Aguarde um instante que já vamos te responder.'
    )
      .trim()
      .slice(0, 500);

    const autoFollowupEnabled = body.auto_followup_enabled !== false;
    const rawDelay = Number(body.auto_followup_delay_minutes);
    const autoFollowupDelayMinutes =
      Number.isFinite(rawDelay) && rawDelay >= 30 && rawDelay <= 1440 ? Math.round(rawDelay) : 180;

    const supabase = getServiceSupabase();

    let savedAlertPhone = guard.tenant.alert_phone || '';
    if (body.alert_phone !== undefined) {
      const cleanAlertPhone =
        typeof body.alert_phone === 'string'
          ? body.alert_phone.replace(/\D/g, '').slice(0, 20)
          : null;
      savedAlertPhone = cleanAlertPhone || '';
      await supabase
        .from('xerb_tenants')
        .update({
          alert_phone: cleanAlertPhone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guard.tenant.id);
    }

    const { data, error } = await supabase
      .from('xerb_bot_settings')
      .upsert(
        {
          tenant_id: guard.tenant.id,
          bot_name: botName,
          tone,
          is_active: isActive,
          system_prompt: systemPrompt,
          business_hours: businessHours,
          human_handoff_enabled: handoffEnabled,
          human_handoff_keywords: keywords,
          human_handoff_message: handoffMessage,
          auto_followup_enabled: autoFollowupEnabled,
          auto_followup_delay_minutes: autoFollowupDelayMinutes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, settings: data, alert_phone: savedAlertPhone });
  } catch (err) {
    console.error('[BotSettings PUT] Erro:', err);
    return NextResponse.json({ error: 'Erro ao salvar configurações da IA.' }, { status: 500 });
  }
}
