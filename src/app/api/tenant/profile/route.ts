import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireTenantAccess } from '@/lib/auth';

export const maxDuration = 30;

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, name, segment, phone, email, slug } = body;

    // Autenticação + autorização por posse (user_id) — o e-mail de contato NÃO define permissão
    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      const clean = String(name).trim();
      if (!clean || clean.length > 120) {
        return NextResponse.json({ error: 'Informe um nome de empresa válido (até 120 caracteres).' }, { status: 400 });
      }
      updatePayload.name = clean;
    }
    if (segment !== undefined) updatePayload.segment = String(segment).trim().slice(0, 80);
    if (phone !== undefined) updatePayload.phone = String(phone).trim().slice(0, 30) || null;
    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase().slice(0, 160);
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return NextResponse.json({ error: 'E-mail de contato inválido.' }, { status: 400 });
      }
      updatePayload.email = cleanEmail || null;
    }
    if (slug !== undefined) {
      const cleanSlug = String(slug)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 60);
      if (!cleanSlug) {
        return NextResponse.json({ error: 'Identificador (slug) inválido.' }, { status: 400 });
      }
      updatePayload.slug = cleanSlug;
    }

    const supabase = getServiceSupabase();
    const { data: updated, error: updateErr } = await supabase
      .from('xerb_tenants')
      .update(updatePayload)
      .eq('id', guard.tenant.id)
      .select()
      .single();

    if (updateErr) {
      if ((updateErr as any).code === '23505') {
        return NextResponse.json({ error: 'Este identificador (slug) já está em uso. Escolha outro.' }, { status: 409 });
      }
      throw updateErr;
    }

    return NextResponse.json({ success: true, tenant: updated });
  } catch (err: any) {
    console.error('[Tenant Profile PATCH] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar dados.' }, { status: 500 });
  }
}
