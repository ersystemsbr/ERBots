import { getServiceSupabase } from './supabase';

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
}

export async function getEvolutionConfig(): Promise<EvolutionConfig> {
  let apiUrl = process.env.EVOLUTION_API_URL || '';
  let apiKey = process.env.EVOLUTION_API_KEY || '';

  if (!apiUrl || !apiKey) {
    try {
      const supabase = getServiceSupabase();
      const { data: urlRow } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'evolution_api_url')
        .single();
      const { data: keyRow } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'evolution_api_key')
        .single();

      if (urlRow?.value) apiUrl = urlRow.value;
      if (keyRow?.value) apiKey = keyRow.value;
    } catch (err) {
      console.warn('[Evolution] Erro ao buscar system_config:', err);
    }
  }

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
    try {
      await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
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
    } catch (whErr) {
      console.warn('[Evolution] Erro ao registrar webhook:', whErr);
    }
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
 * Envia uma mensagem de texto simples pelo WhatsApp
 */
export async function sendTextMessage(
  instanceName: string,
  toPhoneOrJid: string,
  text: string
): Promise<boolean> {
  const { apiUrl, apiKey } = await getEvolutionConfig();
  if (!apiUrl || !apiKey) return false;

  const cleanPhone = toPhoneOrJid.replace(/\D/g, '');
  if (!cleanPhone) return false;

  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text,
        options: {
          delay: 1000,
          presence: 'composing',
          linkPreview: false,
        },
      }),
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
