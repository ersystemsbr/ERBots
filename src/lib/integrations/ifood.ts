import { getServiceSupabase } from '@/lib/supabase';

export interface IfoodConfig {
  client_id: string;
  client_secret: string;
  merchant_id: string;
  is_active: boolean;
  auto_confirm_orders: boolean;
  notify_customer_whatsapp: boolean;
}

export const DEFAULT_IFOOD_CONFIG: IfoodConfig = {
  client_id: '',
  client_secret: '',
  merchant_id: '',
  is_active: false,
  auto_confirm_orders: false,
  notify_customer_whatsapp: true,
};

export async function getIfoodIntegration(tenantId: string): Promise<IfoodConfig> {
  const supabase = getServiceSupabase();
  try {
    const key = `pos_integration_${tenantId}_ifood`;
    const { data } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      return { ...DEFAULT_IFOOD_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('[getIfoodIntegration] Erro ao carregar config iFood:', err);
  }
  return DEFAULT_IFOOD_CONFIG;
}

export async function saveIfoodIntegration(
  tenantId: string,
  settings: Partial<IfoodConfig>
): Promise<boolean> {
  const supabase = getServiceSupabase();
  try {
    const current = await getIfoodIntegration(tenantId);
    const updated = { ...current, ...settings };
    const key = `pos_integration_${tenantId}_ifood`;

    await supabase.from('xerb_system_config').upsert(
      {
        key,
        value: JSON.stringify(updated),
        description: `Configuração do iFood / Open Delivery para o tenant ${tenantId}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    return true;
  } catch (err) {
    console.error('[saveIfoodIntegration] Erro ao salvar:', err);
    return false;
  }
}

export function mapIfoodEvent(eventType: string): {
  status: 'PENDING' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  label: string;
  emoji: string;
} {
  const norm = String(eventType || '').toUpperCase().trim();
  switch (norm) {
    case 'PLC':
    case 'PLACED':
      return { status: 'PENDING', label: 'Recebido pelo iFood', emoji: '📥' };
    case 'CFM':
    case 'CONFIRMED':
      return { status: 'CONFIRMED', label: 'Em Preparação', emoji: '🍳' };
    case 'DSP':
    case 'DISPATCHED':
      return { status: 'DISPATCHED', label: 'Saiu para Entrega', emoji: '🛵' };
    case 'CON':
    case 'DELIVERED':
    case 'CONCLUDED':
      return { status: 'DELIVERED', label: 'Entregue ao Cliente', emoji: '🎉' };
    case 'CAN':
    case 'CANCELLED':
      return { status: 'CANCELLED', label: 'Cancelado no iFood', emoji: '❌' };
    default:
      return { status: 'PENDING', label: 'Atualizado', emoji: '🔔' };
  }
}
