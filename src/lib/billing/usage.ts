import { getServiceSupabase } from '../supabase';
import { currentUsagePeriod, getAccessState, getPlan, type AccessReason } from '../plans';
import { getPlansConfig } from './plans-config';

type Db = ReturnType<typeof getServiceSupabase>;

export interface UsageSnapshot {
  period: string;
  ai_replies: number;
  messages_in: number;
  tokens_in: number;
  tokens_out: number;
}

/** Lê o uso do mês atual. Se a tabela ainda não existir (SQL não aplicado), falha aberta (zero). */
export async function getUsage(db: Db, tenantId: string): Promise<UsageSnapshot> {
  const period = currentUsagePeriod();
  try {
    const { data, error } = await db
      .from('xerb_usage')
      .select('ai_replies, messages_in, tokens_in, tokens_out')
      .eq('tenant_id', tenantId)
      .eq('period', period)
      .maybeSingle();
    if (error || !data) return { period, ai_replies: 0, messages_in: 0, tokens_in: 0, tokens_out: 0 };
    return { period, ...data } as UsageSnapshot;
  } catch {
    return { period, ai_replies: 0, messages_in: 0, tokens_in: 0, tokens_out: 0 };
  }
}

/** Incrementa uso de forma atômica. Nunca derruba o atendimento se falhar. */
export async function recordUsage(
  db: Db,
  tenantId: string,
  delta: { aiReplies?: number; messagesIn?: number; tokensIn?: number; tokensOut?: number }
): Promise<void> {
  try {
    const { error } = await db.rpc('xerb_increment_usage', {
      p_tenant: tenantId,
      p_period: currentUsagePeriod(),
      p_ai: delta.aiReplies || 0,
      p_in: delta.messagesIn || 0,
      p_tokens_in: delta.tokensIn || 0,
      p_tokens_out: delta.tokensOut || 0,
    });
    if (error) console.warn('[Usage] Falha ao registrar uso:', error.message);
  } catch (err) {
    console.warn('[Usage] Exceção ao registrar uso:', err);
  }
}

export type GateReason = AccessReason | 'limit_reached';

export interface GateResult {
  allowed: boolean;
  reason: GateReason;
}

/**
 * Portão central de monetização: o robô só responde com IA se a assinatura/trial estiver vigente
 * e o limite mensal de respostas do plano não tiver sido atingido.
 */
export async function checkAiGate(
  db: Db,
  tenant: {
    id: string;
    plan?: string | null;
    subscription_status?: string | null;
    trial_ends_at?: string | null;
    is_super_admin?: boolean | null;
  }
): Promise<GateResult> {
  const access = getAccessState(tenant);
  if (!access.allowed) return { allowed: false, reason: access.reason };

  if (tenant.is_super_admin) return { allowed: true, reason: 'ok' };

  const plan = getPlan(tenant.plan, await getPlansConfig());
  const usage = await getUsage(db, tenant.id);
  if (usage.ai_replies >= plan.monthlyAiReplies) return { allowed: false, reason: 'limit_reached' };

  return { allowed: true, reason: 'ok' };
}
