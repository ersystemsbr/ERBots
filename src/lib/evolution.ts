import { getServiceSupabase } from './supabase';

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
}

export async function getEvolutionConfig(): Promise<EvolutionConfig> {
  let apiUrl = '';
  let apiKey = '';

  try {
    const supabase = getServiceSupabase();

    // 1. URL: prioridade para system_config.whatsapp_api_url (atualizada dinamicamente pelo tunnel_manager.py),
    //    com fallback para xerb_system_config.evolution_api_url.
    const { data: dynUrl } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'whatsapp_api_url')
      .maybeSingle();

    if (dynUrl?.value) apiUrl = dynUrl.value;

    if (!apiUrl) {
      const { data: xerbUrl } = await supabase
        .from('xerb_system_config')
        .select('value')
        .eq('key', 'evolution_api_url')
        .maybeSingle();
      if (xerbUrl?.value) apiUrl = xerbUrl.value;
    }

    // 2. API Key: prioridade para a tabela própria do ERBots (xerb_system_config.evolution_api_key),
    //    com fallback para system_config.whatsapp_api_key.
    const { data: xerbKey } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', 'evolution_api_key')
      .maybeSingle();

    if (xerbKey?.value) apiKey = xerbKey.value;

    if (!apiKey) {
      const { data: dynKey } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'whatsapp_api_key')
        .maybeSingle();
      if (dynKey?.value) apiKey = dynKey.value;
    }
  } catch (err) {
    console.warn('[Evolution] Erro ao buscar configurações no Supabase:', err);
  }

  // 3. Fallback final para variáveis de ambiente (se existirem)
  if (!apiUrl) apiUrl = process.env.EVOLUTION_API_URL || '';
  if (!apiKey) apiKey = process.env.EVOLUTION_API_KEY || '';

  apiUrl = apiUrl.replace(/\/+$/, '');
  return { apiUrl, apiKey };
}

export interface InstanceState {
  status: 'CONNECTED' | 'QRCODE' | 'DISCONNECTED';
  qrcode?: string | null;
  phone?: string | null;
  profileName?: string | null;
}

/**
 * (Re)registra o webhook de uma instância na Evolution API
 */
export async function setInstanceWebhook(instanceName: string, webhookUrl: string): Promise<boolean> {
  const { apiUrl, apiKey } = await getEvolutionConfig();
  if (!apiUrl || !apiKey) return false;

  try {
    const res = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      }),
    });
    return res.ok;
  } catch (whErr) {
    console.warn('[Evolution] Erro ao registrar webhook:', whErr);
    return false;
  }
}

/**
 * Cria ou recupera uma instância do WhatsApp na Evolution API
 */
export async function createOrGetInstance(
  instanceName: string,
  webhookUrl: string
): Promise<InstanceState> {
  const { apiUrl, apiKey } = await getEvolutionConfig();

  if (!apiUrl || !apiKey) {
    throw new Error('Configurações da Evolution API não encontradas.');
  }

  // 1. Tenta buscar instâncias existentes
  let instances: any[] = [];
  try {
    const res = await fetch(`${apiUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
      headers: { apikey: apiKey },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) instances = data;
    }
  } catch (err) {
    console.warn('[Evolution] Erro ao buscar instâncias:', err);
  }

  const existing = instances.find(
    (i: any) =>
      (i.instance && i.instance.instanceName === instanceName) ||
      i.name === instanceName
  );

  // Helper para cadastrar webhook
  const registerWebhook = async () => {
    await setInstanceWebhook(instanceName, webhookUrl);
  };

  // Se não existir, cria a instância
  if (!existing) {
    const createRes = await fetch(`${apiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      throw new Error(`Falha na Evolution API ao criar instância: ${errorText}`);
    }

    const createData = await createRes.json();
    await registerWebhook();

    const qrcodeBase64 = createData.qrcode?.base64 || null;
    return {
      status: 'QRCODE',
      qrcode: qrcodeBase64,
    };
  }

  // Se já existe, checa conexão ou gera novo QR
  const connRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
    headers: { apikey: apiKey },
    cache: 'no-store',
  });

  const connData = connRes.ok ? await connRes.json() : {};
  await registerWebhook();

  const isConnected =
    connData?.instance?.state === 'open' ||
    existing?.connectionStatus === 'open' ||
    existing?.instance?.state === 'open';

  if (isConnected) {
    const owner = existing?.ownerJid || existing?.instance?.owner || '';
    const phone = owner.split('@')[0];
    const profileName = existing?.profileName || existing?.instance?.profileName || null;
    return {
      status: 'CONNECTED',
      phone,
      profileName,
    };
  }

  const qrcode = connData.base64 || connData.qrcode?.base64 || null;
  return {
    status: 'QRCODE',
    qrcode,
  };
}

/**
 * Desconecta/desloga uma instância
 */
