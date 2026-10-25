import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 40, 1), 100);

    const supabase = getServiceSupabase();
    let query = supabase
      .from('xerb_system_logs')
      .select('id, level, source, message, tenant_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (level && ['info', 'warn', 'error'].includes(level)) {
      query = query.eq('level', level);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ logs: [], warning: error.message });
    }

    return NextResponse.json({ logs: data || [] });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Logs] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar logs do sistema.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const supabase = getServiceSupabase();
    // Mantém apenas nada ou limpa todos os registros anteriores a agora
    await supabase
      .from('xerb_system_logs')
      .delete()
      .lte('created_at', new Date().toISOString());

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    return NextResponse.json({ error: 'Erro ao limpar logs.' }, { status: 500 });
  }
}
