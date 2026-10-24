import { NextResponse } from 'next/server';
import { getPlansConfig } from '@/lib/billing/plans-config';

export const maxDuration = 15;

/** Tabela pública de planos (nada sensível): usada pela landing, tela de planos e admin. */
export async function GET() {
  try {
    const plans = await getPlansConfig();
    return NextResponse.json(
      { plans },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
    );
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) throw err;
    console.error('[Plans GET] Erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar planos.' }, { status: 500 });
  }
}
