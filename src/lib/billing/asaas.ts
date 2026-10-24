/**
 * Cliente mínimo da API v3 do Asaas (https://docs.asaas.com).
 * Variáveis de ambiente:
 *   ASAAS_API_KEY        chave de API (produção ou sandbox)
 *   ASAAS_ENV            'sandbox' para usar o ambiente de testes (padrão: produção)
 *   ASAAS_WEBHOOK_TOKEN  token que o Asaas envia no header `asaas-access-token`
 */

export function isAsaasConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}

function baseUrl(): string {
  return process.env.ASAAS_ENV === 'sandbox'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3';
}

export class AsaasError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function asaasFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new AsaasError('Gateway de pagamento não configurado.', 503);

  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'User-Agent': 'ERBots/1.0',
      access_token: apiKey,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.description || `Erro do gateway de pagamento (${res.status}).`;
    throw new AsaasError(msg, res.status);
  }
  return json as T;
}

export interface AsaasCustomerInput {
  name: string;
  email?: string | null;
  cpfCnpj: string;
  mobilePhone?: string | null;
  externalReference: string;
}

/** Cria o cliente no Asaas (ou atualiza o CPF/CNPJ/dados se já existir). */
export async function upsertCustomer(existingId: string | null | undefined, input: AsaasCustomerInput): Promise<string> {
  const body = {
    name: input.name,
    email: input.email || undefined,
    cpfCnpj: input.cpfCnpj,
    mobilePhone: input.mobilePhone || undefined,
    externalReference: input.externalReference,
    notificationDisabled: false,
  };

  if (existingId) {
    const updated = await asaasFetch<{ id: string }>(`/customers/${existingId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return updated.id;
  }

  const created = await asaasFetch<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return created.id;
}

export interface CreateSubscriptionInput {
  customerId: string;
  value: number;
  description: string;
  externalReference: string;
}

/**
 * Cria assinatura mensal. billingType UNDEFINED = o cliente escolhe Pix, boleto ou cartão na fatura.
 * O primeiro vencimento é hoje (cobrança imediata).
 */
export async function createSubscription(input: CreateSubscriptionInput): Promise<{ id: string }> {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const nextDueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;

  return asaasFetch<{ id: string }>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: 'UNDEFINED',
      value: input.value,
      nextDueDate,
      cycle: 'MONTHLY',
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  try {
    await asaasFetch(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  } catch (err) {
    // Já removida no gateway: tratamos como sucesso
    if (err instanceof AsaasError && err.status === 404) return;
    throw err;
  }
}

/** Retorna a fatura (link de pagamento) mais recente em aberto da assinatura. */
export async function getLatestInvoiceUrl(subscriptionId: string): Promise<string | null> {
  const res = await asaasFetch<{ data: Array<{ invoiceUrl?: string; status?: string }> }>(
    `/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=5`
  );
  const list = res?.data || [];
  const pending = list.find((p) => p.status === 'PENDING' || p.status === 'OVERDUE') || list[0];
  return pending?.invoiceUrl || null;
}
