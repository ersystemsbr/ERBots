import { NextResponse } from 'next/server';
import { getAddonsConfig, getPlansConfig } from '@/lib/billing/plans-config';

export const maxDuration = 15;

/** Catálogo público de planos e ofertas comerciais (desconto anual e pacote extra). */
export async function GET() {
  try {
    const [plans, addons] = await Promise.all([getPlansConfig(), getAddonsConfig()]);
    return NextResponse.json(
      { plans, addons },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
    );
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Plans GET] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar planos.' }, { status: 500 });
  }
}