export async function logoutInstance(instanceName: string): Promise<boolean> {
  const { apiUrl, apiKey } = await getEvolutionConfig();
  try {
    const res = await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: { apikey: apiKey },
    });
    return res.ok;
  } catch (err) {
    console.error('[Evolution] Erro ao deslogar instância:', err);
    return false;
  }
}

/**
 * Deleta completamente uma instância da Evolution API (libera memória e recursos no servidor Linux).
 */
export async function deleteEvolutionInstance(instanceName: string): Promise<boolean> {
  const { apiUrl, apiKey } = await getEvolutionConfig();
  if (!apiUrl || !apiKey || !instanceName) return false;
  try {
    const res = await fetch(`${apiUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
      method: 'DELETE',
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.error(`[Evolution] Erro ao deletar instância ${instanceName}:`, err);
    return false;
  }
}

/**
 * Extrai identificadores normalizados de um evento da Evolution API v2.3+,
 * tratando leads de anúncios Meta/Instagram (@lid) e dispositivos múltiplos (:0).
 */
export function parseWhatsAppAddress(key: any, data?: any): {
  remoteJid: string;
  contactPhone: string;
  isLid: boolean;
} {
  const rawJid = String(key?.remoteJid || '').trim();
  const isLid = rawJid.endsWith('@lid');

  if (isLid) {
    const lidBase = rawJid.replace(/@lid$/i, '').replace(/:\d+$/, '').replace(/\D/g, '');
    const normalizedLid = lidBase ? `${lidBase}@lid` : rawJid;

    const altRaw = String(
      key?.remoteJidAlt || key?.senderPn || data?.senderPn || data?.key?.remoteJidAlt || ''
    ).trim();
    const altDigits = altRaw
      .replace(/@s\.whatsapp\.net$/i, '')
      .replace(/@c\.us$/i, '')
      .replace(/:\d+$/, '')
      .replace(/\D/g, '');

    return {
      remoteJid: normalizedLid,
      contactPhone: altDigits.length >= 10 ? altDigits : `LID:${lidBase || 'lead'}`,
      isLid: true,
    };
  }

  const phoneDigits = rawJid
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@c\.us$/i, '')
    .replace(/:\d+$/, '')
    .replace(/\D/g, '');

  return {
    remoteJid: phoneDigits ? `${phoneDigits}@s.whatsapp.net` : rawJid,
    contactPhone: phoneDigits,
    isLid: false,
  };
}

/**
 * Envia uma mensagem de texto simples pelo WhatsApp.
 * Suporta tanto números tradicionais (@s.whatsapp.net / dígitos) quanto leads @lid (Meta Ads).
 */
export async function sendTextMessage(
  instanceName: string,
  toPhoneOrJid: string,
  text: string
): Promise<boolean> {
  const { apiUrl, apiKey } = await getEvolutionConfig();
  if (!apiUrl || !apiKey) return false;

  const trimmed = (toPhoneOrJid || '').trim();
  let destination = '';
  if (/@lid$/i.test(trimmed)) {
    const lidDigits = trimmed.replace(/@lid$/i, '').replace(/:\d+$/, '').replace(/\D/g, '');
    if (!lidDigits) return false;
    destination = `${lidDigits}@lid`;
  } else {
    const cleanPhone = trimmed
      .replace(/@s\.whatsapp\.net$/i, '')
      .replace(/@c\.us$/i, '')
      .replace(/:\d+$/, '')
      .replace(/\D/g, '');
    if (!cleanPhone) return false;
    destination = cleanPhone;
  }

  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: destination,
        text,
        options: {
          delay: 1000,
          presence: 'composing',
          linkPreview: false,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Evolution] Falha ao enviar mensagem (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Evolution] Exceção ao enviar mensagem:', err);
    return false;
  }
}

/**
 * Baixa a mídia (áudio/imagem) de uma mensagem recebida em base64 via Evolution API.
 * Retorna null se a Evolution não conseguir (mídia expirada, versão sem o endpoint etc.).
 */
export async function getMediaBase64(
  instanceName: string,
  messageKey: { id?: string; remoteJid?: string; fromMe?: boolean }
): Promise<{ base64: string; mimeType: string } | null> {
  const { apiUrl, apiKey } = await getEvolutionConfig();
  if (!apiUrl || !apiKey || !messageKey?.id) return null;

  try {
    const res = await fetch(`${apiUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[Evolution] Falha ao baixar mídia (${res.status}):`, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const base64: string | undefined = data?.base64 || data?.data?.base64;
    const mimeType: string = (data?.mimetype || data?.mimeType || '').split(';')[0];
    if (!base64) return null;
    return { base64: base64.replace(/^data:[^;]+;base64,/, ''), mimeType };
  } catch (err) {
    console.error('[Evolution] Exceção ao baixar mídia:', err);
    return null;
  }
}

/** Normaliza um telefone brasileiro para o formato internacional (somente dígitos, com 55). */
export function normalizeBrPhone(raw?: string | null): string | null {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

export interface EvolutionHealthReport {
  reachable: boolean;
  latencyMs: number | null;
  publicUrl: string;
  isTemporaryTunnel: boolean;
  totalInstances: number;
  openInstances: number;
  erbotsOpenInstances: number;
  erbotsTotalInstances: number;
}

/**
 * Testa conectividade e latência em tempo real com a Evolution API.
 */
export async function checkEvolutionHealth(): Promise<EvolutionHealthReport> {
  const { apiUrl, apiKey } = await getEvolutionConfig();
  const isTemporaryTunnel = /trycloudflare\.com/i.test(apiUrl || '');

  if (!apiUrl || !apiKey) {
    return {
      reachable: false,
      latencyMs: null,
      publicUrl: apiUrl || '',
      isTemporaryTunnel,
      totalInstances: 0,
      openInstances: 0,
      erbotsOpenInstances: 0,
      erbotsTotalInstances: 0,
    };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return {
        reachable: false,
        latencyMs,
        publicUrl: apiUrl,
        isTemporaryTunnel,
        totalInstances: 0,
        openInstances: 0,
        erbotsOpenInstances: 0,
        erbotsTotalInstances: 0,
      };
    }

    const list = await res.json();
    const arr = Array.isArray(list) ? list : [];
    let openInstances = 0;
    let erbotsOpenInstances = 0;
    let erbotsTotalInstances = 0;

    for (const item of arr) {
      const name: string = item?.name || item?.instance?.instanceName || '';
      const state: string = item?.connectionStatus || item?.instance?.state || 'close';
      const isOpen = state === 'open';
      if (isOpen) openInstances++;
      if (name.startsWith('erbots_')) {
        erbotsTotalInstances++;
        if (isOpen) erbotsOpenInstances++;
      }
    }

    return {
      reachable: true,
      latencyMs,
      publicUrl: apiUrl,
      isTemporaryTunnel,
      totalInstances: arr.length,
      openInstances,
      erbotsOpenInstances,
      erbotsTotalInstances,
    };
  } catch {
    return {
      reachable: false,
      latencyMs: Date.now() - start,
      publicUrl: apiUrl,
      isTemporaryTunnel,
      totalInstances: 0,
      openInstances: 0,
      erbotsOpenInstances: 0,
      erbotsTotalInstances: 0,
    };
  }
}

/**
 * Tenta verificar o estado real e acionar reconexão suave quando uma instância sofre queda transitória.
 */
export async function tryReconnectInstance(instanceName: string): Promise<'open' | 'connecting' | 'close'> {
  const { apiUrl, apiKey } = await getEvolutionConfig();
  if (!apiUrl || !apiKey) return 'close';

  const getState = async (): Promise<'open' | 'connecting' | 'close'> => {
    try {
      const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: apiKey },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return 'close';
      const data = await res.json();
      const s = data?.instance?.state || data?.state || 'close';
      if (s === 'open' || s === 'connecting') return s;
      return 'close';
    } catch {
      return 'close';
    }
  };

  const current = await getState();
  if (current === 'open') return 'open';

  try {
    await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Segue para nova checagem
  }

  await new Promise((r) => setTimeout(r, 3500));
  return await getState();
}

/**
 * Localiza uma instância erbots_* ativa (preferindo a de Super Admin ou configurada em alert_instance_name)
 * para despachar alertas de queda quando a instância do próprio cliente acabou de desconectar.
 */
export async function findHealthyNotifierInstance(excludeInstance?: string): Promise<string | null> {
  const { apiUrl, apiKey } = await getEvolutionConfig();
  if (!apiUrl || !apiKey) return null;

  try {
    const supabase = getServiceSupabase();
    const { data: cfg } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', 'alert_instance_name')
      .maybeSingle();
    const preferred = cfg?.value?.trim();

    const res = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr)) return null;

    const openErbots = arr
      .map((i: any) => ({
        name: String(i?.name || i?.instance?.instanceName || ''),
        state: String(i?.connectionStatus || i?.instance?.state || ''),
      }))
      .filter((i) => i.name.startsWith('erbots_') && i.state === 'open' && i.name !== excludeInstance);

    if (!openErbots.length) return null;
    if (preferred && openErbots.some((i) => i.name === preferred)) return preferred;

    // Prioriza instância vinculada a um tenant Super Admin
    const { data: adminInstances } = await supabase
      .from('xerb_instances')
      .select('instance_name, xerb_tenants!inner(is_super_admin)')
      .eq('xerb_tenants.is_super_admin', true);

    const adminNames = new Set((adminInstances || []).map((r: any) => r.instance_name));
    const adminOpen = openErbots.find((i) => adminNames.has(i.name));
    if (adminOpen) return adminOpen.name;

    // Segurança multi-tenant: NUNCA usar instância de outro cliente comum para enviar alertas
    return null;
  } catch {
    return null;
  }
}