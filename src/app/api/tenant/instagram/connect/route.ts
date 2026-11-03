import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { verifyInstagramConnection } from '@/lib/instagram-graph';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const { action, instagramBusinessId, accessToken } = await req.json();
    const db = getServiceSupabase();

    if (action === 'disconnect') {
      await db
        .from('xerb_instagram_accounts')
        .update({
          instagram_business_id: null,
          access_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenant.id);

      return NextResponse.json({ success: true, connected: false });
    }

    if (!instagramBusinessId || !accessToken) {
      return NextResponse.json(
        { error: 'Informe o Instagram Business ID e o Access Token da Meta.' },
        { status: 400 }
      );
    }

    // Valida com a Meta
    const check = await verifyInstagramConnection({
      instagramBusinessId: instagramBusinessId.trim(),
      accessToken: accessToken.trim(),
    });

    if (!check.valid) {
      return NextResponse.json(
        { error: `Falha ao validar conta na Meta: ${check.error}` },
        { status: 400 }
      );
    }

    // Salva a conexão ativa
    const { data: updated, error } = await db
      .from('xerb_instagram_accounts')
      .upsert(
        {
          tenant_id: tenant.id,
          instagram_business_id: instagramBusinessId.trim(),
          access_token: accessToken.trim(),
          account_username: check.username || undefined,
          account_name: check.name || undefined,
          profile_picture_url: check.profile_picture_url || undefined,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      connected: true,
      username: check.username,
      name: check.name,
      account: updated,
    });
  } catch (err: any) {
    console.error('[API Instagram Connect POST]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao conectar conta do Instagram' },
      { status: 500 }
    );
  }
}
