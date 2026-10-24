import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/auth';

export const maxDuration = 60;

const VALID_PLANS = ['trial', 'start', 'pro', 'business'];
const VALID_STATUS = ['trialing', 'active', 'past_due', 'canceled'];

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();

    // 1. Busca todos os Tenants
    const { data: tenants, error: tenantsErr } = await supabase
      .from('xerb_tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantsErr) throw tenantsErr;

    // 2. Busca todas as instâncias correspondentes
    const { data: instances } = await supabase
      .from('xerb_instances')
      .select('*');

    // 3. Busca configurações do robô
    const { data: botSettings } = await supabase
      .from('xerb_bot_settings')
      .select('tenant_id, bot_name, gemini_model, is_active');

    // Mapeia instâncias e robôs por tenant_id
    const instanceMap = new Map();
    (instances || []).forEach((inst) => instanceMap.set(inst.tenant_id, inst));

    const botMap = new Map();
    (botSettings || []).forEach((bot) => botMap.set(bot.tenant_id, bot));

    const enrichedTenants = (tenants || []).map((t) => {
      const inst = instanceMap.get(t.id);
      const bot = botMap.get(t.id);

      return {
        ...t,
        instance: inst
          ? {
              name: inst.instance_name,
              status: inst.status,
              phone: inst.phone_connected,
              profileName: inst.profile_name,
              lastConnectedAt: inst.last_connected_at,
            }
          : null,
        bot: bot
          ? {
              name: bot.bot_name,
              model: bot.gemini_model,
              isActive: bot.is_active,
            }
          : null,
      };
    });

    return NextResponse.json({ tenants: enrichedTenants });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Tenants GET] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao listar clientes.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const {
      tenant_id,
      name,
      segment,
      phone,
      email,
      slug,
      plan,
      subscription_status,
      extend_trial_days,
      trial_ends_at,
    } = body;

    if (!tenant_id || typeof tenant_id !== 'string') {
      return NextResponse.json({ error: 'tenant_id é obrigatório.' }, { status: 400 });
    }

    if (plan !== undefined && plan !== null && plan !== '' && !VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    }
    if (
      subscription_status !== undefined &&
      subscription_status !== null &&
      subscription_status !== '' &&
      !VALID_STATUS.includes(subscription_status)
    ) {
      return NextResponse.json({ error: 'Status de assinatura inválido.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      const clean = String(name).trim();
      if (!clean || clean.length > 120) {
        return NextResponse.json({ error: 'Nome da empresa inválido.' }, { status: 400 });
      }
      updatePayload.name = clean;
    }
    if (segment !== undefined) updatePayload.segment = String(segment).trim().slice(0, 80);
    if (phone !== undefined) updatePayload.phone = String(phone).trim().slice(0, 30) || null;
    if (email !== undefined) updatePayload.email = String(email).trim().toLowerCase().slice(0, 160) || null;
    if (slug !== undefined) {
      const cleanSlug = String(slug).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60);
      if (!cleanSlug) {
        return NextResponse.json({ error: 'Slug inválido.' }, { status: 400 });
      }
      updatePayload.slug = cleanSlug;
    }

    if (plan) updatePayload.plan = plan;
    if (subscription_status) updatePayload.subscription_status = subscription_status;

    if (extend_trial_days) {
      const days = Number(extend_trial_days);
      if (!Number.isFinite(days) || days < 1 || days > 366) {
        return NextResponse.json({ error: 'extend_trial_days deve estar entre 1 e 366.' }, { status: 400 });
      }
      const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      updatePayload.trial_ends_at = newExpiry;
      if (subscription_status === undefined) {
        updatePayload.subscription_status = 'trialing';
      }
    } else if (trial_ends_at) {
      const parsed = new Date(trial_ends_at);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'trial_ends_at inválido.' }, { status: 400 });
      }
      updatePayload.trial_ends_at = parsed.toISOString();
    }

    const { data: updated, error: updateErr } = await supabase
      .from('xerb_tenants')
      .update(updatePayload)
      .eq('id', tenant_id)
      .select()
      .single();

    if (updateErr) {
      if ((updateErr as any).code === '23505') {
        return NextResponse.json({ error: 'Este slug já está em uso por outra empresa.' }, { status: 409 });
      }
      throw updateErr;
    }

    return NextResponse.json({ success: true, tenant: updated });
  } catch (err: any) {
    console.error('[Admin Tenants PATCH] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar dados da empresa.' }, { status: 500 });
  }
}
