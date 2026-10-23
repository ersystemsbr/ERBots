import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createOrGetInstance, logoutInstance } from '@/lib/evolution';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, action } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id é obrigatório' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Busca dados do tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('xerb_tenants')
      .select('id, name, slug')
      .eq('id', tenant_id)
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const cleanSlug = (tenant.slug || tenant.id).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const instanceName = `erbots_${cleanSlug}`;

    // Determina a URL do webhook
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    // Se estiver em localhost ou em erbots.com.br (que está em propagação no Registro.br),
    // força o uso do domínio https://erbots.vercel.app para que a Evolution API nunca falhe com ENOTFOUND
    if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('erbots.com.br')) {
      baseUrl = 'https://erbots.vercel.app';
    }
    const webhookUrl = `${baseUrl.replace(/\/+$/, '')}/api/webhook/whatsapp`;

    if (action === 'CONNECT' || action === 'STATUS') {
      const instanceState = await createOrGetInstance(instanceName, webhookUrl);

      // Atualiza ou insere na tabela xerb_instances
      await supabase
        .from('xerb_instances')
        .upsert(
          {
            tenant_id: tenant.id,
            instance_name: instanceName,
            status: instanceState.status,
            phone_connected: instanceState.phone || null,
            profile_name: instanceState.profileName || null,
            last_connected_at: instanceState.status === 'CONNECTED' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'instance_name' }
        );

      return NextResponse.json({
        instanceName,
        status: instanceState.status,
        qrcode: instanceState.qrcode || null,
        phone: instanceState.phone || null,
        profileName: instanceState.profileName || null,
      });
    }

    if (action === 'LOGOUT') {
      await logoutInstance(instanceName);

      await supabase
        .from('xerb_instances')
        .update({
          status: 'DISCONNECTED',
          phone_connected: null,
          updated_at: new Date().toISOString(),
        })
        .eq('instance_name', instanceName);

      return NextResponse.json({ success: true, status: 'DISCONNECTED' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    console.error('[API Instance] Erro:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
