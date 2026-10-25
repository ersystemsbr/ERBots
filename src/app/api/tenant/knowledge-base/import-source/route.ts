import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';
import { requireTenantAccess } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { checkAiGate, recordUsage } from '@/lib/billing/usage';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractKnowledgeFromSource } from '@/lib/ai/gemini';

export const maxDuration = 45;

const MAX_HTML_BYTES = 550_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 12_000;

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT / Tailscale
  if (a === 169 && b === 254) return true; // Link-local / Cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true; // Multicast / Reservado
  return false;
}

function isBlockedIp(ip: string): boolean {
  const trimmed = ip.trim().toLowerCase();
  const ver = net.isIP(trimmed);
  if (ver === 4) return isBlockedIpv4(trimmed);
  if (ver === 6) {
    if (trimmed === '::' || trimmed === '::1') return true;
    if (trimmed.startsWith('fc') || trimmed.startsWith('fd')) return true; // ULA fc00::/7
    if (/^fe[89ab]/.test(trimmed)) return true; // Link-local fe80::/10
    if (trimmed.startsWith('ff')) return true; // Multicast
    if (trimmed.startsWith('::ffff:')) {
      const mapped = trimmed.slice('::ffff:'.length);
      if (net.isIP(mapped) === 4) return isBlockedIpv4(mapped);
      return true;
    }
    return false;
  }
  return true;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    const normalized = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    parsed = new URL(normalized);
  } catch {
    throw new Error('Informe um endereço de site válido (ex.: https://suaempresa.com.br).');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Apenas endereços HTTP ou HTTPS públicos são permitidos.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs com credenciais embutidas não são permitidas.');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error('Apenas portas públicas padrão (80/443) são suportadas.');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.ts.net') ||
    host.endsWith('.nip.io') ||
    host.endsWith('.sslip.io')
  ) {
    throw new Error('Endereço privado ou interno não permitido.');
  }

  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new Error('Endereço IP privado não permitido.');
    }
    return parsed;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('Não foi possível localizar esse domínio na internet. Confira o endereço digitado.');
  }

  if (!records.length || records.some((r) => isBlockedIp(r.address))) {
    throw new Error('O domínio informado aponta para uma rede não pública.');
  }

  return parsed;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '—')
    .replace(/&bull;/gi, '•')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return n >= 32 && n <= 126000 ? String.fromCodePoint(n) : ' ';
    });
}

function htmlToStructuredText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : '';

  const metaDescMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const metaDesc = metaDescMatch ? decodeHtmlEntities(metaDescMatch[1]).trim() : '';

  let body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|canvas|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|section|article|header|li|tr|h[1-6]|dt|dd)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ');

  body = decodeHtmlEntities(body)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  const headerLines = [
    pageTitle ? `TÍTULO DA PÁGINA: ${pageTitle}` : '',
    metaDesc ? `DESCRIÇÃO: ${metaDesc}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const combined = [headerLines, body].filter(Boolean).join('\n\n').slice(0, 28_000);
  return { title: pageTitle, text: combined };
}

async function fetchWebsiteText(initialUrl: string): Promise<{ finalUrl: string; title: string; text: string }> {
  let currentUrl = await assertSafePublicUrl(initialUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(currentUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ERBotsKnowledgeImporter/2.0; +https://www.erbots.com.br)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error('Redirecionamento inválido retornado pelo site.');
      const nextResolved = new URL(location, currentUrl).toString();
      currentUrl = await assertSafePublicUrl(nextResolved);
      continue;
    }

    if (!res.ok) {
      throw new Error(`O site recusou a leitura automática (HTTP ${res.status}). Você pode copiar o texto da página e usar a aba "Colar Texto".`);
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain') &&
      !contentType.includes('application/xhtml')
    ) {
      throw new Error('Esse link não aponta para uma página web de texto/HTML.');
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Não foi possível ler o conteúdo retornado pelo site.');
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > MAX_HTML_BYTES) {
          chunks.push(value.subarray(0, Math.max(0, MAX_HTML_BYTES - (totalBytes - value.byteLength))));
          await reader.cancel().catch(() => {});
          break;
        }
        chunks.push(value);
      }
    }

    const merged = new Uint8Array(chunks.reduce((acc, c) => acc + c.byteLength, 0));
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }

    const rawHtml = new TextDecoder('utf-8', { fatal: false }).decode(merged);
    const { title, text } = contentType.includes('text/plain')
      ? { title: currentUrl.hostname, text: rawHtml.slice(0, 28_000).trim() }
      : htmlToStructuredText(rawHtml);

    if (text.length < 60) {
      throw new Error(
        'Este site carrega quase todo o conteúdo via aplicativo dinâmico ou possui pouco texto visível. Copie as informações da página e use a aba "Colar Cardápio / Texto"!'
      );
    }

    return { finalUrl: currentUrl.toString(), title, text };
  }

  throw new Error('O endereço realizou redirecionamentos demais.');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, url, rawText } = body;

    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;

    const tid = guard.tenant.id;
    const rl = checkRateLimit(`kb-import:${tid}`, 6, 10 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Aguarde ${rl.retryAfterSec}s antes de realizar uma nova importação automática.` },
        { status: 429 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: tenantRow } = await supabase
      .from('xerb_tenants')
      .select('id, name, segment, plan, subscription_status, trial_ends_at, is_super_admin, extra_ai_credits')
      .eq('id', tid)
      .single();

    if (!tenantRow) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const gate = await checkAiGate(supabase, tenantRow);
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'Sua franquia mensal ou período de teste expirou. Ative um plano para continuar.' },
        { status: 402 }
      );
    }

    let sourceText = '';
    let sourceLabel = '';

    if (typeof url === 'string' && url.trim()) {
      const fetched = await fetchWebsiteText(url.trim());
      sourceText = fetched.text;
      sourceLabel = fetched.title ? `${fetched.title} (${fetched.finalUrl})` : fetched.finalUrl;
    } else if (typeof rawText === 'string' && rawText.trim()) {
      sourceText = rawText.trim().slice(0, 28_000);
      if (sourceText.length < 30) {
        return NextResponse.json(
          { error: 'Cole um texto um pouco mais detalhado (pelo menos 30 caracteres) para a IA organizar.' },
          { status: 400 }
        );
      }
      sourceLabel = 'Texto / Cardápio colado pelo proprietário';
    } else {
      return NextResponse.json(
        { error: 'Informe a URL do seu site ou cole o texto com preços/informações.' },
        { status: 400 }
      );
    }

    const extracted = await extractKnowledgeFromSource({
      companyName: tenantRow.name,
      segment: tenantRow.segment,
      sourceLabel,
      rawText: sourceText,
    });

    if (extracted.tokensIn > 0 || extracted.tokensOut > 0) {
      await recordUsage(supabase, tid, {
        aiReplies: 1,
        tokensIn: extracted.tokensIn,
        tokensOut: extracted.tokensOut,
        consumeExtraCredit: Boolean(gate.usingExtraCredits),
      });
    }

    if (!extracted.items.length) {
      return NextResponse.json(
        {
          error:
            'A IA não encontrou preços, serviços ou perguntas claras nesse conteúdo. Tente colar diretamente seu cardápio ou tabela de serviços na aba "Colar Texto".',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      sourceLabel,
      items: extracted.items,
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.warn('[KB Import Source] Aviso:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao importar informações com IA.' },
      { status: 400 }
    );
  }
}
