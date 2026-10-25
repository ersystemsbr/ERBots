import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

const VALID_STATUSES = new Set(['new', 'contacted', 'won', 'lost']);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const statusFilter = searchParams.get('status');

    const guard = await requireTenantAccess(req, tenantId);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    let query = supabase
      .from('xerb_leads')
      .select('*')
      .eq('tenant_id', guard.tenant.id)
      .order('created_at', { ascending: false })
      .limit(150);

    if (statusFilter && VALID_STATUSES.has(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ leads: data || [] });
  } catch (err) {
    console.error('[Tenant Leads GET] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar oportunidades.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const guard = await requireTenantAccess(req, body.tenant_id);
    if (!guard.ok) return guard.response;

    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'ID da oportunidade é obrigatório.' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      const st = String(body.status).toLowerCase().trim();
      if (!VALID_STATUSES.has(st)) {
        return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
      }
      updateData.status = st;
    }

    if (body.notes !== undefined) {
      updateData.notes = String(body.notes || '').trim().slice(0, 500) || null;
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('xerb_leads')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', guard.tenant.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, lead: data });
  } catch (err) {
    console.error('[Tenant Leads PATCH] Erro:', err);
    return NextResponse.json({ error: 'Erro ao atualizar oportunidade.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const id = searchParams.get('id');

    const guard = await requireTenantAccess(req, tenantId);
    if (!guard.ok) return guard.response;

    if (!id) {
      return NextResponse.json({ error: 'ID da oportunidade é obrigatório.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('xerb_leads')
      .delete()
      .eq('id', id)
      .eq('tenant_id', guard.tenant.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Tenant Leads DELETE] Erro:', err);
    return NextResponse.json({ error: 'Erro ao remover oportunidade.' }, { status: 500 });
  }
}
