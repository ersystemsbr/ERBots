import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getPlanOverrides, getPlansConfig, savePlanOverrides } from '@/lib/billing/plans-config';
import { PLANS } from '@/lib/plans';

export const maxDuration = 30;

/** Retorna o padrão, os overrides atuais e o resultado efetivo. */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;
    const [overrides, plans] = await Promise.all([getPlanOverrides(true), getPlansConfig(true)]);
    return NextResponse.json({ defaults: PLANS, overrides, plans });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Plans GET] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar planos.' }, { status: 500 });
  }
}

/** Salva preços/limites/textos. Body: { plans: { start: {price, monthlyAiReplies, ...}, ... } } */
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    if (!body || typeof body.plans !== 'object') {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    }

    await savePlanOverrides(body.plans);
    const plans = await getPlansConfig(true);
    return NextResponse.json({ success: true, plans });
  } catch (err: any) {
    console.error('[Admin Plans PUT] Erro:', err);
    return NextResponse.json({ error: 'Não foi possível salvar os planos.' }, { status: 500 });
  }
}
