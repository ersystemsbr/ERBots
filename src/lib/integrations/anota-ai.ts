import { getServiceSupabase } from '@/lib/supabase';
import { normalizeBrPhone, sendTextMessage } from '@/lib/evolution';

export interface AnotaAiCredentials {
  api_token: string;
  merchant_id: string;
  environment: 'production' | 'sandbox';
}

export interface AnotaAiSettings {
  auto_inject_orders: boolean;
  notify_customer_whatsapp: boolean;
  default_payment: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';
  sync_menu?: boolean;
}

export interface AnotaAiConfig {
  is_active: boolean;
  environment: 'production' | 'sandbox';
  credentials: AnotaAiCredentials;
  settings: AnotaAiSettings;
  webhook_secret?: string;
  last_error?: string;
}

export const DEFAULT_ANOTA_AI_CONFIG: AnotaAiConfig = {
  is_active: false,
  environment: 'production',
  credentials: {
    api_token: '',
    merchant_id: '',
    environment: 'production',
  },
  settings: {
    auto_inject_orders: true,
    notify_customer_whatsapp: true,
    default_payment: 'PIX',
    sync_menu: true,
  },
};

export function getAnotaAiBaseUrl(environment: 'production' | 'sandbox' = 'production'): string {
  return environment === 'sandbox'
    ? 'https://sandbox-api.anota.ai/v1'
    : 'https://api.anota.ai/v1';
}

/**
 * Obtém as configurações da integração Anota AI para o tenant
 */
export async function getAnotaAiIntegration(tenantId: string): Promise<AnotaAiConfig> {
  const supabase = getServiceSupabase();
  try {
    const key = `pos_integration_${tenantId}_anota_ai`;
    const { data } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      return {
        ...DEFAULT_ANOTA_AI_CONFIG,
        ...parsed,
        credentials: { ...DEFAULT_ANOTA_AI_CONFIG.credentials, ...(parsed.credentials || {}) },
        settings: { ...DEFAULT_ANOTA_AI_CONFIG.settings, ...(parsed.settings || {}) },
      };
    }
  } catch (err) {
    console.warn('[getAnotaAiIntegration] Erro ao carregar integração:', err);
  }
  return DEFAULT_ANOTA_AI_CONFIG;
}

/**
 * Salva as configurações de integração do Anota AI
 */
export async function saveAnotaAiIntegration(
  tenantId: string,
  data: Partial<AnotaAiConfig>
): Promise<boolean> {
  const supabase = getServiceSupabase();
  try {
    const current = await getAnotaAiIntegration(tenantId);
    const updated: AnotaAiConfig = {
      ...current,
      ...data,
      credentials: { ...current.credentials, ...(data.credentials || {}) },
      settings: { ...current.settings, ...(data.settings || {}) },
    };

    const key = `pos_integration_${tenantId}_anota_ai`;
    await supabase.from('xerb_system_config').upsert(
      {
        key,
        value: JSON.stringify(updated),
        description: `Configurações da integração Anota AI do tenant ${tenantId}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    return true;
  } catch (err) {
    console.error('[saveAnotaAiIntegration] Erro ao salvar:', err);
    return false;
  }
}

/**
 * Valida a conexão com a API do Anota AI
 */
export async function testAnotaAiConnection(credentials: AnotaAiCredentials): Promise<{
  success: boolean;
  message: string;
  merchantName?: string;
  raw?: any;
}> {
  const token = credentials.api_token?.trim();
  if (!token) {
    return { success: false, message: 'Token de API do Anota AI obrigatório.' };
  }

  const baseUrl = getAnotaAiBaseUrl(credentials.environment);

  try {
    const res = await fetch(`${baseUrl}/merchants/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        message: `Conexão bem sucedida com o Anota AI! Loja: ${data.name || credentials.merchant_id || 'Autenticada'}`,
        merchantName: data.name,
        raw: data,
      };
    }

    // Se o endpoint /merchants/me retornar 404, testa /menu
    const menuRes = await fetch(`${baseUrl}/menu`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (menuRes.ok) {
      return {
        success: true,
        message: 'Conexão validada com sucesso com o Cardápio do Anota AI!',
      };
    }

    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      message: errData.message || `Falha na autenticação do Anota AI (HTTP ${res.status}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao conectar com o Anota AI: ${err.message || 'Host indisponível'}`,
    };
  }
}

/**
 * Consulta o catálogo/cardápio cadastrado no Anota AI
 */
