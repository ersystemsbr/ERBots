import { getServiceSupabase } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/evolution';

export interface SaiposCredentials {
  id_partner: string;
  cod_store?: string;
  token?: string; // Compatibilidade com formulários legados
  store_id?: string;
  client_id?: string;
  environment?: 'production' | 'sandbox' | 'homolog';
}

export interface SaiposSettings {
  auto_inject_orders?: boolean;
  notify_customer_whatsapp?: boolean;
  default_payment?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';
  sync_menu?: boolean;
  table_service_enabled?: boolean;
}

export interface SaiposOrderItem {
  id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  subitems?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
}

export interface SaiposOrderPayload {
  external_id?: string;
  display_id?: string;
  order_type?: 'DELIVERY' | 'TAKEOUT' | 'DINE_IN';
  customer: {
    name: string;
    phone: string;
    document?: string;
  };
  delivery_address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state?: string;
    postal_code?: string;
    reference?: string;
  };
  items: SaiposOrderItem[];
  payments: Array<{
    type: string;
    value: number;
    change_for?: number;
    prepaid?: boolean;
  }>;
  totals: {
    items_price: number;
    delivery_fee?: number;
    discount?: number;
    total: number;
  };
  notes?: string;
}

let cachedPartnerSecret: string | null = null;
const tokenCacheMap = new Map<string, { token: string; expiresAt: number }>();

/**
 * Obtém o Secret mestre de parceiro do provedor ERBots
 * (Primeiro checa variável de ambiente, depois busca no banco xerb_system_config)
 */
export async function getSaiposPartnerSecret(): Promise<string> {
  if (process.env.SAIPOS_PARTNER_SECRET && process.env.SAIPOS_PARTNER_SECRET.trim()) {
    return process.env.SAIPOS_PARTNER_SECRET.trim();
  }

  if (cachedPartnerSecret) return cachedPartnerSecret;

  try {
    const supabase = getServiceSupabase();
    const { data } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', 'saipos_partner_secret')
      .maybeSingle();

    if (data?.value && data.value.trim()) {
      const trimmed = data.value.trim();
      cachedPartnerSecret = trimmed;
      return trimmed;
    }
  } catch (err) {
    console.warn('[Saipos getSaiposPartnerSecret] Erro ao buscar secret no banco:', err);
  }

  return '633a9fe93b871eb424ed713264f5f514';
}

/**
 * Autentica com a API da Saipos para uma loja específica gerando o Token JWT
 * Rota oficial Saipos v2.5: POST https://order-api.saipos.com/auth
 */
export async function getSaiposAuthToken(
  idPartner: string
): Promise<{ success: boolean; token?: string; message?: string }> {
  const cleanId = (idPartner || '').trim();
  if (!cleanId) {
    return { success: false, message: 'O IdPartner da loja na Saipos não foi informado.' };
  }

  const cached = tokenCacheMap.get(cleanId);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60000) {
    return { success: true, token: cached.token };
  }

  const secret = await getSaiposPartnerSecret();
  if (!secret) {
    return {
      success: false,
      message: 'Secret de parceiro Saipos não configurado na plataforma.',
    };
  }

  try {
    const res = await fetch('https://order-api.saipos.com/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        idPartner: cleanId,
        secret,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      tokenCacheMap.set(cleanId, {
        token: data.token,
        expiresAt: now + 36 * 3600 * 1000,
      });
      return { success: true, token: data.token };
    }

    return {
      success: false,
      message:
        data.errorMessage ||
        data.message ||
        `Erro ao autenticar com a Saipos (${res.status}). Verifique o IdPartner da loja.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Falha de conexão com a API da Saipos: ${err?.message || 'tempo limite esgotado'}.`,
    };
  }
}

/**
 * Testa a conexão com a API da Saipos validando o IdPartner e o Secret
 */
