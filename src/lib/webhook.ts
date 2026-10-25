import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * URL pública do webhook que a Evolution API chama.
 * Se WEBHOOK_SECRET estiver definido, o token vai na query (?token=...) e é exigido no recebimento.
 */
export function buildWebhookUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  // Em ambiente local de desenvolvimento, aponta para o domínio oficial de produção
  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    baseUrl = 'https://www.erbots.com.br';
  }

  let url = `${baseUrl.replace(/\/+$/, '')}/api/webhook/whatsapp`;
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) url += `?token=${encodeURIComponent(secret)}`;
  return url;
}

export function isWebhookSecretConfigured(): boolean {
  return Boolean(process.env.WEBHOOK_SECRET);
}

/**
 * Valida o token do webhook.
 * - Com WEBHOOK_SECRET definido: exige token válido (comparação em tempo constante).
 * - Em produção sem WEBHOOK_SECRET: falha fechado (rejeita requisições não autenticadas).
 */
export function verifyWebhookToken(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }

  const provided = req.nextUrl.searchParams.get('token') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
