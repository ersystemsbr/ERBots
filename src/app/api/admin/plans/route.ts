import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import {
  DEFAULT_ADDONS,
  getAddonsConfig,
  getPlanOverrides,
  getPlansConfig,
  saveAddonsConfig,
  savePlanOverrides,
} from '@/lib/billing/plans-config';
import { PLANS } from '@/lib/plans';

export const maxDuration = 30;

/** Retorna o padrão, os overrides atuais, os planos efetivos e as ofertas comerciais (anual / pacote extra). */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;
    const [overrides, plans, addons] = await Promise.all([
      getPlanOverrides(true),
      getPlansConfig(true),
      getAddonsConfig(true),
    ]);
    return NextResponse.json({
      defaults: PLANS,
      defaultAddons: DEFAULT_ADDONS,
      overrides,
      plans,
      addons,
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Admin Plans GET] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar planos.' }, { status: 500 });
  }
}

/** Salva preços/limites/textos e ofertas (desconto anual + pacote avulso). */
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    if (!body || typeof body.plans !== 'object') {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    }

    await savePlanOverrides(body.plans);
    if (body.addons && typeof body.addons === 'object') {
      await saveAddonsConfig(body.addons);
    }

    const [plans, addons] = await Promise.all([getPlansConfig(true), getAddonsConfig(true)]);
    return NextResponse.json({ success: true, plans, addons });
  } catch (err: any) {
    console.error('[Admin Plans PUT] Erro:', err);
    return NextResponse.json({ error: 'Não foi possível salvar os planos.' }, { status: 500 });
  }
}