export async function fetchAnotaAiCatalog(credentials: AnotaAiCredentials): Promise<{
  success: boolean;
  categories: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      description?: string;
      price: number;
      available: boolean;
    }>;
  }>;
  totalItems: number;
  message?: string;
}> {
  const token = credentials.api_token?.trim();
  if (!token) {
    return { success: false, categories: [], totalItems: 0, message: 'Token ausente.' };
  }

  const baseUrl = getAnotaAiBaseUrl(credentials.environment);

  try {
    const res = await fetch(`${baseUrl}/menu`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return {
        success: false,
        categories: [],
        totalItems: 0,
        message: `Erro ao buscar cardápio no Anota AI (HTTP ${res.status})`,
      };
    }

    const data = await res.json();
    const rawCategories = data.categories || data.data || (Array.isArray(data) ? data : []);
    const categories: any[] = [];
    let totalItems = 0;

    for (const cat of rawCategories) {
      const items = (cat.items || cat.products || []).map((it: any) => ({
        id: String(it.id || it._id || ''),
        name: it.name || it.title || 'Item',
        description: it.description || '',
        price: Number(it.price || it.unit_price || 0),
        available: it.available !== false && it.paused !== true,
      }));

      totalItems += items.length;
      categories.push({
        id: String(cat.id || cat._id || cat.name),
        name: cat.name || 'Geral',
        items,
      });
    }

    return {
      success: true,
      categories,
      totalItems,
    };
  } catch (err: any) {
    return {
      success: false,
      categories: [],
      totalItems: 0,
      message: `Erro de rede ao buscar cardápio: ${err.message}`,
    };
  }
}

/**
 * Sincroniza o cardápio do Anota AI direto na base de conhecimento da IA do ERBots
 */
export async function syncAnotaAiCatalogToKnowledgeBase(tenantId: string): Promise<{
  success: boolean;
  totalSynced: number;
  message: string;
}> {
  const config = await getAnotaAiIntegration(tenantId);
  if (!config.credentials.api_token) {
    return { success: false, totalSynced: 0, message: 'Integração Anota AI não configurada com Token.' };
  }

  const catalog = await fetchAnotaAiCatalog(config.credentials);
  if (!catalog.success || catalog.totalItems === 0) {
    return {
      success: false,
      totalSynced: 0,
      message: catalog.message || 'Nenhum item encontrado no cardápio do Anota AI.',
    };
  }

  const lines: string[] = [
    '# CARDÁPIO OFICIAL ANOTA AI (SINCRONIZADO AUTOMATICAMENTE)',
    `Atualizado em: ${new Date().toLocaleString('pt-BR')}`,
    'Use sempre estes nomes exatos, códigos e valores oficiais para os pedidos:',
    '',
  ];

  for (const cat of catalog.categories) {
    lines.push(`## Categoria: ${cat.name}`);
    for (const item of cat.items) {
      if (!item.available) continue;
      lines.push(
        `- [Cód: ${item.id}] ${item.name} - R$ ${item.price.toFixed(2)}${
          item.description ? ` (${item.description})` : ''
        }`
      );
    }
    lines.push('');
  }

  const content = lines.join('\n');
  const supabase = getServiceSupabase();

  try {
    const { data: existing } = await supabase
      .from('xerb_knowledge_sources')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('title', 'Cardápio Oficial Anota AI')
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('xerb_knowledge_sources')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('xerb_knowledge_sources').insert({
        tenant_id: tenantId,
        title: 'Cardápio Oficial Anota AI',
        content,
        source_type: 'menu',
        is_active: true,
      });
    }

    return {
      success: true,
      totalSynced: catalog.totalItems,
      message: `Cardápio do Anota AI sincronizado com sucesso! ${catalog.totalItems} produtos carregados para a IA.`,
    };
  } catch (err: any) {
    return {
      success: false,
      totalSynced: 0,
      message: `Erro ao salvar cardápio na base de conhecimento: ${err.message}`,
    };
  }
}

/**
 * Cria e injeta um novo pedido no Anota AI
 */
