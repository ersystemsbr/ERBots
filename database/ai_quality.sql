-- ============================================================================
-- ERBots — Qualidade da IA (Parte 3)  |  OPCIONAL, idempotente
-- Habilita a deduplicação de mensagens por ID do WhatsApp (evita resposta dupla
-- quando a Evolution reenvia um webhook). O app funciona sem este SQL (sem dedupe).
-- ============================================================================

ALTER TABLE public.xerb_messages
  ADD COLUMN IF NOT EXISTS wa_message_id TEXT;

-- Um mesmo ID do WhatsApp só pode existir uma vez por empresa
CREATE UNIQUE INDEX IF NOT EXISTS ux_xerb_messages_tenant_wa_id
  ON public.xerb_messages (tenant_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- Acelera a busca do histórico recente por conversa
CREATE INDEX IF NOT EXISTS idx_xerb_messages_conv_created
  ON public.xerb_messages (conversation_id, created_at DESC);
