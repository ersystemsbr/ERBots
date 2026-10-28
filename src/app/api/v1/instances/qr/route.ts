import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { createOrGetInstance } from '@/lib/evolution';
import { buildWebhookUrl } from '@/lib/webhook';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth.ok) return auth.response;

    const { tenant, instance } = auth;
    const instanceName =
      instance?.instance_name || `erbots_${tenant.id.replace(/-/g, '').slice(0, 16)}`;

    const webhookUrl = buildWebhookUrl(req);
    const instanceState = await createOrGetInstance(instanceName, webhookUrl);

    return NextResponse.json({
      status: instanceState.status === 'CONNECTED' ? 'connected' : 'qrcode',
      qrcode: instanceState.qrcode || null,
      expiresInSeconds: 40,
      instanceName,
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[API v1 QR] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao gerar QR Code do WhatsApp.' }, { status: 500 });
  }
}
