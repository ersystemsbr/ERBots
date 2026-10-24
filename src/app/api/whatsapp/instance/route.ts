import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createOrGetInstance, logoutInstance } from '@/lib/evolution';
import { requireTenantAccess } from '@/lib/auth';
import { buildWebhookUrl } from '@/lib/webhook';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, action } = body;

    // Autenticação + autorização: apenas o dono do tenant (ou Super Admin)
    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;
    const tenant = guard.tenant;

    if (!['CONNECT', 'STATUS', 'LOGOUT'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Nome da instância ESTÁVEL: reaproveita o já cadastrado; para novas, deriva do ID (não do slug editável)
    const { data: existingInstance } = await supabase
      .from('xerb_instances')
      .select('instance_name')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const instanceName =
      existingInstance?.instance_name || `erbots_${tenant.id.replace(/-/g, '').slice(0, 16)}`;

    if (action === 'CONNECT' || action === 'STATUS') {
      const webhookUrl = buildWebhookUrl(req);
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

    // LOGOUT
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
  } catch (err: any) {
    console.error('[API Instance] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao processar a conexão do WhatsApp.' }, { status: 500 });
  }
}
