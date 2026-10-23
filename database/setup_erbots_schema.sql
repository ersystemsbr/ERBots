-- ==============================================================================
-- ERBots SaaS - Script de Criação de Tabelas com Prefixo 'xerb_'
-- Executar no SQL Editor do Supabase (Schema public)
-- ==============================================================================

-- Habilita extensão de UUID se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela de Tenants (Empresas / Assinantes)
CREATE TABLE IF NOT EXISTS public.xerb_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    segment TEXT DEFAULT 'Geral',
    phone TEXT,
    email TEXT,
    plan TEXT DEFAULT 'trial' CHECK (plan IN ('trial', 'start', 'pro', 'business')),
    subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
    trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Instâncias do WhatsApp (Conexão via Evolution API)
CREATE TABLE IF NOT EXISTS public.xerb_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    instance_name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'DISCONNECTED' CHECK (status IN ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'QRCODE')),
    phone_connected TEXT,
    profile_name TEXT,
    profile_picture_url TEXT,
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Configurações do Robô / IA por Tenant
CREATE TABLE IF NOT EXISTS public.xerb_bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    bot_name TEXT DEFAULT 'Atendente Virtual',
    tone TEXT DEFAULT 'friendly' CHECK (tone IN ('formal', 'friendly', 'enthusiastic', 'direct')),
    system_prompt TEXT DEFAULT 'Você é o atendente virtual inteligente da empresa. Seu objetivo é recepcionar os clientes no WhatsApp com cordialidade, tirar dúvidas sobre serviços, preços e horários, e auxiliá-los da melhor forma possível.',
    business_hours JSONB DEFAULT '{
        "enabled": false,
        "days": [1, 2, 3, 4, 5],
        "start": "08:00",
        "end": "18:00",
        "out_of_hours_message": "Olá! No momento estamos fora do nosso horário de atendimento. Deixe sua mensagem e responderemos assim que retornarmos!"
    }'::jsonb,
    human_handoff_enabled BOOLEAN DEFAULT true,
    human_handoff_keywords TEXT[] DEFAULT ARRAY['atendente', 'humano', 'falar com atendente', 'pessoa', 'suporte'],
    human_handoff_message TEXT DEFAULT 'Com certeza! Estou transferindo seu atendimento para nossa equipe humana. Aguarde um instante que já vamos te responder.',
    gemini_model TEXT DEFAULT 'gemini-3.8-flash',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Base de Conhecimento / FAQ (Instruções específicas de cada negócio)
CREATE TABLE IF NOT EXISTS public.xerb_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'faq' CHECK (category IN ('faq', 'service', 'product', 'policy', 'general')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Conversas (Sessões de Clientes no WhatsApp)
CREATE TABLE IF NOT EXISTS public.xerb_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    remote_jid TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT,
    handling_status TEXT DEFAULT 'AI' CHECK (handling_status IN ('AI', 'HUMAN', 'CLOSED')),
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    unread_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT xerb_unique_tenant_contact UNIQUE (tenant_id, remote_jid)
);

-- 6. Tabela de Mensagens (Histórico de cada conversa)
CREATE TABLE IF NOT EXISTS public.xerb_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.xerb_conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'ai', 'human')),
    content TEXT NOT NULL,
    media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Tabela de Configurações Globais do Sistema ERBots
CREATE TABLE IF NOT EXISTS public.xerb_system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configurações padrão da Evolution API
INSERT INTO public.xerb_system_config (key, value, description)
VALUES 
    ('evolution_api_url', 'https://mia-easter-semester-eddie.trycloudflare.com', 'URL pública da Evolution API no servidor Linux'),
    ('evolution_api_key', '4296ef346897636e05d2524f2b1860e6', 'Chave Global API da Evolution API')
ON CONFLICT (key) DO NOTHING;

