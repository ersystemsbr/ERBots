-- ==============================================================================
-- ERBots - HARDENING V2 (Colunas de Alerta/Billing, Índices Únicos e RLS Estrito)
-- ==============================================================================
-- Idempotente: pode ser executado mais de uma vez sem efeitos colaterais.
-- NÃO toca em nenhuma tabela fora do prefixo xerb_*.
-- ==============================================================================

-- PARTE A: Evolução aditiva de colunas e índices (segura antes do deploy) ------

ALTER TABLE public.xerb_tenants
    ADD COLUMN IF NOT EXISTS alert_phone TEXT,
    ADD COLUMN IF NOT EXISTS pending_invoice_url TEXT,
    ADD COLUMN IF NOT EXISTS pending_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS pending_plan TEXT;

-- Impede criação duplicada de tenant por clique duplo simultâneo no bootstrap
CREATE UNIQUE INDEX IF NOT EXISTS uq_xerb_tenants_user_id
    ON public.xerb_tenants (user_id)
    WHERE user_id IS NOT NULL;

-- Garante índice composto por tenant + data para painéis analíticos e histórico
CREATE INDEX IF NOT EXISTS idx_xerb_messages_tenant_created
    ON public.xerb_messages (tenant_id, created_at DESC);

-- Ajusta default legado de modelo Gemini para novos registros diretos no banco
ALTER TABLE public.xerb_bot_settings
    ALTER COLUMN gemini_model SET DEFAULT 'gemini-3.6-flash';

-- PARTE B: Blindagem fina de RLS (aplicar APÓS deploy das rotas /api/tenant/*) -
--   * xerb_bot_settings e xerb_knowledge_base passam a ser SOMENTE LEITURA pelo
--     navegador (toda gravação passa pelo servidor com validação de limites/plano,
--     impedindo escalonamento manual de gemini_model ou abuso de armazenamento).
--   * xerb_messages passa a ser SOMENTE LEITURA pelo navegador (Realtime continua
--     funcionando normalmente; ninguém apaga ou falsifica histórico pelo console).
--   * xerb_conversations permite apenas SELECT e UPDATE do próprio tenant (sem
--     INSERT ou DELETE direto pelo navegador).

DROP POLICY IF EXISTS "Tenant users manage xerb_bot_settings" ON public.xerb_bot_settings;
DROP POLICY IF EXISTS "Tenant users read xerb_bot_settings"   ON public.xerb_bot_settings;
CREATE POLICY "Tenant users read xerb_bot_settings" ON public.xerb_bot_settings
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users manage xerb_knowledge_base" ON public.xerb_knowledge_base;
DROP POLICY IF EXISTS "Tenant users read xerb_knowledge_base"   ON public.xerb_knowledge_base;
CREATE POLICY "Tenant users read xerb_knowledge_base" ON public.xerb_knowledge_base
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users manage xerb_messages" ON public.xerb_messages;
DROP POLICY IF EXISTS "Tenant users read xerb_messages"   ON public.xerb_messages;
CREATE POLICY "Tenant users read xerb_messages" ON public.xerb_messages
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users manage xerb_conversations" ON public.xerb_conversations;
DROP POLICY IF EXISTS "Tenant users read xerb_conversations"   ON public.xerb_conversations;
DROP POLICY IF EXISTS "Tenant users update xerb_conversations" ON public.xerb_conversations;

CREATE POLICY "Tenant users read xerb_conversations" ON public.xerb_conversations
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users update xerb_conversations" ON public.xerb_conversations
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));
