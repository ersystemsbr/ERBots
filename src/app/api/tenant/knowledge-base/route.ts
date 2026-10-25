import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

const VALID_CATEGORIES = new Set(['faq', 'service', 'product', 'policy', 'general']);
const MAX_TITLE_LEN = 160;
const MAX_CONTENT_LEN = 3000;

function maxKbItemsForTenant(tenant: any): number {
  if (tenant?.is_super_admin) return 2000;
  const plan = String(tenant?.plan || 'trial').toLowerCase();
  if (plan === 'business') return 1000;
  if (plan === 'pro') return 350;
  return 100; // trial & start
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = new URL(req.url).searchParams.get('tenant_id');
    const guard = await requireTenantAccess(req, tenantId);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('xerb_knowledge_base')
      .select('*')
      .eq('tenant_id', guard.tenant.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    console.error('[KnowledgeBase GET] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar base de conhecimento.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const guard = await requireTenantAccess(req, body.tenant_id);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    const tid = guard.tenant.id;
    const maxItems = maxKbItemsForTenant(guard.tenant);

    const { count: currentCount } = await supabase
      .from('xerb_knowledge_base')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid);

    const rawItems: any[] = Array.isArray(body.items) ? body.items : [body];
    if (rawItems.length === 0 || rawItems.length > 30) {
      return NextResponse.json({ error: 'Quantidade inválida de itens por envio.' }, { status: 400 });
    }

    if ((currentCount || 0) + rawItems.length > maxItems) {
      return NextResponse.json(
        {
          error: `Limite de ${maxItems} itens na Base de Conhecimento atingido para o seu plano atual. Remova itens antigos ou faça upgrade.`,
        },
        { status: 403 }
      );
    }

    const toInsert = [];
    for (const raw of rawItems) {
      const title = String(raw?.title || '').trim();
      const content = String(raw?.content || '').trim();
      if (!title || !content) {
        return NextResponse.json({ error: 'Preencha o título e o conteúdo da informação.' }, { status: 400 });
      }
      if (title.length > MAX_TITLE_LEN || content.length > MAX_CONTENT_LEN) {
        return NextResponse.json(
          { error: `Cada item pode ter até ${MAX_TITLE_LEN} caracteres no título e ${MAX_CONTENT_LEN} no conteúdo.` },
          { status: 400 }
        );
      }
      const cat = String(raw?.category || 'faq').toLowerCase();
      toInsert.push({
        tenant_id: tid,
        category: VALID_CATEGORIES.has(cat) ? cat : 'faq',
        title,
        content,
        is_active: raw?.is_active !== false,
      });
    }

    const { data, error } = await supabase.from('xerb_knowledge_base').insert(toInsert).select();
    if (error) throw error;

    return NextResponse.json({ success: true, items: data || [] });
  } catch (err) {
    console.error('[KnowledgeBase POST] Erro:', err);
    return NextResponse.json({ error: 'Erro ao salvar item na base de conhecimento.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const guard = await requireTenantAccess(req, body.tenant_id);
    if (!guard.ok) return guard.response;

    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'ID do item é obrigatório.' }, { status: 400 });
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (!t || t.length > MAX_TITLE_LEN) {
        return NextResponse.json({ error: `Título inválido (máx. ${MAX_TITLE_LEN} caracteres).` }, { status: 400 });
      }
      updateData.title = t;
    }
    if (body.content !== undefined) {
      const c = String(body.content).trim();
      if (!c || c.length > MAX_CONTENT_LEN) {
        return NextResponse.json({ error: `Conteúdo inválido (máx. ${MAX_CONTENT_LEN} caracteres).` }, { status: 400 });
      }
      updateData.content = c;
    }
    if (body.category !== undefined) {
      const cat = String(body.category).toLowerCase();
      updateData.category = VALID_CATEGORIES.has(cat) ? cat : 'faq';
    }
    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('xerb_knowledge_base')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', guard.tenant.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, item: data });
  } catch (err) {
    console.error('[KnowledgeBase PATCH] Erro:', err);
    return NextResponse.json({ error: 'Erro ao atualizar item.' }, { status: 500 });
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
      return NextResponse.json({ error: 'ID do item é obrigatório.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('xerb_knowledge_base')
      .delete()
      .eq('id', id)
      .eq('tenant_id', guard.tenant.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[KnowledgeBase DELETE] Erro:', err);
    return NextResponse.json({ error: 'Erro ao remover item.' }, { status: 500 });
  }
}
