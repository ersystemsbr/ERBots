import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { isSuperAdminEmail } from '@/lib/admin';

export const maxDuration = 30;

export async function PATCH(req: NextRequest) {
  try {
    const authEmail = (req.headers.get('x-user-email') || '').toLowerCase().trim();
    const body = await req.json();
    const { tenant_id, name, segment, phone, email, slug } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id é obrigatório.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Busca o tenant para validar permissão
    const { data: existingTenant, error: fetchErr } = await supabase
      .from('xerb_tenants')
      .select('*')
      .eq('id', tenant_id)
      .maybeSingle();

    if (fetchErr || !existingTenant) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    // 2. Valida se o usuário tem permissão para editar este tenant
    const isAdmin = await isSuperAdminEmail(authEmail);
    const isOwner = authEmail && existingTenant.email && authEmail === existingTenant.email.toLowerCase().trim();

    // Se não for super admin nem dono registrado pelo e-mail, checa se há match de usuário logado
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Você não tem permissão para alterar os dados desta empresa.' },
        { status: 403 }
      );
    }

    // 3. Monta o payload de atualização
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = String(name).trim();
    if (segment !== undefined) updatePayload.segment = String(segment).trim();
    if (phone !== undefined) updatePayload.phone = String(phone).trim() || null;
    if (email !== undefined) updatePayload.email = String(email).trim().toLowerCase() || null;
    if (slug !== undefined) {
      const cleanSlug = String(slug)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .trim();
      if (cleanSlug) updatePayload.slug = cleanSlug;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('xerb_tenants')
      .update(updatePayload)
      .eq('id', tenant_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, tenant: updated });
  } catch (err: any) {
    console.error('[Tenant Profile PATCH] Erro:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno ao salvar dados.' }, { status: 500 });
  }
}
