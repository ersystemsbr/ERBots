-- ==============================================================================
-- ERBots SaaS - Script de Criação do Módulo Super Admin & Pagamentos
-- ==============================================================================

-- 1. Adiciona coluna is_super_admin na tabela xerb_tenants
ALTER TABLE public.xerb_tenants 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- 2. Define os e-mails de Super Admin oficiais
UPDATE public.xerb_tenants 
SET is_super_admin = true 
WHERE email IN ('er.systems.br@gmail.com', 'seozefood@gmail.com');

-- 3. Salva a lista de e-mails de Super Admin em xerb_system_config
INSERT INTO public.xerb_system_config (key, value, description)
VALUES (
    'super_admin_emails',
    'er.systems.br@gmail.com,seozefood@gmail.com',
    'Lista de e-mails autorizados como Super Admin da plataforma ERBots'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = now();

-- 4. Criação da tabela de Pagamentos / Faturamento do SaaS (xerb_payments)
CREATE TABLE IF NOT EXISTS public.xerb_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('trial', 'start', 'pro', 'business', 'custom')),
    payment_method TEXT DEFAULT 'pix' CHECK (payment_method IN ('pix', 'credit_card', 'boleto', 'manual', 'transfer')),
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
    gateway_id TEXT, -- ID de transação (Asaas, Stripe, MercadoPago, etc.)
    paid_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Índices de busca rápida
CREATE INDEX IF NOT EXISTS idx_xerb_payments_tenant ON public.xerb_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xerb_payments_status ON public.xerb_payments(status);
CREATE INDEX IF NOT EXISTS idx_xerb_payments_paid_at ON public.xerb_payments(paid_at);

-- 6. Habilita RLS na tabela de pagamentos
ALTER TABLE public.xerb_payments ENABLE ROW LEVEL SECURITY;

-- Política de leitura: usuários podem ver apenas seus próprios pagamentos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own payments') THEN
        CREATE POLICY "Users can view own payments" 
        ON public.xerb_payments FOR SELECT 
        USING (
            tenant_id IN (SELECT id FROM public.xerb_tenants WHERE user_id = auth.uid())
        );
    END IF;
END $$;
