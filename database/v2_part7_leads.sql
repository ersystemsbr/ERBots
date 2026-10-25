-- ==============================================================================
-- ERBots - PARTE 7: Captura Estruturada de Leads & Pré-Agendamentos (xerb_leads)
-- ==============================================================================
-- Idempotente. Restrito exclusivamente ao prefixo xerb_*.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.xerb_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.xerb_conversations(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    remote_jid TEXT,
    interest TEXT NOT NULL,
    preferred_slot TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'won', 'lost')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xerb_leads_tenant_created
    ON public.xerb_leads (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xerb_leads_conv_created
    ON public.xerb_leads (conversation_id, created_at DESC);

ALTER TABLE public.xerb_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access xerb_leads" ON public.xerb_leads;
CREATE POLICY "Service role full access xerb_leads" ON public.xerb_leads
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant users read xerb_leads" ON public.xerb_leads;
CREATE POLICY "Tenant users read xerb_leads" ON public.xerb_leads
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));
