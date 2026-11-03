import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { auditInstagramProfile } from '@/lib/ai/instagram-agent';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const { currentBio } = await req.json().catch(() => ({}));
    const db = getServiceSupabase();
    const { data: account } = await db
      .from('xerb_instagram_accounts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    const audit = await auditInstagramProfile({
      username: (account?.account_username || 'seu_perfil').replace(/^@+/, ''),
      accountName: account?.account_name || tenant.name || 'Sua Empresa',
      niche: account?.niche || 'Geral',
      targetAudience: account?.target_audience || 'Clientes locais',
      currentBio: currentBio || undefined,
    });

    return NextResponse.json({ success: true, audit });
  } catch (err: any) {
    console.error('[API Instagram Audit POST]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao auditar perfil do Instagram' },
      { status: 500 }
    );
  }
}
