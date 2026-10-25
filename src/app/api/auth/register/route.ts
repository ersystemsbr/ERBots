import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_GEMINI_MODEL } from '@/lib/ai/gemini';
import { getServiceSupabase } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getTemplatesForSegment } from '@/lib/segment-templates';

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
    const ip = getClientIp(req);
    const rl = checkRateLimit(`register:${ip}`, 5, 15 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas de cadastro a partir desta rede. Aguarde ${Math.ceil(rl.retryAfterSec / 60)} min.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { companyName, ownerName, segment, phone, email, password, website, acceptedTerms } = body;

    // Honeypot invisível contra bots automatizados
    if (website && String(website).trim().length > 0) {
      return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 });
    }

    if (!companyName || !email || !password) {
      return NextResponse.json({ error: 'Nome da empresa, e-mail e senha são obrigatórios.' }, { status: 400 });
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres.' }, { status: 400 });
    }

    if (acceptedTerms !== true) {
      return NextResponse.json(
        { error: 'É necessário aceitar os Termos de Uso e a Política de Privacidade (LGPD).' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanCompany = String(companyName).trim().slice(0, 120);
    const cleanOwner = ownerName ? String(ownerName).trim().slice(0, 120) : '';
    const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(0, 20) : null;
    const termsAcceptedAt = new Date().toISOString();

    const supabase = getServiceSupabase();

    // 1. Cria ou cadastra o usuário no Supabase Auth
    let userId: string | null = null;
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: cleanOwner || cleanCompany,
          company_name: cleanCompany,
          phone: cleanPhone,
          terms_accepted_at: termsAcceptedAt,
        },
      },
    });

    if (authErr) {
      // Se o usuário já existe no Supabase Auth (ex: veio do GastroSys), valida a senha e vincula
      if (authErr.message.includes('already registered')) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInErr) {
          return NextResponse.json(
            { error: 'Este e-mail já possui cadastro. Use sua senha atual ou recupere a senha na tela de login.' },
            { status: 400 }
          );
        }

        userId = signInData.user?.id || null;

        // Se já possui tenant no ERBots, não precisa criar outro
        const { data: existingTenant } = await supabase
          .from('xerb_tenants')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingTenant) {
          return NextResponse.json({
            success: true,
            tenant: existingTenant,
            message: 'Conta já existente conectada com sucesso ao ERBots.',
          });
        }
      } else {
        return NextResponse.json({ error: authErr.message }, { status: 400 });
      }
    } else {
      userId = authData.user?.id || null;
    }

    // 2. Cria o Tenant em xerb_tenants
    const slug = generateSlug(cleanCompany);
    const trialDays = 7;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: tenant, error: tenantErr } = await supabase
      .from('xerb_tenants')
      .insert({
        user_id: userId,
        name: cleanCompany,
        slug,
        segment: segment || 'Geral',
        phone: cleanPhone,
        email: normalizedEmail,
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
      bot_name: `Atendente da ${cleanCompany}`,
      tone: 'friendly',
      gemini_model: DEFAULT_GEMINI_MODEL,
      system_prompt: `Você é a atendente virtual inteligente da empresa ${cleanCompany} (${segment || 'Serviços'}). Seja acolhedora, objetiva, tire dúvidas com base nas informações cadastradas e conduza o cliente para agendamento ou fechamento com simpatia.`,
      is_active: true,
      human_handoff_enabled: true,
    });

    // 4. Popula Base de Conhecimento inicial personalizada para o segmento escolhido
    const starterTemplates = getTemplatesForSegment(segment).map((tpl) => ({
      tenant_id: tenant.id,
      category: tpl.category,
      title: tpl.title,
      content: tpl.content,
      is_active: true,
    }));

    await supabase.from('xerb_knowledge_base').insert(starterTemplates);

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
