import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getTenantForUser } from '@/lib/auth';
import { generateDailyPostForTenant } from '@/lib/ai/instagram-cron';
import { formatAIError } from '@/lib/ai/instagram-agent';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const tenant = await getTenantForUser(guard.ctx.userId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const result = await generateDailyPostForTenant(tenant.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erro ao gerar o post diário' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      hookTitle: result.hookTitle,
      dispatchedToWhatsApp: result.dispatchedToWhatsApp,
      message: result.dispatchedToWhatsApp
        ? 'Post estratégico gerado e enviado com sucesso para o seu WhatsApp!'
        : 'Post estratégico gerado com sucesso! Conecte seu WhatsApp para receber a aprovação direta no celular.',
    });
  } catch (err: any) {
    console.error('[API Instagram Dispatch WhatsApp POST]', err);
    const cleanError = formatAIError(err).message;
    return NextResponse.json({ error: cleanError }, { status: 500 });
  }
}
