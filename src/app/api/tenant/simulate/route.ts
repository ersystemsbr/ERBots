import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { processAIMessage } from '@/lib/ai/gemini';
import { checkAiGate, recordUsage } from '@/lib/billing/usage';
import { getPlansConfig } from '@/lib/billing/plans-config';
import { getPlan } from '@/lib/plans';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, message, history, ignoreBusinessHours } = body;

    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;

    const tid = guard.tenant.id;
    const rl = checkRateLimit(`simulate:${tid}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitos testes seguidos. Aguarde ${rl.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const userText = String(message || '').trim().slice(0, 1200);
    if (!userText) {
      return NextResponse.json({ error: 'Digite uma mensagem para testar.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const [tenantRes, botRes, kbRes, plansCfg] = await Promise.all([
      supabase
        .from('xerb_tenants')
        .select('id, name, segment, plan, subscription_status, trial_ends_at, is_super_admin, extra_ai_credits')
        .eq('id', tid)
        .single(),
      supabase.from('xerb_bot_settings').select('*').eq('tenant_id', tid).maybeSingle(),
      supabase
        .from('xerb_knowledge_base')
        .select('category, title, content')
        .eq('tenant_id', tid)
        .eq('is_active', true),
      getPlansConfig(),
    ]);

    const tenant = tenantRes.data;
    if (!tenant) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const gate = await checkAiGate(supabase, tenant);
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'Sua franquia mensal ou período de teste expirou. Ative um plano para continuar.' },
        { status: 402 }
      );
    }

    const rawBot = botRes.data || {
      bot_name: `Atendente da ${tenant.name}`,
      tone: 'friendly',
      is_active: true,
      human_handoff_enabled: true,
    };

    // No simulador, permite ignorar restrição de horário comercial para testar de noite/fim de semana
    const botSettings = {
      ...rawBot,
      is_active: true,
      business_hours: ignoreBusinessHours
        ? { ...(rawBot.business_hours || {}), enabled: false }
        : rawBot.business_hours,
    };

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-10)
          .filter((h: any) => h && ['user', 'ai', 'human'].includes(h.sender) && typeof h.content === 'string')
          .map((h: any) => ({
            sender: h.sender as 'user' | 'ai' | 'human',
            content: String(h.content).slice(0, 1200),
          }))
      : [];

    const planPrice = getPlan(tenant.plan, plansCfg).price;

    const aiResult = await processAIMessage({
      tenant: { ...tenant, planPrice },
      botSettings,
      knowledgeBase: kbRes.data || [],
      conversationHistory: safeHistory,
      incomingMessage: userText,
      customerName: 'Cliente Teste',
    });

    if (aiResult.usage) {
      await recordUsage(supabase, tid, {
        aiReplies: 1,
        tokensIn: aiResult.usage.tokensIn,
        tokensOut: aiResult.usage.tokensOut,
        consumeExtraCredit: Boolean(gate.usingExtraCredits),
      });
    }

    return NextResponse.json({
      reply: aiResult.reply,
      triggerHandoff: Boolean(aiResult.triggerHandoff),
      isOutOfHours: Boolean(aiResult.isOutOfHours),
      capturedLead: aiResult.capturedLead || null,
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Simulate] Erro:', err);
    return NextResponse.json({ error: 'Falha ao simular resposta da IA.' }, { status: 500 });
  }
}