-- 8. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_xerb_tenants_user ON public.xerb_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_xerb_instances_tenant ON public.xerb_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xerb_instances_name ON public.xerb_instances(instance_name);
CREATE INDEX IF NOT EXISTS idx_xerb_kb_tenant ON public.xerb_knowledge_base(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xerb_conv_tenant_jid ON public.xerb_conversations(tenant_id, remote_jid);
CREATE INDEX IF NOT EXISTS idx_xerb_messages_conv ON public.xerb_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_xerb_messages_tenant ON public.xerb_messages(tenant_id);

-- 9. Políticas de Segurança (Row Level Security - RLS)
ALTER TABLE public.xerb_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_system_config ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários autenticados gerenciarem seus próprios dados
DO $$ 
BEGIN
    -- xerb_tenants
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own xerb_tenant') THEN
        CREATE POLICY "Users can view own xerb_tenant" ON public.xerb_tenants FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own xerb_tenant') THEN
        CREATE POLICY "Users can update own xerb_tenant" ON public.xerb_tenants FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own xerb_tenant') THEN
        CREATE POLICY "Users can insert own xerb_tenant" ON public.xerb_tenants FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- xerb_instances
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage xerb_instances') THEN
        CREATE POLICY "Tenant users manage xerb_instances" ON public.xerb_instances FOR ALL USING (
            tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid())
        );
    END IF;

    -- xerb_bot_settings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage xerb_bot_settings') THEN
        CREATE POLICY "Tenant users manage xerb_bot_settings" ON public.xerb_bot_settings FOR ALL USING (
            tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid())
        );
    END IF;

    -- xerb_knowledge_base
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage xerb_knowledge_base') THEN
        CREATE POLICY "Tenant users manage xerb_knowledge_base" ON public.xerb_knowledge_base FOR ALL USING (
            tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid())
        );
    END IF;

    -- xerb_conversations & xerb_messages
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage xerb_conversations') THEN
        CREATE POLICY "Tenant users manage xerb_conversations" ON public.xerb_conversations FOR ALL USING (
            tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid())
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage xerb_messages') THEN
        CREATE POLICY "Tenant users manage xerb_messages" ON public.xerb_messages FOR ALL USING (
            tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid())
        );
    END IF;

    -- Permissão de serviço (Service Role) tem acesso total a tudo
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access xerb_tenants') THEN
        CREATE POLICY "Service role full access xerb_tenants" ON public.xerb_tenants FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access xerb_instances') THEN
        CREATE POLICY "Service role full access xerb_instances" ON public.xerb_instances FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access xerb_bot_settings') THEN
        CREATE POLICY "Service role full access xerb_bot_settings" ON public.xerb_bot_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access xerb_knowledge_base') THEN
        CREATE POLICY "Service role full access xerb_knowledge_base" ON public.xerb_knowledge_base FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access xerb_conversations') THEN
        CREATE POLICY "Service role full access xerb_conversations" ON public.xerb_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access xerb_messages') THEN
        CREATE POLICY "Service role full access xerb_messages" ON public.xerb_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access xerb_system_config') THEN
        CREATE POLICY "Service role full access xerb_system_config" ON public.xerb_system_config FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- Fallback público (anon) para leitura e inserção inicial durante fase de implantação/testes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read access xerb_tenants') THEN
        CREATE POLICY "Anon read access xerb_tenants" ON public.xerb_tenants FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read access xerb_instances') THEN
        CREATE POLICY "Anon read access xerb_instances" ON public.xerb_instances FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read access xerb_bot_settings') THEN
        CREATE POLICY "Anon read access xerb_bot_settings" ON public.xerb_bot_settings FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read access xerb_knowledge_base') THEN
        CREATE POLICY "Anon read access xerb_knowledge_base" ON public.xerb_knowledge_base FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read access xerb_conversations') THEN
        CREATE POLICY "Anon read access xerb_conversations" ON public.xerb_conversations FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read access xerb_messages') THEN
        CREATE POLICY "Anon read access xerb_messages" ON public.xerb_messages FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read access xerb_system_config') THEN
        CREATE POLICY "Anon read access xerb_system_config" ON public.xerb_system_config FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;
