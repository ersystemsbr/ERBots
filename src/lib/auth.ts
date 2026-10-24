import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from './supabase';
import { isSuperAdminEmail } from './admin';

/**
 * Autenticação server-side baseada no JWT da sessão do Supabase.
 * NUNCA confie em headers de identidade enviados pelo navegador (ex.: x-user-email).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://byshrvdanwgjdipogoxm.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export interface AuthContext {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  isSuperAdmin: boolean;
  accessToken: string;
  metadata: Record<string, any>;
}

export function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Valida o JWT com o Supabase Auth e devolve o contexto do usuário (ou null).
 */
export async function authenticate(req: NextRequest): Promise<AuthContext | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.id || !data.user.email) return null;

    const email = data.user.email.toLowerCase().trim();
    const emailConfirmed = Boolean(data.user.email_confirmed_at);
    // Super admin exige e-mail confirmado para evitar personificação por cadastro
    const isSuperAdmin = emailConfirmed && (await isSuperAdminEmail(email));

    return {
      userId: data.user.id,
      email,
      emailConfirmed,
      isSuperAdmin,
      accessToken: token,
      metadata: (data.user.user_metadata as Record<string, any>) || {},
    };
  } catch (err) {
    console.error('[Auth] Falha ao validar token:', err);
    return null;
  }
}

export function unauthorized(message = 'Autenticação necessária.') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Acesso não autorizado.') {
  return NextResponse.json({ error: message }, { status: 403 });
}

type GuardResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse };

/** Exige usuário autenticado (qualquer um). */
export async function requireUser(req: NextRequest): Promise<GuardResult> {
  const ctx = await authenticate(req);
  if (!ctx) return { ok: false, response: unauthorized() };
  return { ok: true, ctx };
}

/** Exige Super Admin da plataforma. */
export async function requireSuperAdmin(req: NextRequest): Promise<GuardResult> {
  const ctx = await authenticate(req);
  if (!ctx) return { ok: false, response: unauthorized() };
  if (!ctx.isSuperAdmin) return { ok: false, response: forbidden() };
  return { ok: true, ctx };
}

/**
 * Exige que o usuário seja dono do tenant informado (ou Super Admin).
 * Retorna também o registro do tenant (id, name, slug, phone, user_id).
 */
export async function requireTenantAccess(
  req: NextRequest,
  tenantId: string | undefined | null
): Promise<
  | { ok: true; ctx: AuthContext; tenant: { id: string; name: string; slug: string; phone: string | null; user_id: string | null } }
  | { ok: false; response: NextResponse }
> {
  const ctx = await authenticate(req);
  if (!ctx) return { ok: false, response: unauthorized() };

  if (!tenantId || typeof tenantId !== 'string') {
    return { ok: false, response: NextResponse.json({ error: 'tenant_id é obrigatório.' }, { status: 400 }) };
  }

  const supabase = getServiceSupabase();
  const { data: tenant } = await supabase
    .from('xerb_tenants')
    .select('id, name, slug, phone, user_id')
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenant) {
    return { ok: false, response: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) };
  }

  if (!ctx.isSuperAdmin && tenant.user_id !== ctx.userId) {
    return { ok: false, response: forbidden('Você não tem permissão para acessar esta empresa.') };
  }

  return { ok: true, ctx, tenant };
}
