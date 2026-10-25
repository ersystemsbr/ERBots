/**
 * FONTE ÚNICA DE VERDADE de planos, preços, limites e regras de acesso do ERBots.
 * Usada por: landing, tela de planos, checkout, admin (MRR) e webhook (bloqueio/limites).
 * Para mudar preço ou limite, altere SOMENTE aqui.
 *
 * Este arquivo é puro (sem imports de servidor) para poder ser usado no navegador.
 */

export type PlanId = 'trial' | 'start' | 'pro' | 'business';
export type PaidPlanId = Exclude<PlanId, 'trial'>;

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Preço mensal em reais (0 para trial) */
  price: number;
  /** Respostas de IA por mês (cada resposta gerada pelo Gemini conta 1) */
  monthlyAiReplies: number;
  /** Conexões de WhatsApp permitidas */
  maxInstances: number;
  description: string;
  features: string[];
  popular?: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  trial: {
    id: 'trial',
    name: 'Teste Grátis',
    price: 0,
    monthlyAiReplies: 150,
    maxInstances: 1,
    description: '7 dias para testar com seus clientes reais.',
    features: [],
  },
  start: {
    id: 'start',
    name: 'Start',
    price: 149,
    monthlyAiReplies: 1000,
    maxInstances: 1,
    description: 'Ideal para autônomos, consultórios e pequenos negócios.',
    features: [
      'Atendente IA Gemini 24/7',
      'Base de conhecimento (FAQ e serviços)',
      'Personalização de tom de voz',
      'Horário de atendimento',
      'Suporte via WhatsApp',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 249,
    monthlyAiReplies: 3000,
    maxInstances: 1,
    description: 'O mais escolhido por empresas que buscam automação e controle.',
    features: [
      'Base de conhecimento ilimitada',
      'Transbordo humano inteligente',
      'Live Chat / CRM em tempo real',
      'Histórico completo de mensagens',
      'Suporte prioritário',
    ],
    popular: true,
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 449,
    monthlyAiReplies: 10000,
    maxInstances: 1,
    description: 'Para empresas maiores, clínicas de alto fluxo e operações intensas.',
    features: [
      'IA com ajuste fino de prompts complexos',
      'Transbordo com roteamento de equipe',
      'Treinamento e setup assistido',
      'Gerente de contas dedicado',
    ],
  },
};

export const PAID_PLAN_IDS: PaidPlanId[] = ['start', 'pro', 'business'];

export function getPlan(id?: string | null, plans: Record<PlanId, PlanDefinition> = PLANS): PlanDefinition {
  return plans[(id as PlanId) in plans ? (id as PlanId) : 'trial'];
}

