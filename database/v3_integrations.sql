-- ==============================================================================
-- ERBots - INTEGRAÇÕES EXTERNAS V3 (API Key, Webhook Outbound para CRM/GastroSys)
-- ==============================================================================
-- Idempotente e seguro: adiciona colunas de integração na tabela xerb_tenants.
-- ==============================================================================

-- 1. Colunas de Integração Externa na tabela xerb_tenants
ALTER TABLE public.xerb_tenants
    ADD COLUMN IF NOT EXISTS api_key TEXT,
    ADD COLUMN IF NOT EXISTS webhook_url TEXT,
    ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- 2. Índice único para autenticação veloz via header x-api-key nas APIs públicas
CREATE UNIQUE INDEX IF NOT EXISTS uq_xerb_tenants_api_key
    ON public.xerb_tenants (api_key)
    WHERE api_key IS NOT NULL;

-- 3. Gera automaticamente chaves de API únicas para todas as empresas existentes
UPDATE public.xerb_tenants
SET api_key = 'erb_live_' || encode(gen_random_bytes(16), 'hex')
WHERE api_key IS NULL;
