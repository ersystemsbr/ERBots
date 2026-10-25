-- =============================================================================
-- ERBots V2 - Parte 8: Expansão de Receita (Anual + Pacote Extra) e Automação
-- Idempotente: seguro para executar múltiplas vezes em produção.
-- =============================================================================

-- 1. Campos de ciclo anual, créditos avulsos e régua de retenção em xerb_tenants
ALTER TABLE public.xerb_tenants
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS pending_interval TEXT,
  ADD COLUMN IF NOT EXISTS extra_ai_credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_nudge_stage TEXT,
  ADD COLUMN IF NOT EXISTS trial_nudge_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quota_alert_period TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'xerb_tenants_billing_interval_check'
  ) THEN
    ALTER TABLE public.xerb_tenants
      ADD CONSTRAINT xerb_tenants_billing_interval_check
      CHECK (billing_interval IN ('monthly', 'yearly'));
  END IF;
END $$;

-- 2. Permite registrar pacotes avulsos ('extra_pack') em xerb_payments + garante unicidade de gateway_id
ALTER TABLE public.xerb_payments
  DROP CONSTRAINT IF EXISTS xerb_payments_plan_check;

ALTER TABLE public.xerb_payments
  ADD CONSTRAINT xerb_payments_plan_check
  CHECK (plan = ANY (ARRAY['trial'::text, 'start'::text, 'pro'::text, 'business'::text, 'custom'::text, 'extra_pack'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS uq_xerb_payments_gateway_id
  ON public.xerb_payments (gateway_id)
  WHERE gateway_id IS NOT NULL;

-- 3. Configuração de Follow-up Automático em xerb_bot_settings
ALTER TABLE public.xerb_bot_settings
  ADD COLUMN IF NOT EXISTS auto_followup_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_followup_delay_minutes INTEGER NOT NULL DEFAULT 180;

-- 4. Controle anti-duplicidade de Follow-up em xerb_leads e xerb_conversations
ALTER TABLE public.xerb_leads
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_xerb_leads_pending_followup
  ON public.xerb_leads (status, created_at)
  WHERE followup_sent_at IS NULL;

ALTER TABLE public.xerb_conversations
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

-- 5. RPCs atômicos para créditos extras de respostas IA (restritos ao service_role)
CREATE OR REPLACE FUNCTION public.xerb_add_extra_credits(p_tenant UUID, p_delta INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new INTEGER;
BEGIN
  UPDATE public.xerb_tenants
     SET extra_ai_credits = GREATEST(0, COALESCE(extra_ai_credits, 0) + COALESCE(p_delta, 0)),
         updated_at = NOW()
   WHERE id = p_tenant
   RETURNING extra_ai_credits INTO v_new;

  RETURN COALESCE(v_new, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.xerb_consume_extra_credit(p_tenant UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE public.xerb_tenants
     SET extra_ai_credits = extra_ai_credits - 1,
         updated_at = NOW()
   WHERE id = p_tenant
     AND COALESCE(extra_ai_credits, 0) > 0
   RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.xerb_add_extra_credits(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xerb_add_extra_credits(UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.xerb_consume_extra_credit(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xerb_consume_extra_credit(UUID) TO service_role;