export async function createAnotaAiOrder(
  credentials: AnotaAiCredentials,
  payload: {
    order_type?: 'DELIVERY' | 'TAKEOUT';
    customer: {
      name: string;
      phone: string;
    };
    delivery_address?: {
      street: string;
      number: string;
      neighborhood: string;
      city?: string;
      state?: string;
      complement?: string;
      reference?: string;
    };
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      observations?: string;
    }>;
    payments?: Array<{
      type: string;
      amount: number;
    }>;
    notes?: string;
  }
): Promise<{
  success: boolean;
  external_order_id?: string;
  display_id?: string;
  message: string;
  rawResponse?: any;
}> {
  const token = credentials.api_token?.trim();
  if (!token) {
    return { success: false, message: 'Token de API do Anota AI ausente.' };
  }

  const baseUrl = getAnotaAiBaseUrl(credentials.environment);
  const cleanPhone = normalizeBrPhone(payload.customer.phone) || payload.customer.phone;

  const total = payload.items.reduce((acc, it) => acc + (it.total_price || it.unit_price * it.quantity), 0);

  const anotaPayload = {
    type: payload.order_type || 'DELIVERY',
    customer: {
      name: payload.customer.name,
      phone: cleanPhone,
    },
    delivery: payload.delivery_address
      ? {
          street: payload.delivery_address.street,
          number: payload.delivery_address.number,
          neighborhood: payload.delivery_address.neighborhood,
          city: payload.delivery_address.city || '',
          complement: payload.delivery_address.complement || '',
          reference: payload.delivery_address.reference || '',
        }
      : undefined,
    items: payload.items.map((it) => ({
      id: it.id,
      name: it.name,
      quantity: it.quantity,
      price: it.unit_price,
      total: it.total_price || it.unit_price * it.quantity,
      observations: it.observations || '',
    })),
    payment: {
      method: payload.payments?.[0]?.type || 'PIX',
      total,
    },
    observations: payload.notes || 'Pedido realizado via ERBots WhatsApp',
  };

  try {
    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(anotaPayload),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      const externalId = String(data.id || data.order_id || data._id || `anota_${Date.now()}`);
      const displayId = String(data.display_id || data.short_id || externalId.slice(-4));
      return {
        success: true,
        external_order_id: externalId,
        display_id: displayId,
        message: `Pedido #${displayId} injetado com sucesso no Anota AI!`,
        rawResponse: data,
      };
    }

    return {
      success: false,
      message: data.message || `Erro do Anota AI (HTTP ${res.status})`,
      rawResponse: data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Falha de conexão com a API do Anota AI: ${err.message}`,
    };
  }
}

/**
 * Mapeia status do Anota AI para o formato padrão do ERBots
 */
export function mapAnotaAiStatus(rawStatus: string): {
  status: 'PENDING' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  label: string;
  emoji: string;
} {
  const norm = String(rawStatus || '').toUpperCase().trim();
  switch (norm) {
    case 'PENDING':
    case 'NEW':
    case 'NOVO':
      return { status: 'PENDING', label: 'Recebido pelo Anota AI', emoji: '📥' };
    case 'CONFIRMED':
    case 'IN_PREPARATION':
    case 'PREPARING':
    case 'PRODUCAO':
      return { status: 'CONFIRMED', label: 'Em Preparação na Cozinha', emoji: '🍳' };
    case 'DISPATCHED':
    case 'OUT_FOR_DELIVERY':
    case 'ROTA':
      return { status: 'DISPATCHED', label: 'Saiu para Entrega', emoji: '🛵' };
    case 'DELIVERED':
    case 'CONCLUDED':
    case 'ENTREGUE':
      return { status: 'DELIVERED', label: 'Pedido Entregue', emoji: '🎉' };
    case 'CANCELLED':
    case 'CANCELED':
    case 'CANCELADO':
      return { status: 'CANCELLED', label: 'Pedido Cancelado', emoji: '❌' };
    default:
      return { status: 'PENDING', label: 'Atualizado', emoji: '🔔' };
  }
}

/**
 * Gera mensagem de status humanizada para o WhatsApp
 */
export function generateAnotaAiWhatsAppMessage(
  status: 'PENDING' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED',
  customerName: string,
  displayId: string
): string {
  const name = customerName?.trim() || 'Cliente';
  const orderRef = displayId ? ` *#${displayId}*` : '';

  switch (status) {
    case 'CONFIRMED':
      return `Olá, *${name}*! 🍳 Seu pedido${orderRef} foi aceito e já está sendo preparado com muito carinho pela nossa cozinha!`;
    case 'DISPATCHED':
      return `Oba, *${name}*! 🛵 Seu pedido${orderRef} acabou de sair com o nosso entregador e está a caminho do seu endereço!`;
    case 'DELIVERED':
      return `🎉 *${name}*, seu pedido${orderRef} foi entregue! Bom apetite e muito obrigado pela preferência!`;
    case 'CANCELLED':
      return `Olá, *${name}*. Informamos que seu pedido${orderRef} precisou ser cancelado. Se tiver qualquer dúvida, estamos à disposição aqui!`;
    default:
      return `Olá, *${name}*! O status do seu pedido${orderRef} foi atualizado.`;
  }
}
