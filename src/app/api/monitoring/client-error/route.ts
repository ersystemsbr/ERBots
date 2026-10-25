import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { logSystemEvent } from '@/lib/monitoring';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`client-error:${ip}`, 15, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Too many reports' }, { status: 429 });
    }

    const raw = await req.text();
    if (raw.length > 8192) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const body = JSON.parse(raw || '{}');
    const message = String(body.message || 'Erro inesperado no cliente').slice(0, 500);
    const digest = body.digest ? String(body.digest).slice(0, 120) : undefined;
    const path = body.path ? String(body.path).slice(0, 200) : undefined;
    const stack = body.stack ? String(body.stack).slice(0, 1500) : undefined;

    const user = await authenticate(req).catch(() => null);

    await logSystemEvent({
      level: 'error',
      source: 'client.boundary',
      message,
      metadata: {
        digest,
        path,
        stack,
        userEmail: user?.email || undefined,
        userAgent: (req.headers.get('user-agent') || '').slice(0, 200),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
