import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from './supabase';

export interface ApiKeyAuthSuccess {
  ok: true;
  tenant: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    user_saas: string | null;
    plan: string | null;
    is_super_admin: boolean | null;
    webhook_url: string | null;
    webhook_secret: string | null;
  };
  instance: {
    id: string;
    instance_name: string;
    status: string;
    phone_connected: string | null;
  } | null;
}

export interface ApiKeyAuthFailure {
  ok: false;
  response: NextResponse;
}

export type ApiKeyAuthResult = ApiKeyAuthSuccess | ApiKeyAuthFailure;

/**
 * Autentica uma requisição via API Key da empresa (Header x-api-key ou Authorization: Bearer erb_live_...).
 * Projetado para integração com CRM (CRM61), GastroSys, GoControl ou sistemas externos.
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuthResult> {
  const headerKey = req.headers.get('x-api-key') || req.headers.get('x-erbots-api-key');
  const authHeader = req.headers.get('authorization');
  let bearerKey = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerKey = authHeader.substring(7).trim();
  }

  const apiKey = (headerKey || bearerKey || '').trim();

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Chave de API ausente. Envie o header "x-api-key" ou "Authorization: Bearer <ERBOTS_API_KEY>".',
        },
        { status: 401 }
      ),
    };
  }

  if (!apiKey.startsWith('erb_live_')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Formato de chave de API inválido. Chaves do ERBots iniciam com "erb_live_".' },
        { status: 401 }
      ),
    };
  }

  try {
    const supabase = getServiceSupabase();

    // 1. Busca a empresa pela API Key
    const { data: tenant, error: tenantErr } = await supabase
      .from('xerb_tenants')
      .select('id, name, slug, phone, user_saas, plan, is_super_admin, webhook_url, webhook_secret')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (tenantErr || !tenant) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Chave de API não encontrada ou revogada.' },
          { status: 401 }
        ),
      };
    }

    // 2. Busca a instância de WhatsApp vinculada à empresa
    const { data: instance } = await supabase
      .from('xerb_instances')
      .select('id, instance_name, status, phone_connected')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    return {
      ok: true,
      tenant,
      instance: instance || null,
    };
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[API Key Auth] Erro inesperado:', err);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Erro interno ao validar chave de API.' }, { status: 500 }),
    };
  }
}
