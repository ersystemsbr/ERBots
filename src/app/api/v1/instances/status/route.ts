import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth.ok) return auth.response;

    const { tenant, instance } = auth;
    const isConnected = instance?.status === 'CONNECTED';

    return NextResponse.json({
      connected: isConnected,
      status: isConnected ? 'connected' : instance?.status === 'QRCODE' ? 'qrcode' : 'disconnected',
      phone: instance?.phone_connected || null,
      instanceName: instance?.instance_name || null,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[API v1 Status] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar status da conexão.' }, { status: 500 });
  }
}
