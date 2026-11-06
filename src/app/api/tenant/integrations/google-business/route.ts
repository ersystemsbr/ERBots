import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import {
  getGoogleBusinessConfig,
  saveGoogleBusinessConfig,
  generateGoogleReviewReply,
} from '@/lib/integrations/google-business';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenant_id');

    const guard = await requireTenantAccess(req, tenantIdParam);
    if (!guard.ok) return guard.response;

    const tenantId = guard.tenant.id;
    const config = await getGoogleBusinessConfig(tenantId);

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (err: any) {
    console.error('[Google Business GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar configurações.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, action, settings, sampleReview } = body;

    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;

    const tenantId = guard.tenant.id;

    if (action === 'test_ai_reply') {
      const reply = await generateGoogleReviewReply(guard.tenant.name || 'Restaurante', {
        author: sampleReview?.author || 'Cliente',
        rating: sampleReview?.rating || 5,
        comment: sampleReview?.comment || 'Comida maravilhosa e entrega super rápida!',
      });
      return NextResponse.json({ success: true, reply });
    }

    const saved = await saveGoogleBusinessConfig(tenantId, settings || {});

    return NextResponse.json({
      success: saved,
      message: saved ? 'Configurações do Google Meu Negócio salvas com sucesso!' : 'Erro ao salvar.',
    });
  } catch (err: any) {
    console.error('[Google Business POST]', err);
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 });
  }
}
