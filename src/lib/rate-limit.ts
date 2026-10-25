import { NextRequest } from 'next/server';

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/**
 * Rate limiter leve em memória (janela deslizante por instância serverless).
 * Protege rotas públicas como cadastro e simulador contra rajadas automatizadas.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (buckets.size > 5000) {
    for (const [k, b] of buckets.entries()) {
      const filtered = b.timestamps.filter((t) => t > cutoff);
      if (filtered.length === 0) buckets.delete(k);
      else b.timestamps = filtered;
    }
  }

  const bucket = buckets.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSec };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}
