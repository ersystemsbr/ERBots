-- ==============================================================================
-- ERBots - COBRANÇA E USO  |  Parte 2
-- Executar no SQL Editor do Supabase (idempotente).
-- ==============================================================================

-- 1. Dados de cobrança no tenant -----------------------------------------------
ALTER TABLE public.xerb_tenants ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;
ALTER TABLE public.xerb_tenants ADD COLUMN IF NOT EXISTS billing_customer_id TEXT;     -- cus_xxx (Asaas)
ALTER TABLE public.xerb_tenants ADD COLUMN IF NOT EXISTS billing_subscription_id TEXT; -- sub_xxx (Asaas)
ALTER TABLE public.xerb_tenants ADD COLUMN IF NOT EXISTS billing_plan TEXT;            -- plano contratado aguardando/confirmado

-- 2. Pagamentos: idempotência por gateway_id + dados da fatura ------------------
ALTER TABLE public.xerb_payments ADD COLUMN IF NOT EXISTS invoice_url TEXT;
ALTER TABLE public.xerb_payments ADD COLUMN IF NOT EXISTS billing_type TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_xerb_payments_gateway_id
    ON public.xerb_payments (gateway_id) WHERE gateway_id IS NOT NULL;

-- 3. Eventos do gateway já processados (idempotência de webhook) ----------------
CREATE TABLE IF NOT EXISTS public.xerb_billing_events (
    id TEXT PRIMARY KEY,                -- id do evento do Asaas (evt_xxx)
    event TEXT NOT NULL,
    tenant_id UUID REFERENCES public.xerb_tenants(id) ON DELETE SET NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.xerb_billing_events ENABLE ROW LEVEL SECURITY; -- sem policies: só service_role

-- 4. Medição de uso por mês ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xerb_usage (
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    period TEXT NOT NULL,                       -- 'YYYY-MM'
    ai_replies INT NOT NULL DEFAULT 0,          -- respostas geradas pela IA
    messages_in INT NOT NULL DEFAULT 0,         -- mensagens recebidas de clientes finais
    tokens_in BIGINT NOT NULL DEFAULT 0,
    tokens_out BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (tenant_id, period)
);
ALTER TABLE public.xerb_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users read xerb_usage" ON public.xerb_usage;
CREATE POLICY "Tenant users read xerb_usage" ON public.xerb_usage
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

-- Incremento atômico (evita corrida entre mensagens simultâneas)
CREATE OR REPLACE FUNCTION public.xerb_increment_usage(
    p_tenant UUID, p_period TEXT,
    p_ai INT DEFAULT 0, p_in INT DEFAULT 0,
    p_tokens_in BIGINT DEFAULT 0, p_tokens_out BIGINT DEFAULT 0
) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    INSERT INTO public.xerb_usage (tenant_id, period, ai_replies, messages_in, tokens_in, tokens_out, updated_at)
    VALUES (p_tenant, p_period, p_ai, p_in, p_tokens_in, p_tokens_out, now())
    ON CONFLICT (tenant_id, period) DO UPDATE SET
        ai_replies  = public.xerb_usage.ai_replies  + EXCLUDED.ai_replies,
        messages_in = public.xerb_usage.messages_in + EXCLUDED.messages_in,
        tokens_in   = public.xerb_usage.tokens_in   + EXCLUDED.tokens_in,
        tokens_out  = public.xerb_usage.tokens_out  + EXCLUDED.tokens_out,
        updated_at  = now();
$$;
-- Somente o servidor (service_role) pode chamar a função
REVOKE ALL ON FUNCTION public.xerb_increment_usage(UUID, TEXT, INT, INT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xerb_increment_usage(UUID, TEXT, INT, INT, BIGINT, BIGINT) TO service_role;

-- 5. Garante que o dono lê os próprios pagamentos (já existia; recriado por segurança)
DROP POLICY IF EXISTS "Users can view own payments" ON public.xerb_payments;
CREATE POLICY "Users can view own payments" ON public.xerb_payments
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));
