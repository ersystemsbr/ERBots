import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    const guard = await requireTenantAccess(req, tenantId);
    if (!guard.ok) return guard.response;

    if (!guard.ctx.isSuperAdmin && !guard.tenant.is_super_admin) {
      return NextResponse.json(
        { error: 'Acesso restrito ao Administrador Master / Desenvolvedor.' },
        { status: 403 }
      );
    }

    const supabase = getServiceSupabase();
    let { data: tenant } = await supabase
      .from('xerb_tenants')
      .select('id, api_key, webhook_url, webhook_secret')
      .eq('id', guard.tenant.id)
      .maybeSingle();

    // Se ainda não tiver api_key, gera uma na hora
    if (!tenant?.api_key) {
      const generated = `erb_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
      await supabase
        .from('xerb_tenants')
        .update({ api_key: generated })
        .eq('id', guard.tenant.id);

      tenant = { ...tenant, api_key: generated } as any;
    }

    const serverUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://www.erbots.com.br');

    return NextResponse.json({
      serverUrl,
      apiKey: tenant?.api_key || '',
      webhookUrl: tenant?.webhook_url || '',
      webhookSecret: tenant?.webhook_secret || '',
    });
  } catch (err: any) {
    console.error('[Tenant Integrations GET] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar configurações de integração.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, webhook_url, webhook_secret, regenerate_api_key } = body;

    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;

    if (!guard.ctx.isSuperAdmin && !guard.tenant.is_super_admin) {
      return NextResponse.json(
        { error: 'Acesso restrito ao Administrador Master / Desenvolvedor.' },
        { status: 403 }
      );
    }

    const supabase = getServiceSupabase();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof webhook_url === 'string') {
      updatePayload.webhook_url = webhook_url.trim() || null;
    }
    if (typeof webhook_secret === 'string') {
      updatePayload.webhook_secret = webhook_secret.trim() || null;
    }

    if (regenerate_api_key === true) {
      updatePayload.api_key = `erb_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    }

    const { data: updated, error } = await supabase
      .from('xerb_tenants')
      .update(updatePayload)
      .eq('id', guard.tenant.id)
      .select('id, api_key, webhook_url, webhook_secret')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      apiKey: updated.api_key,
      webhookUrl: updated.webhook_url || '',
      webhookSecret: updated.webhook_secret || '',
    });
  } catch (err: any) {
    console.error('[Tenant Integrations POST] Erro:', err);
    return NextResponse.json({ error: 'Erro ao salvar integrações.' }, { status: 500 });
  }
}
