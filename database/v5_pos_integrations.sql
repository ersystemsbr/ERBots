-- ==============================================================================
-- ERBots SaaS - Módulo de Integrações Externas (PDV / ERP / Delivery)
-- Suporte a Saipos, GastroSys, iFood Open Delivery e Anota AI
-- ==============================================================================

-- 1. Tabela de Configurações de Integrações por Tenant
CREATE TABLE IF NOT EXISTS public.xerb_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'saipos', 'gastrosys', 'ifood', 'anota_ai'
    is_active BOOLEAN DEFAULT false,
    environment TEXT DEFAULT 'production' CHECK (environment IN ('production', 'sandbox')),
    credentials JSONB DEFAULT '{}'::jsonb, -- token, store_id, client_id, client_secret
    settings JSONB DEFAULT '{
        "auto_inject_orders": true,
        "notify_customer_whatsapp": true,
        "default_payment": "PIX",
        "sync_menu": false
    }'::jsonb,
    webhook_secret TEXT,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_tenant_provider UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_xerb_integrations_tenant ON public.xerb_integrations(tenant_id);

-- 2. Tabela de Pedidos Injetados no PDV / ERP
CREATE TABLE IF NOT EXISTS public.xerb_pos_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'saipos'
    external_order_id TEXT, -- ID do pedido no PDV (ex: retornado pela Saipos)
    display_id TEXT, -- Ex: #1042
    customer_name TEXT,
    customer_phone TEXT,
    order_type TEXT DEFAULT 'DELIVERY' CHECK (order_type IN ('DELIVERY', 'TAKEOUT', 'DINE_IN')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELED')),
    items JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC(10, 2) DEFAULT 0,
    payment_method TEXT,
    delivery_address JSONB,
    notes TEXT,
    raw_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xerb_pos_orders_tenant ON public.xerb_pos_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xerb_pos_orders_external ON public.xerb_pos_orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_xerb_pos_orders_created ON public.xerb_pos_orders(created_at DESC);
