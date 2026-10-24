-- ==============================================================================
-- ERBots - HARDENING DE SEGURANÇA (RLS)  |  Parte 1 / Fase 0
-- ==============================================================================
-- ⚠️  PRÉ-REQUISITOS (nesta ordem) ANTES de executar este script:
--   1. Deploy do código novo na Vercel (rotas autenticadas por JWT).
--   2. SUPABASE_SERVICE_ROLE_KEY configurada na Vercel + redeploy.
--      -> Confirme em /admin > aba "Sistema" > "Diagnóstico": item 1 deve estar ✅.
--      Sem a service key o app PARA de funcionar depois deste script.
--
-- O QUE FAZ:
--   * Remove TODAS as políticas abertas ao papel `anon` (qualquer pessoa com a anon key
--     conseguia ler/alterar/apagar tudo, inclusive conversas e config de sistema).
--   * Impede o cliente de INSERIR/ATUALIZAR xerb_tenants direto pelo navegador
--     (evita auto-upgrade de plano/status). Isso passa a ser feito só no servidor.
--   * Impede o cliente de escrever em xerb_instances (gerenciada só pelo servidor).
--   * Mantém acesso do DONO (auth.uid()) a: bot_settings, knowledge_base, conversations, messages.
--   * xerb_system_config e xerb_payments (escrita) ficam acessíveis só ao service_role.
--
-- É idempotente: pode ser executado mais de uma vez.
-- ==============================================================================

-- 1. Remove políticas abertas ao anon -----------------------------------------
DROP POLICY IF EXISTS "Anon read access xerb_tenants"        ON public.xerb_tenants;
DROP POLICY IF EXISTS "Anon read access xerb_instances"      ON public.xerb_instances;
DROP POLICY IF EXISTS "Anon read access xerb_bot_settings"   ON public.xerb_bot_settings;
DROP POLICY IF EXISTS "Anon read access xerb_knowledge_base" ON public.xerb_knowledge_base;
DROP POLICY IF EXISTS "Anon read access xerb_conversations"  ON public.xerb_conversations;
DROP POLICY IF EXISTS "Anon read access xerb_messages"       ON public.xerb_messages;
DROP POLICY IF EXISTS "Anon read access xerb_system_config"  ON public.xerb_system_config;

-- 2. xerb_tenants: dono só LÊ (escrita apenas via servidor) -------------------
DROP POLICY IF EXISTS "Users can update own xerb_tenant" ON public.xerb_tenants;
DROP POLICY IF EXISTS "Users can insert own xerb_tenant" ON public.xerb_tenants;
-- (a política "Users can view own xerb_tenant" permanece)

-- 3. xerb_instances: dono só LÊ ------------------------------------------------
DROP POLICY IF EXISTS "Tenant users manage xerb_instances" ON public.xerb_instances;
DROP POLICY IF EXISTS "Tenant users read xerb_instances"   ON public.xerb_instances;
CREATE POLICY "Tenant users read xerb_instances" ON public.xerb_instances
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

-- 4. Garante RLS ligado em todas as tabelas -----------------------------------
ALTER TABLE public.xerb_tenants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_instances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_bot_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xerb_system_config  ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF to_regclass('public.xerb_payments') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.xerb_payments ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- 5. Mensagens/conversas: o dono só escreve registros do PRÓPRIO tenant --------
--    (WITH CHECK explícito impede inserir linha apontando para tenant de terceiros)
DROP POLICY IF EXISTS "Tenant users manage xerb_messages" ON public.xerb_messages;
CREATE POLICY "Tenant users manage xerb_messages" ON public.xerb_messages
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users manage xerb_conversations" ON public.xerb_conversations;
CREATE POLICY "Tenant users manage xerb_conversations" ON public.xerb_conversations
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users manage xerb_knowledge_base" ON public.xerb_knowledge_base;
CREATE POLICY "Tenant users manage xerb_knowledge_base" ON public.xerb_knowledge_base
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users manage xerb_bot_settings" ON public.xerb_bot_settings;
CREATE POLICY "Tenant users manage xerb_bot_settings" ON public.xerb_bot_settings
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid()));

-- 6. Índices de performance usados pelo chat/webhook ---------------------------
CREATE INDEX IF NOT EXISTS idx_xerb_conv_tenant_last_msg
    ON public.xerb_conversations (tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_xerb_messages_conv_created
    ON public.xerb_messages (conversation_id, created_at DESC);

-- 7. VERIFICAÇÃO (rode e confira: NÃO pode haver nenhuma linha com role 'anon') --
-- SELECT tablename, policyname, roles, cmd
--   FROM pg_policies
--  WHERE schemaname = 'public' AND tablename LIKE 'xerb_%'
--  ORDER BY tablename, policyname;
