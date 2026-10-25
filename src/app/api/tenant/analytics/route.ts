import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getUsage } from '@/lib/billing/usage';
import { getPlansConfig } from '@/lib/billing/plans-config';
import { getPlan } from '@/lib/plans';

export const maxDuration = 30;

function toBrtParts(iso: string): { dateKey: string; label: string; hour: number; dayOfWeek: number } {
  const d = new Date(iso);
  const brt = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const yyyy = brt.getFullYear();
  const mm = String(brt.getMonth() + 1).padStart(2, '0');
  const dd = String(brt.getDate()).padStart(2, '0');
  return {
    dateKey: `${yyyy}-${mm}-${dd}`,
    label: `${dd}/${mm}`,
    hour: brt.getHours(),
    dayOfWeek: brt.getDay(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const daysParam = Number(searchParams.get('days')) || 30;
    const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;

    const guard = await requireTenantAccess(req, tenantId);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    const tid = guard.tenant.id;
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [tenantRes, convsRes, msgsRes, kbRes, botRes, instRes, usage, plansMap] = await Promise.all([
      supabase.from('xerb_tenants').select('plan').eq('id', tid).maybeSingle(),
      supabase
        .from('xerb_conversations')
        .select('id, contact_name, contact_phone, handling_status, last_message, last_message_at, created_at')
        .eq('tenant_id', tid)
        .gte('last_message_at', sinceIso)
        .order('last_message_at', { ascending: false })
        .limit(500),
      supabase
        .from('xerb_messages')
        .select('sender, created_at, conversation_id')
        .eq('tenant_id', tid)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(5000),
      supabase
        .from('xerb_knowledge_base')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tid)
        .eq('is_active', true),
      supabase.from('xerb_bot_settings').select('bot_name, system_prompt, is_active').eq('tenant_id', tid).maybeSingle(),
      supabase.from('xerb_instances').select('status').eq('tenant_id', tid).maybeSingle(),
      getUsage(supabase, tid),
      getPlansConfig(),
    ]);

    const convs = convsRes.data || [];
    const msgs = msgsRes.data || [];

    const totalConversations = convs.length;
    const humanHandoffCount = convs.filter((c) => c.handling_status === 'HUMAN').length;
    const aiHandledCount = Math.max(0, totalConversations - humanHandoffCount);
    const aiResolutionRate =
      totalConversations > 0 ? Math.round((aiHandledCount / totalConversations) * 100) : 100;

    let messagesIn = 0;
    let messagesAi = 0;
    let messagesHuman = 0;
    let afterHoursReplies = 0;

    const hourlyCounts = new Array<number>(24).fill(0);

    // Inicializa série diária contínua para não haver "buracos" visuais no gráfico
    const dailyMap = new Map<string, { date: string; label: string; conversations: Set<string>; aiReplies: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const p = toBrtParts(dt.toISOString());
      dailyMap.set(p.dateKey, { date: p.dateKey, label: p.label, conversations: new Set(), aiReplies: 0 });
    }

    for (const m of msgs) {
      const p = toBrtParts(m.created_at);
      if (m.sender === 'user') {
        messagesIn++;
        hourlyCounts[p.hour]++;
      } else if (m.sender === 'ai') {
        messagesAi++;
        const isWeekend = p.dayOfWeek === 0 || p.dayOfWeek === 6;
        const isNight = p.hour < 8 || p.hour >= 18;
        if (isWeekend || isNight) afterHoursReplies++;
      } else if (m.sender === 'human') {
        messagesHuman++;
      }

      const dayEntry = dailyMap.get(p.dateKey);
      if (dayEntry) {
        if (m.conversation_id) dayEntry.conversations.add(m.conversation_id);
        if (m.sender === 'ai') dayEntry.aiReplies++;
      }
    }

    const dailySeries = Array.from(dailyMap.values()).map((d) => ({
      date: d.date,
      label: d.label,
      conversations: d.conversations.size,
      aiReplies: d.aiReplies,
    }));

    const hourlyDistribution = hourlyCounts.map((count, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}h`,
      count,
    }));

    const estimatedHoursSaved = Math.round(((messagesAi * 1.5) / 60) * 10) / 10;

    const planKey = tenantRes.data?.plan || 'trial';
    const planDef = plansMap[planKey as keyof typeof plansMap] || getPlan(planKey);

    const activeKbCount = kbRes.count || 0;
    const bot = botRes.data;

    return NextResponse.json({
      days,
      summary: {
        totalConversations,
        aiHandledCount,
        humanHandoffCount,
        aiResolutionRate,
        messagesIn,
        messagesAi,
        messagesHuman,
        afterHoursReplies,
        estimatedHoursSaved,
        monthlyAiUsed: usage.ai_replies,
        monthlyAiLimit: planDef.monthlyAiReplies,
        planName: planDef.name,
      },
      dailySeries,
      hourlyDistribution,
      recentLeads: convs.slice(0, 20),
      onboarding: {
        botConfigured: Boolean(bot?.bot_name && bot?.system_prompt),
        botActive: bot?.is_active !== false,
        knowledgeCount: activeKbCount,
        knowledgeReady: activeKbCount >= 3,
        whatsappConnected: instRes.data?.status === 'CONNECTED',
      },
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Tenant Analytics] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar indicadores.' }, { status: 500 });
  }
}
