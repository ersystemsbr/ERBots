import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import {
  getReengagementSettings,
  saveReengagementSettings,
  getTenantNpsQueue,
} from '@/lib/reengagement';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenant_id');

    const guard = await requireTenantAccess(req, tenantIdParam);
    if (!guard.ok) return guard.response;

    const tenantId = guard.tenant.id;
    const settings = await getReengagementSettings(tenantId);
    const npsQueue = await getTenantNpsQueue(tenantId);

    // Métricas simples
    const totalNpsSent = npsQueue.filter((q) => q.status === 'sent' || q.status === 'responded').length;
    const totalNpsResponded = npsQueue.filter((q) => q.status === 'responded').length;
    const ratings = npsQueue.map((q) => q.rating).filter((r): r is number => typeof r === 'number' && r > 0);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;

    return NextResponse.json({
      success: true,
      settings,
      stats: {
        totalNpsSent,
        totalNpsResponded,
        avgRating,
      },
      recentNps: npsQueue.slice(0, 10),
    });
  } catch (err: any) {
    console.error('[API Tenant Reengagement GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar configurações de reengajamento.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, settings } = body;

    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;

    const tenantId = guard.tenant.id;
    const saved = await saveReengagementSettings(tenantId, settings || {});

    return NextResponse.json({
      success: saved,
      message: saved
        ? 'Configurações de Vendas Ativas e Reengajamento salvas com sucesso!'
        : 'Erro ao salvar configurações.',
    });
  } catch (err: any) {
    console.error('[API Tenant Reengagement POST]', err);
    return NextResponse.json({ error: 'Erro ao processar configurações.' }, { status: 500 });
  }
}