export async function testSaiposConnection(credentials: SaiposCredentials): Promise<{
  success: boolean;
  message: string;
  token?: string;
  storeInfo?: any;
}> {
  const idPartner = (credentials.id_partner || credentials.token || '').trim();
  if (!idPartner) {
    return {
      success: false,
      message: 'O IdPartner da loja na Saipos é obrigatório para testar a conexão.',
    };
  }

  const authResult = await getSaiposAuthToken(idPartner);
  if (!authResult.success || !authResult.token) {
    return {
      success: false,
      message: authResult.message || 'Não foi possível validar o IdPartner junto à Saipos.',
    };
  }

  return {
    success: true,
    message: 'Conexão com a Saipos autenticada com sucesso! Token gerado e canal ativo. 🚀',
    token: authResult.token,
  };
}

/**
 * Injeta um pedido na Saipos via API v2.5 oficial
 * Rota: POST https://order-api.saipos.com/order
 */
export async function createSaiposOrder(
  credentials: SaiposCredentials,
  order: SaiposOrderPayload
): Promise<{
  success: boolean;
  external_order_id?: string;
  display_id?: string;
  message: string;
  rawResponse?: any;
}> {
  const idPartner = (credentials.id_partner || credentials.token || '').trim();
  const codStore = (credentials.cod_store || credentials.store_id || '99018').trim();

  if (!idPartner) {
    return { success: false, message: 'IdPartner da Saipos não configurado.' };
  }

  const auth = await getSaiposAuthToken(idPartner);
  if (!auth.success || !auth.token) {
    return {
      success: false,
      message: auth.message || 'Falha ao obter token de autorização na Saipos.',
    };
  }

  const displayId = String(order.display_id || Math.floor(1000 + Math.random() * 9000));
  const externalId = order.external_id || `ERB-${Date.now()}-${displayId}`;

  const payload = {
    order_id: externalId,
    display_id: displayId,
    cod_store: codStore,
    created_at: new Date().toISOString(),
    notes: order.notes || 'Pedido realizado via ERBots WhatsApp',
    total_increase: 0,
    total_discount: Number(order.totals?.discount) || 0,
    total_amount: Number(order.totals?.total) || Number(order.totals?.items_price) || 0,
    customer: {
      id: '-1',
      name: order.customer.name || 'Cliente WhatsApp',
      phone: (order.customer.phone || '').replace(/\D/g, '') || '5511999999999',
      document_number: order.customer.document || undefined,
    },
    order_method: {
      mode:
        order.order_type === 'TAKEOUT'
          ? 'TAKEOUT'
          : order.order_type === 'DINE_IN'
          ? 'TABLE'
          : 'DELIVERY',
      delivery_by: 'RESTAURANT',
      delivery_fee: Number(order.totals?.delivery_fee) || 0,
      scheduled: false,
    },
    delivery_address: order.delivery_address
      ? {
          country: 'BR',
          state: order.delivery_address.state || 'SP',
          city: order.delivery_address.city || 'São Paulo',
          district: order.delivery_address.neighborhood || 'Centro',
          street_name: order.delivery_address.street || 'Rua Principal',
          street_number: order.delivery_address.number || 'S/N',
          postal_code: (order.delivery_address.postal_code || '').replace(/\D/g, '') || '01001000',
          reference: order.delivery_address.reference || order.delivery_address.complement || '',
          complement: order.delivery_address.complement || '',
        }
      : undefined,
    items: order.items.map((item, idx) => ({
      integration_code: item.id || String(idx + 1),
      desc_item: item.name,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unit_price) || 0,
      notes: item.notes || '',
      choice_items: (item.subitems || []).map((sub, sIdx) => ({
        integration_code: String(sIdx + 1),
        desc_item_choice: sub.name,
        aditional_price: Number(sub.price) || 0,
        quantity: Number(sub.quantity) || 1,
        notes: '',
      })),
    })),
    payment_types:
      order.payments && order.payments.length > 0
        ? order.payments.map((p) => {
            const typeUpper = String(p.type || '').toUpperCase();
            if (typeUpper === 'PIX') {
              return {
                code: 'PARTNER_PAYMENT',
                complement: 'pix',
                type: 'ONLINE',
                amount: Number(p.value) || Number(order.totals?.total) || 0,
                change_for: 0,
              };
            }
            if (typeUpper === 'DEBIT_CARD' || typeUpper === 'DEB') {
              return {
                code: 'DEB',
                amount: Number(p.value) || Number(order.totals?.total) || 0,
                change_for: 0,
              };
            }
            if (typeUpper === 'CREDIT_CARD' || typeUpper === 'CRE') {
              return {
                code: 'CRE',
                amount: Number(p.value) || Number(order.totals?.total) || 0,
                change_for: 0,
              };
            }
            return {
              code: 'DIN',
              amount: Number(p.value) || Number(order.totals?.total) || 0,
              change_for: Number(p.change_for) || 0,
            };
          })
        : [
            {
              code: 'DIN',
              amount: Number(order.totals?.total || order.totals?.items_price || 0),
              change_for: 0,
            },
          ],
  };

  try {
    const res = await fetch('https://order-api.saipos.com/order', {
      method: 'POST',
      headers: {
        Authorization: auth.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok || res.status === 200 || res.status === 201) {
      const data = await res.json().catch(() => ({}));
      const saleNumber = data.sale_number ? String(data.sale_number) : null;
      return {
        success: true,
        external_order_id: data.order_id || externalId,
        display_id: saleNumber ? `#${saleNumber}` : (data.display_id || displayId),
        message: `Pedido ${saleNumber ? `(Venda #${saleNumber})` : ''} injetado com sucesso no PDV da Saipos! 👨‍🍳🛵`,
        rawResponse: data,
      };
    }

    const errData = await res.json().catch(() => ({}));
    console.warn('[Saipos createSaiposOrder] Resposta da API:', res.status, errData);

    let errorMessage =
      errData.errorMessage ||
      errData.message ||
      `Erro ao injetar pedido na Saipos (Código ${errData.errorCode || res.status}).`;

    if (errData.errorCode === 906) {
      errorMessage = `Saipos retornou Erro 906: "${errData.errorMessage || 'Integração indisponível ou vínculo inválido.'}". Para corrigir: acesse o painel da loja na Saipos (conta.saipos.com > Menu > Canais de Vendas e Integrações > clique na sua integração e marque "Habilitar Integração" e salve).`;
    }

    return {
      success: false,
      message: errorMessage,
      rawResponse: errData,
    };
  } catch (err: any) {
    console.error('[Saipos createSaiposOrder] Erro de conexão:', err);
    return {
      success: false,
      message: `Falha de conexão com a Saipos: ${err?.message || 'tempo de resposta esgotado'}.`,
    };
  }
}

/**
 * Traduz o status da Saipos para rótulo legível em português
 */
export function mapSaiposStatus(rawStatus: string): {
  status: 'PENDING' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELED';
  label: string;
  emoji: string;
} {
  const norm = String(rawStatus || '').toUpperCase().trim();

  if (norm.includes('CONFIRM') || norm.includes('ACCEPTED') || norm.includes('PREPAR') || norm.includes('KITCHEN')) {
    return { status: 'CONFIRMED', label: 'Em Preparo / Confirmado', emoji: '👨‍🍳' };
  }
  if (norm.includes('DISPATCH') || norm.includes('ROTE') || norm.includes('DELIVERY') || norm.includes('MOTOBOY') || norm.includes('SAIU')) {
    return { status: 'DISPATCHED', label: 'Saiu para Entrega', emoji: '🛵' };
  }
  if (norm.includes('DELIVERED') || norm.includes('CONCLU') || norm.includes('FINALIZ')) {
    return { status: 'DELIVERED', label: 'Entregue', emoji: '✅' };
  }
  if (norm.includes('CANCEL') || norm.includes('REJECT')) {
    return { status: 'CANCELED', label: 'Cancelado', emoji: '❌' };
  }
  return { status: 'PENDING', label: 'Pendente / Recebido', emoji: '⏳' };
}

/**
 * Gera mensagem humanizada para envio ao cliente no WhatsApp conforme a atualização de status do pedido na Saipos
 */
export function generateStatusWhatsAppMessage(
  status: 'PENDING' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELED',
  customerName: string,
  displayId: string,
  extra?: { reason?: string; address?: string }
): string {
  const firstName = customerName ? customerName.split(' ')[0] : 'Cliente';
  const idStr = displayId ? `#${displayId}` : 'do seu pedido';

  switch (status) {
    case 'CONFIRMED':
      return `Olá, *${firstName}*! 👋\n\nSeu pedido *${idStr}* acabou de ser confirmado pela nossa cozinha e já está sendo preparado com muito capricho! 👨‍🍳🔥\n\nAssim que o motoboy sair com ele, eu te aviso por aqui!`;

    case 'DISPATCHED':
      return `Boas notícias, *${firstName}*! 🛵💨\n\nSeu pedido *${idStr}* acabou de sair para entrega com o nosso entregador!\n\nPor favor, fique atento(a) ao interfone, portão ou campainha para receber seu pedido quentinho. Bom apetite! 😋`;

    case 'DELIVERED':
      return `*Pedido Entregue!* 🎉\n\n${firstName}, seu pedido *${idStr}* foi registrado como entregue. Esperamos que goste de cada detalhe!\n\nSe precisar de qualquer coisa ou quiser nos dar um feedback, basta responder esta mensagem. Tenha uma ótima refeição! ❤️`;

    case 'CANCELED':
      return `Olá, *${firstName}*.\n\nInformamos que o seu pedido *${idStr}* precisou ser cancelado no nosso sistema.${extra?.reason ? `\n\n*Motivo:* ${extra.reason}` : ''}\n\nCaso tenha alguma dúvida ou queira refazer seu pedido com alguma alteração, nossa equipe humana está à disposição por aqui!`;

    default:
      return `Olá, *${firstName}*! Recebemos a atualização do seu pedido *${idStr}*. Estamos cuidando de tudo para você!`;
  }
}

/**
 * Dispara notificação no WhatsApp do cliente usando a instância ativa do tenant
 */
export async function sendOrderStatusWhatsAppNotification(
  tenantId: string,
  customerPhone: string,
  message: string
): Promise<boolean> {
  if (!customerPhone || !message) return false;

  try {
    const supabase = getServiceSupabase();

    // 1. Busca instância conectada do tenant
    const { data: instance } = await supabase
      .from('xerb_instances')
      .select('instance_name, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .maybeSingle();

    if (!instance?.instance_name) {
      console.warn(`[Saipos Notification] Nenhuma instância aberta para o tenant ${tenantId}`);
      return false;
    }

    // 2. Normaliza telefone para formato WhatsApp (apenas dígitos)
    let cleanPhone = customerPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    await sendTextMessage(instance.instance_name, cleanPhone, message);
    return true;
  } catch (err: any) {
    console.error('[Saipos sendOrderStatusWhatsAppNotification] Erro ao enviar mensagem:', err?.message || err);
    return false;
  }
}

/**
 * Helper de Armazenamento Resiliente:
 * Lê configuração da integração tentando a tabela xerb_integrations primeiro.
 * Se a tabela não existir, usa xerb_system_config como fallback transparente.
 */
export async function getTenantIntegration(tenantId: string, provider: string): Promise<{
  is_active: boolean;
  environment: 'production' | 'sandbox' | 'homolog';
  credentials: SaiposCredentials;
  settings: SaiposSettings;
  webhook_secret?: string;
  last_sync_at?: string;
  last_error?: string;
}> {
  const supabase = getServiceSupabase();

  try {
    const { data, error } = await supabase
      .from('xerb_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .maybeSingle();

    if (!error && data) {
      const creds = data.credentials || {};
      const idPartner = creds.id_partner || creds.token || '';
      const codStore = creds.cod_store || creds.store_id || '';

      return {
        is_active: Boolean(data.is_active),
        environment: data.environment || 'production',
        credentials: {
          ...creds,
          id_partner: idPartner,
          cod_store: codStore,
          token: idPartner,
          store_id: codStore,
        },
        settings: data.settings || {
          auto_inject_orders: true,
          notify_customer_whatsapp: true,
          default_payment: 'PIX',
        },
        webhook_secret: data.webhook_secret || undefined,
        last_sync_at: data.last_sync_at || undefined,
        last_error: data.last_error || undefined,
      };
    }
  } catch (err) {
    // Tabela pode não ter sido criada ainda no Supabase
  }

  // Fallback: Busca na tabela xerb_system_config
  try {
    const key = `pos_${provider}_${tenantId}`;
    const { data } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      const creds = parsed.credentials || {};
      const idPartner = creds.id_partner || creds.token || '';
      const codStore = creds.cod_store || creds.store_id || '';

      return {
        is_active: Boolean(parsed.is_active),
        environment: parsed.environment || 'production',
        credentials: {
          ...creds,
          id_partner: idPartner,
          cod_store: codStore,
          token: idPartner,
          store_id: codStore,
        },
        settings: parsed.settings || {
          auto_inject_orders: true,
          notify_customer_whatsapp: true,
          default_payment: 'PIX',
        },
        webhook_secret: parsed.webhook_secret,
        last_sync_at: parsed.last_sync_at,
        last_error: parsed.last_error,
      };
    }
  } catch {}

  return {
    is_active: false,
    environment: 'production',
    credentials: { id_partner: '', cod_store: '', token: '', store_id: '' },
    settings: {
      auto_inject_orders: true,
      notify_customer_whatsapp: true,
      default_payment: 'PIX',
    },
  };
}

/**
 * Salva a configuração da integração no banco de dados com fallback resiliente
 */
export async function saveTenantIntegration(
  tenantId: string,
  provider: string,
  data: {
    is_active: boolean;
    environment: 'production' | 'sandbox';
    credentials: SaiposCredentials;
    settings: SaiposSettings;
    webhook_secret?: string;
    last_error?: string;
  }
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  let savedInTable = false;

  try {
    const { error } = await supabase
      .from('xerb_integrations')
      .upsert(
        {
          tenant_id: tenantId,
          provider,
          is_active: data.is_active,
          environment: data.environment,
          credentials: data.credentials,
          settings: data.settings,
          webhook_secret: data.webhook_secret || null,
          last_error: data.last_error || null,
          last_sync_at: now,
          updated_at: now,
        },
        { onConflict: 'tenant_id,provider' }
      );

    if (!error) {
      savedInTable = true;
    }
  } catch {}

  // Salva também no xerb_system_config para garantir persistência contínua
  try {
    const key = `pos_${provider}_${tenantId}`;
    await supabase.from('xerb_system_config').upsert(
      {
        key,
        value: JSON.stringify({
          ...data,
          last_sync_at: now,
        }),
        description: `Configuração da integração ${provider} do tenant ${tenantId}`,
        updated_at: now,
      },
      { onConflict: 'key' }
    );
    return true;
  } catch (err: any) {
    console.error('[saveTenantIntegration] Erro ao salvar fallback:', err?.message || err);
    return savedInTable;
  }
}

/**
 * Consulta o catálogo de produtos e categorias cadastrados na loja da Saipos
 * Endpoint: GET https://order-api.saipos.com/catalog
 */
export async function fetchSaiposCatalog(credentials: SaiposCredentials): Promise<{
  success: boolean;
  catalog?: any[];
  message: string;
}> {
  const idPartner = (credentials.id_partner || credentials.token || '').trim();
  if (!idPartner) {
    return { success: false, message: 'IdPartner não configurado.' };
  }

  const auth = await getSaiposAuthToken(idPartner);
  if (!auth.success || !auth.token) {
    return { success: false, message: auth.message || 'Falha na autenticação da Saipos.' };
  }

  try {
    const res = await fetch('https://order-api.saipos.com/catalog', {
      headers: {
        Authorization: auth.token,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { success: false, message: `Erro ao buscar catálogo na Saipos (HTTP ${res.status}).` };
    }

    const data = await res.json();
    return {
      success: true,
      catalog: Array.isArray(data) ? data : [],
      message: 'Catálogo recuperado com sucesso.',
    };
  } catch (err: any) {
    return { success: false, message: `Erro de conexão ao buscar catálogo: ${err?.message || 'tempo de resposta esgotado'}` };
  }
}

/**
 * Puxa o cardápio da Saipos e grava na Base de Conhecimento da IA (xerb_knowledge_base)
 * agrupando por categorias para que o atendente WhatsApp saiba responder preços e opções.
 */
export async function syncSaiposCatalogToKnowledgeBase(tenantId: string): Promise<{
  success: boolean;
  message: string;
  totalItems?: number;
  totalCategories?: number;
}> {
  const config = await getTenantIntegration(tenantId, 'saipos');
  if (!config.is_active || !config.credentials.id_partner) {
    return { success: false, message: 'A integração com a Saipos não está configurada ou ativa neste estabelecimento.' };
  }

  const catalogRes = await fetchSaiposCatalog(config.credentials);
  if (!catalogRes.success || !catalogRes.catalog) {
    return { success: false, message: catalogRes.message };
  }

  const catalog = catalogRes.catalog;
  if (catalog.length === 0) {
    return { success: false, message: 'Nenhum item encontrado no cardápio da Saipos desta loja.' };
  }

  // Agrupa os itens ativos por categoria
  const byCategory: Record<string, any[]> = {};
  let totalActive = 0;

  for (const item of catalog) {
    if (item.store_item_enabled === 'N') continue;
    const cat = (item.categoria || 'Geral').trim();
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
    totalActive++;
  }

  const categories = Object.keys(byCategory);
  if (categories.length === 0) {
    return { success: false, message: 'Nenhum item habilitado para venda foi encontrado no catálogo da Saipos.' };
  }

  const supabase = getServiceSupabase();

  for (const cat of categories) {
    const items = byCategory[cat];
    const lines = items.map((it) => {
      const priceVal = Number(it.price) || 0;
      const priceStr = priceVal > 0 ? `R$ ${priceVal.toFixed(2).replace('.', ',')}` : 'Sob consulta';
      const codeStr = it.codigo_saipos || it.id_store_item ? ` (Cód: ${it.codigo_saipos || it.id_store_item})` : '';
      const complementStr = it.complemento ? ` [Opções: ${it.complemento}]` : '';
      return `• ${it.item} - ${priceStr}${codeStr}${complementStr}`;
    });

    const title = `Cardápio Saipos - ${cat}`;
    const content = `[Categoria: ${cat.toUpperCase()}]\nItens oficiais sincronizados do PDV Saipos:\n${lines.join('\n')}\n\nObservação: use exatamente esses nomes e valores oficiais de tabela para informar os clientes no WhatsApp.`;

    try {
      const { data: existing } = await supabase
        .from('xerb_knowledge_base')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('title', title)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('xerb_knowledge_base')
          .update({
            content,
            category: 'cardapio',
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('xerb_knowledge_base').insert({
          tenant_id: tenantId,
          category: 'cardapio',
          title,
          content,
          is_active: true,
        });
      }
    } catch (err: any) {
      console.warn(`[syncSaiposCatalogToKnowledgeBase] Aviso ao salvar categoria ${cat}:`, err?.message || err);
    }
  }

  return {
    success: true,
    totalItems: totalActive,
    totalCategories: categories.length,
    message: `Cardápio sincronizado com sucesso! ${totalActive} produtos em ${categories.length} categorias foram importados para a Base de Conhecimento da IA.`,
  };
}
