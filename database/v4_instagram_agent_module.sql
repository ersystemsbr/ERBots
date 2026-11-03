-- ==============================================================================
-- ERBots SaaS - Módulo Adicional: Agente Autônomo de Instagram
-- Executar no SQL Editor do Supabase (Schema public)
-- ==============================================================================

-- 1. Extensão de Tenants para suporte ao Módulo Instagram como Add-on contratado à parte
ALTER TABLE public.xerb_tenants 
ADD COLUMN IF NOT EXISTS has_instagram_module BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS instagram_module_status TEXT DEFAULT 'inactive' CHECK (instagram_module_status IN ('inactive', 'active', 'trialing', 'past_due', 'canceled')),
ADD COLUMN IF NOT EXISTS instagram_module_expires_at TIMESTAMPTZ;

-- 2. Tabela de Contas Conectadas do Instagram Business (via Meta Graph API)
CREATE TABLE IF NOT EXISTS public.xerb_instagram_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    facebook_page_id TEXT,
    instagram_business_id TEXT,
    account_name TEXT,
    account_username TEXT,
    profile_picture_url TEXT,
    access_token TEXT, -- Token de longa duração da Meta
    token_expires_at TIMESTAMPTZ,
    
    -- Configurações de Nicho e Marca
    niche TEXT DEFAULT 'Comércio & Serviços',
    target_audience TEXT DEFAULT 'Público local e clientes interessados em novidades e ofertas',
    brand_voice TEXT DEFAULT 'Profissional, acolhedor e focado em benefícios práticos',
    visual_style TEXT DEFAULT 'Fotografia realista, iluminação de estúdio limpa, cores vivas e estética profissional',
    
    -- Método de Economia de Tokens: Documento Condensado de Memória (Knowledge Digest)
    brand_knowledge_digest TEXT, -- Markdown condensado (300 a 500 palavras) sintetizando DNA, ganchos e regras
    digest_updated_at TIMESTAMPTZ,
    
    -- Configurações de Autonomia e Aprovação (Duas opções configuráveis)
    approval_mode TEXT DEFAULT 'whatsapp_required' CHECK (approval_mode IN ('whatsapp_required', 'auto_scheduled')),
    approval_timeout_hours INT DEFAULT 4,
    timeout_action TEXT DEFAULT 'auto_publish' CHECK (timeout_action IN ('auto_publish', 'skip')),
    preferred_post_time TIME DEFAULT '18:00:00',
    auto_generate_daily BOOLEAN DEFAULT true,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_tenant_instagram_account UNIQUE (tenant_id)
);

-- 3. Tabela de Posts de Instagram (Rascunhos, Aprovados, Imagens IA e Métricas)
CREATE TABLE IF NOT EXISTS public.xerb_instagram_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.xerb_instagram_accounts(id) ON DELETE CASCADE,
    
    post_type TEXT NOT NULL DEFAULT 'single_image' CHECK (post_type IN ('single_image', 'carousel', 'reel_script')),
    hook_title TEXT NOT NULL,
    caption TEXT NOT NULL,
    hashtags TEXT[] DEFAULT '{}',
    media_urls TEXT[] DEFAULT '{}',
    image_prompt TEXT, -- Prompt detalhado usado na geração da imagem via Imagen/Gemini
    visual_notes TEXT,
    
    -- Status do ciclo de vida da publicação
    status TEXT NOT NULL DEFAULT 'pending_approval' 
        CHECK (status IN ('draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'rejected', 'failed')),
    
    -- Controle de Aprovação Human-in-the-Loop via WhatsApp
    approval_requested_at TIMESTAMPTZ,
    approval_responded_at TIMESTAMPTZ,
    approval_whatsapp_msg_id TEXT,
    
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    
    -- IDs de publicação na Meta Graph API
    meta_media_container_id TEXT,
    meta_post_id TEXT,
    permalink TEXT,
    
    metrics JSONB DEFAULT '{"likes": 0, "comments": 0, "reach": 0, "saves": 0}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Automação de Comentários e Direct ("Comente X")
CREATE TABLE IF NOT EXISTS public.xerb_instagram_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.xerb_instagram_accounts(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.xerb_instagram_posts(id) ON DELETE SET NULL, -- Se nulo, aplica a todos os posts
    
    trigger_keyword TEXT NOT NULL, -- Ex: 'QUERO', 'LINK', 'DESCONTO'
    reply_comment_template TEXT DEFAULT 'Acabei de te enviar todos os detalhes no Direct! 🚀 Confere lá.',
    direct_message_template TEXT NOT NULL, -- Mensagem personalizada com link da oferta ou direcionamento
    forward_to_whatsapp BOOLEAN DEFAULT false,
    
    is_active BOOLEAN DEFAULT true,
    executions_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para alta performance de consultas
CREATE INDEX IF NOT EXISTS idx_xerb_ig_accounts_tenant ON public.xerb_instagram_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xerb_ig_posts_tenant_status ON public.xerb_instagram_posts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_xerb_ig_posts_scheduled ON public.xerb_instagram_posts(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_xerb_ig_rules_account ON public.xerb_instagram_rules(account_id, trigger_keyword);

-- Habilita RLS (Row Level Security)
ALTER TABLE public.xerb_instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_instagram_rules ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS baseadas no tenant do usuário autenticado
DROP POLICY IF EXISTS "Usuário gerencia conta instagram do seu tenant" ON public.xerb_instagram_accounts;
CREATE POLICY "Usuário gerencia conta instagram do seu tenant"
ON public.xerb_instagram_accounts
FOR ALL
USING (
    tenant_id IN (
        SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Usuário gerencia posts instagram do seu tenant" ON public.xerb_instagram_posts;
CREATE POLICY "Usuário gerencia posts instagram do seu tenant"
ON public.xerb_instagram_posts
FOR ALL
USING (
    tenant_id IN (
        SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Usuário gerencia regras instagram do seu tenant" ON public.xerb_instagram_rules;
CREATE POLICY "Usuário gerencia regras instagram do seu tenant"
ON public.xerb_instagram_rules
FOR ALL
USING (
    tenant_id IN (
        SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()
    )
);
