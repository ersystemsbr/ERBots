import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { isSuperAdminEmail } from '@/lib/admin';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('x-user-email') || '';
    const isAdmin = await isSuperAdminEmail(authHeader);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    }

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
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('x-user-email') || '';
    const isAdmin = await isSuperAdminEmail(authHeader);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    }

    const body = await req.json();
    const { tenant_id, plan, subscription_status, extend_trial_days, trial_ends_at } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id é obrigatório.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (plan) updatePayload.plan = plan;
    if (subscription_status) updatePayload.subscription_status = subscription_status;

    if (extend_trial_days) {
      const days = Number(extend_trial_days);
      const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      updatePayload.trial_ends_at = newExpiry;
      if (subscription_status === undefined) {
        updatePayload.subscription_status = 'trialing';
      }
    } else if (trial_ends_at) {
      updatePayload.trial_ends_at = trial_ends_at;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('xerb_tenants')
      .update(updatePayload)
      .eq('id', tenant_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, tenant: updated });
  } catch (err: any) {
    console.error('[Admin Tenants PATCH] Erro:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}
