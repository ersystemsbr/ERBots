-- ==============================================================================
-- ERBots - INFRAESTRUTURA, MONITORAMENTO E REALTIME  |  Parte 4
-- ==============================================================================
-- Idempotente: pode ser executado mais de uma vez com segurança.
-- ==============================================================================

-- 1. Colunas de controle de desconexão e unicidade por tenant em xerb_instances
ALTER TABLE public.xerb_instances
    ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_disconnect_alert_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS intentional_logout BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_xerb_instances_tenant_id
    ON public.xerb_instances (tenant_id);

-- 2. Tabela estruturada de monitoramento de erros e eventos (xerb_system_logs)
CREATE TABLE IF NOT EXISTS public.xerb_system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    tenant_id UUID REFERENCES public.xerb_tenants(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xerb_system_logs_created
    ON public.xerb_system_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xerb_system_logs_level_created
    ON public.xerb_system_logs (level, created_at DESC);

ALTER TABLE public.xerb_system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access xerb_system_logs" ON public.xerb_system_logs;
CREATE POLICY "Service role full access xerb_system_logs" ON public.xerb_system_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Habilita Supabase Realtime nas tabelas de chat e status de instância
ALTER TABLE public.xerb_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.xerb_messages      REPLICA IDENTITY FULL;
ALTER TABLE public.xerb_instances     REPLICA IDENTITY FULL;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['xerb_conversations', 'xerb_messages', 'xerb_instances']
    LOOP
        IF NOT EXISTS (
            SELECT 1
              FROM pg_publication_tables
             WHERE pubname = 'supabase_realtime'
               AND schemaname = 'public'
               AND tablename = tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        END IF;
    END LOOP;
END $$;
