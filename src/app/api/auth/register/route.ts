import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base || 'empresa'}-${randomSuffix}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyName, ownerName, segment, phone, email, password } = body;

    if (!companyName || !email || !password) {
      return NextResponse.json({ error: 'Nome da empresa, e-mail e senha são obrigatórios.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Cria ou cadastra o usuário no Supabase Auth
    let userId: string | null = null;
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: ownerName || companyName,
          company_name: companyName,
          phone,
        },
      },
    });

    if (authErr) {
      // Se o erro for que já existe, tenta fazer sign in
      if (authErr.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'Este e-mail já está cadastrado. Por favor, faça login.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    userId = authData.user?.id || null;

    // 2. Cria o Tenant em xerb_tenants
    const slug = generateSlug(companyName);
    const trialDays = 7;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: tenant, error: tenantErr } = await supabase
      .from('xerb_tenants')
      .insert({
        user_id: userId,
        name: companyName,
        slug,
        segment: segment || 'Geral',
        phone: phone || null,
        email,
        plan: 'trial',
        subscription_status: 'trialing',
        trial_ends_at: trialEndsAt,
      })
      .select()
      .single();

    if (tenantErr) {
      console.error('[Register] Erro ao criar tenant:', tenantErr);
      return NextResponse.json({ error: 'Erro ao cadastrar empresa.' }, { status: 500 });
    }

    // 3. Cria as configurações do robô em xerb_bot_settings
    await supabase.from('xerb_bot_settings').insert({
      tenant_id: tenant.id,
      bot_name: `Atendente da ${companyName}`,
      tone: 'friendly',
      gemini_model: 'gemini-3.5-flash',
      system_prompt: `Você é o atendente virtual inteligente da empresa ${companyName} (${segment || 'Serviços'}). Seja acolhedor, tire dúvidas e passe informações com simpatia.`,
      is_active: true,
      human_handoff_enabled: true,
    });

    // 4. Cria itens iniciais de exemplo na base de conhecimento
    const starterFaq = [
      {
        tenant_id: tenant.id,
        category: 'faq',
        title: 'Horário de Atendimento',
        content: 'Nosso horário comercial é de Segunda a Sexta das 08h às 18h e Sábados das 08h às 12h.',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        category: 'faq',
        title: 'Formas de Pagamento',
        content: 'Aceitamos Pix, Cartão de Crédito, Cartão de Débito e Dinheiro.',
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        category: 'service',
        title: 'Agendamento e Orçamento',
        content: 'Para agendar uma data ou tirar dúvidas sobre preços, basta nos enviar sua preferência que confirmamos!',
        is_active: true,
      },
    ];

    await supabase.from('xerb_knowledge_base').insert(starterFaq);

    return NextResponse.json({
      success: true,
      tenant,
      session: authData.session,
    });
  } catch (err: any) {
    console.error('[Register] Erro inesperado:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
