import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { hasInstagramAccess } from '@/lib/plans';

export async function GET(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const hasAccess = hasInstagramAccess(tenant);
    const db = getServiceSupabase();

    const { data: account } = await db
      .from('xerb_instagram_accounts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    let cleanAccount = account;
    if (account) {
      let aspectRatio = '4:5';
      let whatsappDeliveryTime = '23:00';
      let cleanVisualStyle = account.visual_style || '';

      if (cleanVisualStyle.startsWith('{') && cleanVisualStyle.includes('"ratio"')) {
        try {
          const meta = JSON.parse(cleanVisualStyle);
          if (meta.ratio) aspectRatio = meta.ratio;
          if (meta.deliveryTime) whatsappDeliveryTime = meta.deliveryTime;
          if (meta.style) cleanVisualStyle = meta.style;
        } catch {}
      }

      cleanAccount = {
        ...account,
        image_aspect_ratio: aspectRatio,
        whatsapp_delivery_time: whatsappDeliveryTime,
        preferred_post_time: account.preferred_post_time ? account.preferred_post_time.slice(0, 5) : '05:30',
        visual_style: cleanVisualStyle,
      };
    }

    return NextResponse.json({
      hasAccess,
      tenantStatus: tenant?.instagram_module_status || 'inactive',
      account: cleanAccount || null,
    });
  } catch (err: any) {
    console.error('[API Instagram Settings GET]', err);
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const body = await req.json();
    const db = getServiceSupabase();

    const {
      account_name,
      account_username,
      niche,
      target_audience,
      brand_voice,
      visual_style,
      approval_mode,
      approval_timeout_hours,
      timeout_action,
      preferred_post_time,
      whatsapp_delivery_time,
      image_aspect_ratio,
      auto_generate_daily,
      is_active,
    } = body;

    const cleanUsername = String(account_username || '')
      .replace(/^@+/, '')
      .trim();

    const chosenRatio = ['4:5', '9:16', '1:1'].includes(image_aspect_ratio) ? image_aspect_ratio : '4:5';
    const chosenDeliveryTime = String(whatsapp_delivery_time || '23:00').slice(0, 5);
    const chosenPostTime = String(preferred_post_time || '05:30').slice(0, 5);
    const cleanStyle = visual_style || 'Fotografia comercial em estúdio, estética clean';

    const packedVisualStyle = JSON.stringify({
      style: cleanStyle,
      ratio: chosenRatio,
      deliveryTime: chosenDeliveryTime,
    });

    const payload = {
      tenant_id: tenant.id,
      account_name: account_name || tenant.name || 'Conta Instagram',
      account_username: cleanUsername,
      niche: niche || 'Geral',
      target_audience: target_audience || 'Clientes locais',
      brand_voice: brand_voice || 'Profissional e autêntico',
      visual_style: packedVisualStyle,
      approval_mode: approval_mode === 'auto_scheduled' ? 'auto_scheduled' : 'whatsapp_required',
      approval_timeout_hours: Number(approval_timeout_hours) || 4,
      timeout_action: timeout_action === 'skip' ? 'skip' : 'auto_publish',
      preferred_post_time: chosenPostTime.length === 5 ? `${chosenPostTime}:00` : chosenPostTime,
      auto_generate_daily: auto_generate_daily ?? true,
      is_active: is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from('xerb_instagram_accounts')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, account: data });
  } catch (err: any) {
    console.error('[API Instagram Settings POST]', err);
    return NextResponse.json({ error: err?.message || 'Erro ao salvar configurações' }, { status: 500 });
  }
}
