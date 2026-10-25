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
import { PLANS, formatBRL, computeAnnualPricing } from '@/lib/plans';
import { getServiceSupabase } from '@/lib/supabase';

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

    // Sincroniza a base de conhecimento do super admin com os novos planos
    try {
      const db = getServiceSupabase();
      const { data: superAdmins } = await db.from('xerb_tenants').select('id').eq('is_super_admin', true);
      if (superAdmins && superAdmins.length) {
        const discount = addons.annualDiscountPercent || 20;
        const kbUpdates = [
          {
            title: 'Plano Start',
            content: `Ideal para autônomos, consultórios e pequenos negócios. Valor: ${formatBRL(plans.start.price)}/mês (ou ${formatBRL(computeAnnualPricing(plans.start.price, discount).monthlyEquivalent)}/mês no plano anual com ${discount}% OFF). Inclui: 1 conexão de WhatsApp, até ${plans.start.monthlyAiReplies.toLocaleString('pt-BR')} respostas de IA por mês, atendente IA Gemini 24/7, base de conhecimento (FAQ e serviços), personalização de tom de voz, horário de atendimento e suporte via WhatsApp.`
          },
          {
            title: 'Plano Pro',
            content: `O mais escolhido por empresas que buscam automação e controle. Valor: ${formatBRL(plans.pro.price)}/mês (ou ${formatBRL(computeAnnualPricing(plans.pro.price, discount).monthlyEquivalent)}/mês no plano anual com ${discount}% OFF). Inclui: 1 conexão de WhatsApp, até ${plans.pro.monthlyAiReplies.toLocaleString('pt-BR')} respostas de IA por mês, base de conhecimento ilimitada, transbordo humano inteligente, Live Chat / CRM em tempo real, histórico completo e suporte prioritário.`
          },
          {
            title: 'Plano Business',
            content: `Para empresas maiores, clínicas de alto fluxo e operações intensas. Valor: ${formatBRL(plans.business.price)}/mês (ou ${formatBRL(computeAnnualPricing(plans.business.price, discount).monthlyEquivalent)}/mês no plano anual com ${discount}% OFF). Inclui: 1 conexão de WhatsApp, até ${plans.business.monthlyAiReplies.toLocaleString('pt-BR')} respostas de IA por mês, IA com ajuste fino de prompts complexos, transbordo com roteamento de equipe, treinamento e setup assistido, e gerente de contas dedicado.`
          }
        ];
        for (const adminTenant of superAdmins) {
          for (const item of kbUpdates) {
            await db.from('xerb_knowledge_base')
              .update({ content: item.content })
              .eq('tenant_id', adminTenant.id)
              .eq('title', item.title);
          }
        }
      }
    } catch (syncErr) {
      console.warn('[Admin Plans PUT] Falha ao sincronizar KB do super admin:', syncErr);
    }

    return NextResponse.json({ success: true, plans, addons });
  } catch (err: any) {
    console.error('[Admin Plans PUT] Erro:', err);
    return NextResponse.json({ error: 'Não foi possível salvar os planos.' }, { status: 500 });
  }
}
