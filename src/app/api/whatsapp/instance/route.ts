import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createOrGetInstance, logoutInstance } from '@/lib/evolution';
import { requireTenantAccess } from '@/lib/auth';
import { buildWebhookUrl } from '@/lib/webhook';
import { logSystemEvent } from '@/lib/monitoring';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    const guard = await requireTenantAccess(req, tenantId);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    const { data: inst } = await supabase
      .from('xerb_instances')
      .select(
        'id, instance_name, status, phone_connected, profile_name, last_connected_at, disconnected_at, intentional_logout, updated_at'
      )
      .eq('tenant_id', guard.tenant.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ instance: inst || null });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    await logSystemEvent({
      level: 'error',
      source: 'api.whatsapp.instance.get',
      message: 'Erro ao consultar estado da instância WhatsApp',
      error: err,
    });
    return NextResponse.json({ error: 'Erro ao consultar instância.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let tenantIdForLog: string | null = null;
  try {
    const body = await req.json();
    const { tenant_id, action } = body;

    // Autenticação + autorização: apenas o dono do tenant (ou Super Admin)
    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;
    const tenant = guard.tenant;
    tenantIdForLog = tenant.id;

    if (!['CONNECT', 'STATUS', 'LOGOUT'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Nome da instância ESTÁVEL: reaproveita o já cadastrado; para novas, deriva do ID (não do slug editável)
    const { data: existingInstance } = await supabase
      .from('xerb_instances')
      .select('instance_name, last_connected_at, intentional_logout')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const instanceName =
      existingInstance?.instance_name || `erbots_${tenant.id.replace(/-/g, '').slice(0, 16)}`;

    if (action === 'CONNECT' || action === 'STATUS') {
      const webhookUrl = buildWebhookUrl(req);
      const instanceState = await createOrGetInstance(instanceName, webhookUrl);
      const nowIso = new Date().toISOString();
      const isConnected = instanceState.status === 'CONNECTED';

      // Atualiza ou insere na tabela xerb_instances
      await supabase.from('xerb_instances').upsert(
        {
          tenant_id: tenant.id,
          instance_name: instanceName,
          status: instanceState.status,
          phone_connected: instanceState.phone || null,
          profile_name: instanceState.profileName || null,
          last_connected_at: isConnected ? nowIso : existingInstance?.last_connected_at || null,
          disconnected_at: isConnected ? null : undefined,
          intentional_logout: action === 'CONNECT' || isConnected ? false : Boolean(existingInstance?.intentional_logout),
          updated_at: nowIso,
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

    // LOGOUT intencional: marca ANTES do logout na Evolution para o webhook não disparar alarme falso
    const nowIso = new Date().toISOString();
    await supabase
      .from('xerb_instances')
      .update({
        status: 'DISCONNECTED',
        phone_connected: null,
        disconnected_at: nowIso,
        intentional_logout: true,
        updated_at: nowIso,
      })
      .eq('instance_name', instanceName);

    await logoutInstance(instanceName);

    await logSystemEvent({
      level: 'info',
      source: 'whatsapp.logout',
      message: `Instância ${instanceName} desconectada manualmente pelo painel.`,
      tenantId: tenant.id,
      metadata: { instanceName },
    });

    return NextResponse.json({ success: true, status: 'DISCONNECTED' });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    await logSystemEvent({
      level: 'error',
      source: 'api.whatsapp.instance',
      message: 'Falha ao processar conexão/status da instância WhatsApp',
      tenantId: tenantIdForLog,
      error: err,
    });
    return NextResponse.json({ error: 'Erro interno ao processar a conexão do WhatsApp.' }, { status: 500 });
  }
}
