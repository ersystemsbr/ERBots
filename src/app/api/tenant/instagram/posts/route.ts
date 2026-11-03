import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const db = getServiceSupabase();
    const { data: posts, error } = await db
      .from('xerb_instagram_posts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    return NextResponse.json({ posts: posts || [] });
  } catch (err: any) {
    console.error('[API Instagram Posts GET]', err);
    return NextResponse.json({ error: err?.message || 'Erro ao carregar posts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const { postId, action, scheduledFor } = await req.json();
    if (!postId || !action) {
      return NextResponse.json({ error: 'Parâmetros incompletos' }, { status: 400 });
    }

    const db = getServiceSupabase();
    let updates: any = { updated_at: new Date().toISOString() };

    if (action === 'approve') {
      updates.status = 'scheduled';
      updates.approval_responded_at = new Date().toISOString();
      if (scheduledFor) updates.scheduled_for = scheduledFor;
    } else if (action === 'reject') {
      updates.status = 'rejected';
      updates.approval_responded_at = new Date().toISOString();
    } else if (action === 'publish_now') {
      updates.status = 'published';
      updates.published_at = new Date().toISOString();
    }

    const { data, error } = await db
      .from('xerb_instagram_posts')
      .update(updates)
      .eq('id', postId)
      .eq('tenant_id', tenant.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, post: data });
  } catch (err: any) {
    console.error('[API Instagram Posts POST]', err);
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar post' }, { status: 500 });
  }
}
