import { getServiceSupabase } from './supabase';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEventInput {
  level: LogLevel;
  source: string;
  message: string;
  tenantId?: string | null;
  metadata?: Record<string, any>;
  error?: unknown;
}

const SENSITIVE_KEY_RE = /(secret|token|password|apikey|api_key|authorization|service_role)/i;

function sanitizeMetadata(meta?: Record<string, any>): Record<string, any> {
  if (!meta || typeof meta !== 'object') return {};
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'string' && v.length > 1000) {
      clean[k] = `${v.slice(0, 1000)}…`;
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function serializeError(err: unknown): Record<string, any> | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message.slice(0, 500),
      stack: err.stack ? err.stack.slice(0, 2000) : undefined,
    };
  }
  return { message: String(err).slice(0, 500) };
}

/**
 * Envia erro para o Sentry via HTTP Store API caso SENTRY_DSN esteja configurado
 * (sem exigir pacote nativo pesado no bundle serverless).
 */
async function forwardToSentry(input: LogEventInput, errInfo?: Record<string, any>) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || input.level === 'info') return;

  try {
    const u = new URL(dsn);
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\/+/, '');
    if (!publicKey || !projectId) return;

    const storeUrl = `${u.protocol}//${u.host}/api/${projectId}/store/?sentry_key=${publicKey}&sentry_version=7`;
    const payload = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: input.level === 'warn' ? 'warning' : 'error',
      logger: input.source,
      server_name: 'erbots',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
      message: { formatted: `[${input.source}] ${input.message}` },
      tags: {
        source: input.source,
        ...(input.tenantId ? { tenant_id: input.tenantId } : {}),
      },
      extra: {
        ...sanitizeMetadata(input.metadata),
        ...(errInfo ? { error: errInfo } : {}),
      },
    };

    await fetch(storeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Silencioso para nunca impactar o fluxo principal
  }
}

/**
 * Envia alerta para webhook externo opcional (Slack, Discord, n8n, Telegram etc.)
 */
async function forwardToAlertWebhook(input: LogEventInput, errInfo?: Record<string, any>) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || input.level === 'info') return;

  try {
    const text = `${input.level === 'error' ? '🚨' : '⚠️'} *[ERBots • ${input.source}]* ${input.message}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: text,
        text,
        level: input.level,
        source: input.source,
        message: input.message,
        tenantId: input.tenantId || null,
        error: errInfo,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Silencioso
  }
}

/**
 * Registra evento estruturado no console, na tabela xerb_system_logs e (se configurados)
 * encaminha erros/alertas para Sentry e Webhook externo.
 */
export async function logSystemEvent(input: LogEventInput): Promise<void> {
  const errInfo = serializeError(input.error);
  const metadata = {
    ...sanitizeMetadata(input.metadata),
    ...(errInfo ? { error: errInfo } : {}),
  };

  const logLine = `[ERBots:${input.level.toUpperCase()}][${input.source}] ${input.message}`;
  if (input.level === 'error') {
    console.error(logLine, metadata);
  } else if (input.level === 'warn') {
    console.warn(logLine, metadata);
  } else {
    console.log(logLine);
  }

  try {
    const supabase = getServiceSupabase();
    await supabase.from('xerb_system_logs').insert({
      level: input.level,
      source: input.source.slice(0, 80),
      message: input.message.slice(0, 1000),
      tenant_id: input.tenantId || null,
      metadata,
    });

    // Limpeza oportunística (1% das gravações remove logs > 30 dias para evitar crescimento infinito)
    if (Math.random() < 0.01) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('xerb_system_logs').delete().lt('created_at', cutoff);
    }
  } catch {
    // Se a tabela ainda não existir ou o banco oscilar, nunca interrompe a requisição
  }

  await Promise.allSettled([
    forwardToSentry(input, errInfo),
    forwardToAlertWebhook(input, errInfo),
  ]);
}
