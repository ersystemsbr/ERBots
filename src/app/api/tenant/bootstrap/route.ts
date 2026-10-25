import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser } from '@/lib/auth';

export const maxDuration = 30;

function buildSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return `${base || 'empresa'}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Localiza (ou vincula/cria) o tenant do usuário autenticado.
 * Toda a lógica de vínculo vive no servidor: o navegador não decide plano, status nem posse.
 *
 * Regras:
 *  1. Tenant já vinculado ao user_id → retorna.
 *  2. Tenant "órfão" (user_id nulo) com o mesmo e-mail e e-mail confirmado → vincula.
 *     (Nunca "rouba" tenant que já pertence a outro usuário.)
 *  3. Caso contrário → cria tenant + configurações iniciais do robô.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;
    const { ctx } = guard;

    const supabase = getServiceSupabase();

    // 1. Já vinculado por user_id
    const { data: owned } = await supabase
      .from('xerb_tenants')
      .select('*')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (owned && owned.length > 0) {
      return NextResponse.json({ tenant: owned[0], isSuperAdmin: ctx.isSuperAdmin });
    }

    // 2. Tenant órfão com o mesmo e-mail
    if (ctx.emailConfirmed) {
      const { data: orphan } = await supabase
        .from('xerb_tenants')
        .select('*')
        .is('user_id', null)
        .eq('email', ctx.email)
        .order('created_at', { ascending: false })
        .limit(1);

      if (orphan && orphan.length > 0) {
        const { data: claimed, error: claimErr } = await supabase
          .from('xerb_tenants')
          .update({ user_id: ctx.userId, updated_at: new Date().toISOString() })
          .eq('id', orphan[0].id)
          .is('user_id', null)
          .select()
          .single();

        if (!claimErr && claimed) {
          return NextResponse.json({ tenant: claimed, isSuperAdmin: ctx.isSuperAdmin });
        }
      }
    }

    // 3. Cria novo tenant
    const compName = String(
      ctx.metadata?.company_name || ctx.metadata?.full_name || (ctx.isSuperAdmin ? 'ER Systems' : 'Minha Empresa')
    ).slice(0, 120);
    const isSuper = ctx.isSuperAdmin;

    const { data: created, error: createErr } = await supabase
      .from('xerb_tenants')
      .insert({
        user_id: ctx.userId,
        name: compName,
        slug: buildSlug(compName),
        segment: 'Geral',
        email: ctx.email,
        plan: isSuper ? 'business' : 'trial',
        subscription_status: isSuper ? 'active' : 'trialing',
        trial_ends_at: new Date(Date.now() + (isSuper ? 365 : 7) * 24 * 60 * 60 * 1000).toISOString(),
        is_super_admin: isSuper,
      })
      .select()
      .single();

    if (createErr || !created) {
      if ((createErr as any)?.code === '23505') {
        const { data: raced } = await supabase
          .from('xerb_tenants')
          .select('*')
          .eq('user_id', ctx.userId)
          .limit(1);
        if (raced && raced.length > 0) {
          return NextResponse.json({ tenant: raced[0], isSuperAdmin: ctx.isSuperAdmin });
        }
      }
      console.error('[Tenant Bootstrap] Erro ao criar tenant:', createErr);
      return NextResponse.json({ error: 'Não foi possível preparar sua conta.' }, { status: 500 });
    }

    await supabase.from('xerb_bot_settings').insert({
      tenant_id: created.id,
      bot_name: `Atendente da ${compName}`,
      tone: 'friendly',
      system_prompt: `Você é o atendente virtual inteligente da empresa ${compName}.`,
      is_active: true,
      human_handoff_enabled: true,
    });

    return NextResponse.json({ tenant: created, isSuperAdmin: ctx.isSuperAdmin });
  } catch (err: any) {
    console.error('[Tenant Bootstrap] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao carregar sua conta.' }, { status: 500 });
  }
}
