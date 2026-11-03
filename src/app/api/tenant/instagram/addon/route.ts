import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const { action } = await req.json().catch(() => ({ action: 'activate' }));
    const db = getServiceSupabase();

    const isActivating = action === 'activate';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data: updatedTenant, error } = await db
      .from('xerb_tenants')
      .update({
        has_instagram_module: isActivating,
        instagram_module_status: isActivating ? 'active' : 'inactive',
        instagram_module_expires_at: isActivating ? expiresAt.toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant.id)
      .select('id, name, has_instagram_module, instagram_module_status')
      .single();

    if (error) throw error;

    if (isActivating) {
      await db.from('xerb_instagram_accounts').upsert(
        {
          tenant_id: tenant.id,
          account_name: updatedTenant.name || 'Conta Instagram',
          niche: 'Comércio & Serviços',
          approval_mode: 'whatsapp_required',
          preferred_post_time: '18:00:00',
        },
        { onConflict: 'tenant_id' }
      );
    }

    return NextResponse.json({ success: true, tenant: updatedTenant });
  } catch (err: any) {
    console.error('[API Instagram Addon POST]', err);
    return NextResponse.json({ error: err?.message || 'Erro ao processar ativação do módulo' }, { status: 500 });
  }
}
