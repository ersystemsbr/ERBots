-- ==============================================================================
-- ERBots SaaS - Script de Criação do Schema Isolado e Tabelas Multi-Tenant
-- Executar no SQL Editor do Supabase
-- ==============================================================================

-- 1. Criação do Schema Dedicado 'erbots'
CREATE SCHEMA IF NOT EXISTS erbots;

-- Habilita extensão de UUID se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Tenants (Empresas / Assinantes)
CREATE TABLE IF NOT EXISTS erbots.tenants (
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

-- 3. Tabela de Instâncias do WhatsApp (Conexão via Evolution API)
CREATE TABLE IF NOT EXISTS erbots.instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES erbots.tenants(id) ON DELETE CASCADE,
    instance_name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'DISCONNECTED' CHECK (status IN ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'QRCODE')),
    phone_connected TEXT,
    profile_name TEXT,
    profile_picture_url TEXT,
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Configurações do Robô / IA por Tenant
CREATE TABLE IF NOT EXISTS erbots.bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES erbots.tenants(id) ON DELETE CASCADE,
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
    gemini_model TEXT DEFAULT 'gemini-1.5-flash',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Base de Conhecimento / FAQ (Instruções específicas de cada negócio)
CREATE TABLE IF NOT EXISTS erbots.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES erbots.tenants(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'faq' CHECK (category IN ('faq', 'service', 'product', 'policy', 'general')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Tabela de Conversas (Sessões de Clientes no WhatsApp)
CREATE TABLE IF NOT EXISTS erbots.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES erbots.tenants(id) ON DELETE CASCADE,
    remote_jid TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT,
    handling_status TEXT DEFAULT 'AI' CHECK (handling_status IN ('AI', 'HUMAN', 'CLOSED')),
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    unread_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT erbots_unique_tenant_contact UNIQUE (tenant_id, remote_jid)
);

-- 7. Tabela de Mensagens (Histórico de cada conversa)
CREATE TABLE IF NOT EXISTS erbots.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES erbots.conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES erbots.tenants(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'ai', 'human')),
    content TEXT NOT NULL,
    media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Tabela de Configurações Globais do Sistema (Evolution API, etc.)
CREATE TABLE IF NOT EXISTS erbots.system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configurações padrão da Evolution API no schema erbots
INSERT INTO erbots.system_config (key, value, description)
VALUES 
    ('evolution_api_url', 'https://mia-easter-semester-eddie.trycloudflare.com', 'URL pública da Evolution API no servidor Linux'),
    ('evolution_api_key', '4296ef346897636e05d2524f2b1860e6', 'Chave Global API da Evolution API')
ON CONFLICT (key) DO NOTHING;

-- 9. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_erbots_tenants_user ON erbots.tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_erbots_instances_tenant ON erbots.instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erbots_instances_name ON erbots.instances(instance_name);
CREATE INDEX IF NOT EXISTS idx_erbots_kb_tenant ON erbots.knowledge_base(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erbots_conv_tenant_jid ON erbots.conversations(tenant_id, remote_jid);
CREATE INDEX IF NOT EXISTS idx_erbots_messages_conv ON erbots.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_erbots_messages_tenant ON erbots.messages(tenant_id);

-- 10. Políticas de Segurança (Row Level Security - RLS)
ALTER TABLE erbots.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE erbots.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE erbots.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE erbots.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE erbots.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE erbots.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE erbots.system_config ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários autenticados gerenciarem seus próprios dados
DO $$ 
BEGIN
    -- Tenants
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own tenant' AND schemaname = 'erbots') THEN
        CREATE POLICY "Users can view own tenant" ON erbots.tenants FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own tenant' AND schemaname = 'erbots') THEN
        CREATE POLICY "Users can update own tenant" ON erbots.tenants FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own tenant' AND schemaname = 'erbots') THEN
        CREATE POLICY "Users can insert own tenant" ON erbots.tenants FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Instances
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage instances' AND schemaname = 'erbots') THEN
        CREATE POLICY "Tenant users manage instances" ON erbots.instances FOR ALL USING (
            tenant_id IN (SELECT id FROM erbots.tenants WHERE user_id = auth.uid())
        );
    END IF;

    -- Bot Settings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage bot settings' AND schemaname = 'erbots') THEN
        CREATE POLICY "Tenant users manage bot settings" ON erbots.bot_settings FOR ALL USING (
            tenant_id IN (SELECT id FROM erbots.tenants WHERE user_id = auth.uid())
        );
    END IF;

    -- Knowledge Base
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage knowledge base' AND schemaname = 'erbots') THEN
        CREATE POLICY "Tenant users manage knowledge base" ON erbots.knowledge_base FOR ALL USING (
            tenant_id IN (SELECT id FROM erbots.tenants WHERE user_id = auth.uid())
        );
    END IF;

    -- Conversations & Messages
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage conversations' AND schemaname = 'erbots') THEN
        CREATE POLICY "Tenant users manage conversations" ON erbots.conversations FOR ALL USING (
            tenant_id IN (SELECT id FROM erbots.tenants WHERE user_id = auth.uid())
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant users manage messages' AND schemaname = 'erbots') THEN
        CREATE POLICY "Tenant users manage messages" ON erbots.messages FOR ALL USING (
            tenant_id IN (SELECT id FROM erbots.tenants WHERE user_id = auth.uid())
        );
    END IF;

    -- Permissão de serviço (Service Role) tem acesso total a tudo
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access tenants' AND schemaname = 'erbots') THEN
        CREATE POLICY "Service role full access tenants" ON erbots.tenants FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access instances' AND schemaname = 'erbots') THEN
        CREATE POLICY "Service role full access instances" ON erbots.instances FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access bot_settings' AND schemaname = 'erbots') THEN
        CREATE POLICY "Service role full access bot_settings" ON erbots.bot_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access knowledge_base' AND schemaname = 'erbots') THEN
        CREATE POLICY "Service role full access knowledge_base" ON erbots.knowledge_base FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access conversations' AND schemaname = 'erbots') THEN
        CREATE POLICY "Service role full access conversations" ON erbots.conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access messages' AND schemaname = 'erbots') THEN
        CREATE POLICY "Service role full access messages" ON erbots.messages FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access system_config' AND schemaname = 'erbots') THEN
        CREATE POLICY "Service role full access system_config" ON erbots.system_config FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