export function isPaidPlan(id?: string | null): id is PaidPlanId {
  return PAID_PLAN_IDS.includes(id as PaidPlanId);
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// PERSONALIZAÇÃO PELO PAINEL ADMIN (preços, limites e textos variáveis)
// Os valores acima são o PADRÃO; o admin sobrescreve em xerb_system_config (chave plans_config).
// ---------------------------------------------------------------------------

export interface PlanOverride {
  name?: string;
  price?: number;
  monthlyAiReplies?: number;
  maxInstances?: number;
  description?: string;
  /** Benefícios adicionais (um por item). Os limites de conexões/respostas são gerados automaticamente. */
  features?: string[];
}

export type PlanOverrides = Partial<Record<PlanId, PlanOverride>>;

/** Valida/normaliza dados vindos do admin ou do banco. Ignora campos inválidos. */
export function sanitizePlanOverrides(input: any): PlanOverrides {
  const out: PlanOverrides = {};
  if (!input || typeof input !== 'object') return out;
  for (const id of Object.keys(PLANS) as PlanId[]) {
    const raw = input[id];
    if (!raw || typeof raw !== 'object') continue;
    const o: PlanOverride = {};
    if (typeof raw.name === 'string' && raw.name.trim()) o.name = raw.name.trim().slice(0, 40);
    if (typeof raw.description === 'string') o.description = raw.description.trim().slice(0, 200);
    const price = Number(raw.price);
    // Trial é sempre gratuito
    if (id !== 'trial' && Number.isFinite(price) && price >= 5 && price <= 100000) o.price = Math.round(price * 100) / 100;
    const replies = Number(raw.monthlyAiReplies);
    if (Number.isFinite(replies) && replies >= 1 && replies <= 10000000) o.monthlyAiReplies = Math.floor(replies);
    const inst = Number(raw.maxInstances);
    if (Number.isFinite(inst) && inst >= 1 && inst <= 100) o.maxInstances = Math.floor(inst);
    if (Array.isArray(raw.features)) {
      o.features = raw.features
        .filter((f: any) => typeof f === 'string' && f.trim())
        .map((f: string) => f.trim().slice(0, 120))
        .slice(0, 20);
    }
    if (Object.keys(o).length) out[id] = o;
  }
  return out;
}

/** Aplica os overrides sobre o padrão e devolve a tabela de planos efetiva. */
export function applyPlanOverrides(overrides: PlanOverrides = {}): Record<PlanId, PlanDefinition> {
  const result = {} as Record<PlanId, PlanDefinition>;
  for (const id of Object.keys(PLANS) as PlanId[]) {
    result[id] = { ...PLANS[id], ...(overrides[id] || {}), id };
  }
  return result;
}

/** Lista de benefícios exibida ao cliente (limites sempre refletem os números atuais). */
export function planFeatureList(plan: PlanDefinition): string[] {
  const conexoes = plan.maxInstances === 1 ? '1 conexão de WhatsApp' : `Até ${plan.maxInstances} conexões de WhatsApp`;
  const respostas = `Até ${plan.monthlyAiReplies.toLocaleString('pt-BR')} respostas de IA por mês`;
  return [conexoes, respostas, ...plan.features];
}

// ---------------------------------------------------------------------------
// REGRAS DE ACESSO
// ---------------------------------------------------------------------------

/** Dias de tolerância após vencer uma mensalidade (status past_due) antes de pausar o robô */
export const PAST_DUE_GRACE_DAYS = 3;
/** Folga (em horas) após o fim do período pago para absorver atraso de webhook/compensação */
export const ACTIVE_BUFFER_HOURS = 36;
/** Dias de vigência de cada mensalidade confirmada */
export const BILLING_PERIOD_DAYS = 31;

export type AccessReason =
  | 'ok'
  | 'trial_expired'
  | 'subscription_expired'
  | 'past_due_blocked'
  | 'canceled';

export interface AccessState {
  allowed: boolean;
  reason: AccessReason;
  /** Dias restantes até o fim do período atual (pode ser negativo) */
  daysLeft: number;
  /** Mensagem pronta para exibir ao dono da empresa */
  message: string;
}

interface TenantBillingFields {
  plan?: string | null;
  subscription_status?: string | null;
  /** Para trial = fim do teste; para planos pagos = fim do período pago */
  trial_ends_at?: string | null;
  is_super_admin?: boolean | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Decide se o robô do tenant pode atender agora.
 * `trial_ends_at` funciona como "acesso até" (fim do trial ou do período pago).
 */
export function getAccessState(tenant: TenantBillingFields, now: Date = new Date()): AccessState {
  if (tenant.is_super_admin) {
    return { allowed: true, reason: 'ok', daysLeft: 9999, message: 'Conta administrativa.' };
  }

  const status = tenant.subscription_status || 'trialing';
  const until = tenant.trial_ends_at ? new Date(tenant.trial_ends_at).getTime() : 0;
  const daysLeft = Math.ceil((until - now.getTime()) / DAY_MS);

  if (status === 'trialing') {
    if (until && now.getTime() <= until) {
      return { allowed: true, reason: 'ok', daysLeft, message: `Teste grátis: ${Math.max(daysLeft, 0)} dia(s) restante(s).` };
    }
    return {
      allowed: false,
      reason: 'trial_expired',
      daysLeft,
      message: 'Seu teste grátis terminou. Assine um plano para reativar o atendente virtual.',
    };
  }

  if (status === 'active') {
    const limit = until + ACTIVE_BUFFER_HOURS * 60 * 60 * 1000;
    if (until && now.getTime() <= limit) {
      return { allowed: true, reason: 'ok', daysLeft, message: 'Assinatura ativa.' };
    }
    return {
      allowed: false,
      reason: 'subscription_expired',
      daysLeft,
      message: 'O período da sua assinatura terminou. Renove para reativar o atendente virtual.',
    };
  }

  if (status === 'past_due') {
    const limit = until + PAST_DUE_GRACE_DAYS * DAY_MS;
    if (until && now.getTime() <= limit) {
      return {
        allowed: true,
        reason: 'ok',
        daysLeft,
        message: 'Pagamento em atraso. Regularize para evitar a pausa do atendente virtual.',
      };
    }
    return {
      allowed: false,
      reason: 'past_due_blocked',
      daysLeft,
      message: 'Pagamento em atraso: o atendente virtual foi pausado. Regularize para reativar.',
    };
  }

  // canceled: mantém acesso até o fim do período já pago
  if (until && now.getTime() <= until) {
    return { allowed: true, reason: 'ok', daysLeft, message: 'Assinatura cancelada (ativa até o fim do período pago).' };
  }
  return {
    allowed: false,
    reason: 'canceled',
    daysLeft,
    message: 'Assinatura cancelada. Assine novamente para reativar o atendente virtual.',
  };
}

/** Período de uso no formato YYYY-MM (fuso de Brasília). */
export function currentUsagePeriod(now: Date = new Date()): string {
  const br = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// CPF / CNPJ
// ---------------------------------------------------------------------------

export function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '');
}

function validCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (const t of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(cpf[i]) * (t + 1 - i);
    const dv = ((sum * 10) % 11) % 10;
    if (dv !== Number(cpf[t])) return false;
  }
  return true;
}

function validCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cnpj[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export function isValidCpfCnpj(value: string): boolean {
  const d = onlyDigits(value);
  return d.length === 11 ? validCpf(d) : d.length === 14 ? validCnpj(d) : false;
}
