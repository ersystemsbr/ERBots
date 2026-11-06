import { getServiceSupabase } from './supabase';
import { normalizeBrPhone, sendTextMessage } from './evolution';

export interface ReengagementSettings {
  // NPS Pós-Entrega
  nps_enabled: boolean;
  nps_delay_minutes: number; // padrão: 40 minutos
  google_maps_url?: string;
  nps_custom_message?: string;

  // Campanha de Fim de Semana (Sextou)
  weekend_campaign_enabled: boolean;
  weekend_day: number; // 5 = sexta-feira, 6 = sábado
  weekend_time: string; // "18:00"
  weekend_custom_message?: string;
  weekend_last_sent_date?: string; // "2026-11-06"

  // Recuperação de Inativos
  inactive_reengagement_enabled: boolean;
  inactive_threshold_days: number; // padrão: 20 dias
  inactive_custom_message?: string;
}

export interface NpsQueueItem {
  id: string;
  tenant_id: string;
  display_id: string;
  customer_name: string;
  customer_phone: string;
  delivered_at: string;
  status: 'pending' | 'sent' | 'responded' | 'dismissed';
  rating?: number;
  sent_at?: string;
  responded_at?: string;
}

const DEFAULT_SETTINGS: ReengagementSettings = {
  nps_enabled: true,
  nps_delay_minutes: 40,
  google_maps_url: '',
  weekend_campaign_enabled: true,
  weekend_day: 5, // Sexta-feira
  weekend_time: '18:00',
  inactive_reengagement_enabled: true,
  inactive_threshold_days: 20,
};

/**
 * Carrega as configurações de Vendas Ativas e Reengajamento do estabelecimento
 */
export async function getReengagementSettings(tenantId: string): Promise<ReengagementSettings> {
  const supabase = getServiceSupabase();
  try {
    const key = `reengagement_${tenantId}`;
    const { data } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn('[getReengagementSettings] Erro ao carregar configurações:', err);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Salva as configurações de Vendas Ativas e Reengajamento
 */
export async function saveReengagementSettings(
  tenantId: string,
  settings: Partial<ReengagementSettings>
): Promise<boolean> {
  const supabase = getServiceSupabase();
  try {
    const current = await getReengagementSettings(tenantId);
    const updated = { ...current, ...settings };
    const key = `reengagement_${tenantId}`;

    await supabase.from('xerb_system_config').upsert(
      {
        key,
        value: JSON.stringify(updated),
        description: `Configurações de Reengajamento e NPS do tenant ${tenantId}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    return true;
  } catch (err) {
    console.error('[saveReengagementSettings] Erro ao salvar:', err);
    return false;
  }
}

/**
 * Agenda a pesquisa de NPS quando um pedido é entregue (Saipos status DELIVERED)
 */
export async function scheduleOrderNps(
  tenantId: string,
  orderInfo: {
    displayId: string;
    customerName: string;
    customerPhone: string;
  }
): Promise<boolean> {
  const cleanPhone = normalizeBrPhone(orderInfo.customerPhone);
  if (!cleanPhone) return false;

  const supabase = getServiceSupabase();
  try {
    const key = `nps_queue_${tenantId}`;
    const { data } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    let queue: NpsQueueItem[] = [];
    if (data?.value) {
      try {
        queue = JSON.parse(data.value);
      } catch {}
    }

    // Evita duplicar se já houver pesquisa agendada recente para esse mesmo pedido/telefone
    const alreadyQueued = queue.some(
      (item) =>
        item.customer_phone === cleanPhone &&
        item.display_id === orderInfo.displayId &&
        (item.status === 'pending' || item.status === 'sent')
    );
    if (alreadyQueued) return true;

    const newItem: NpsQueueItem = {
      id: `nps_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      display_id: orderInfo.displayId || 'Recente',
      customer_name: orderInfo.customerName || 'Cliente',
      customer_phone: cleanPhone,
      delivered_at: new Date().toISOString(),
      status: 'pending',
    };

    // Mantém apenas os últimos 50 itens na fila
    const updatedQueue = [newItem, ...queue.slice(0, 49)];

    await supabase.from('xerb_system_config').upsert(
      {
        key,
        value: JSON.stringify(updatedQueue),
        description: `Fila de pesquisas NPS pendentes do tenant ${tenantId}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    return true;
  } catch (err) {
    console.error('[scheduleOrderNps] Erro ao agendar pesquisa NPS:', err);
    return false;
  }
}

/**
 * Recupera itens da fila de NPS de um tenant
 */
export async function getTenantNpsQueue(tenantId: string): Promise<NpsQueueItem[]> {
  const supabase = getServiceSupabase();
  try {
    const key = `nps_queue_${tenantId}`;
    const { data } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch {}
  return [];
}

/**
 * Atualiza um item da fila de NPS
 */
export async function updateNpsQueueItem(
  tenantId: string,
  itemId: string,
  updates: Partial<NpsQueueItem>
): Promise<void> {
  const supabase = getServiceSupabase();
  try {
    const queue = await getTenantNpsQueue(tenantId);
    const updated = queue.map((item) => (item.id === itemId ? { ...item, ...updates } : item));
    const key = `nps_queue_${tenantId}`;

    await supabase.from('xerb_system_config').upsert(
      {
        key,
        value: JSON.stringify(updated),
        description: `Fila de pesquisas NPS pendentes do tenant ${tenantId}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch (err) {
    console.warn('[updateNpsQueueItem] Erro ao atualizar item NPS:', err);
  }
}

/**
 * Verifica se um telefone tem uma pesquisa de NPS enviada recentemente aguardando nota (1 a 5)
 */
export async function getPendingNpsResponseForPhone(
  tenantId: string,
  phone: string
): Promise<NpsQueueItem | null> {
  const cleanPhone = normalizeBrPhone(phone);
  if (!cleanPhone) return null;

  const queue = await getTenantNpsQueue(tenantId);
  const nowMs = Date.now();
  // Aguarda resposta de NPS nas últimas 24h
  const item = queue.find(
    (q) =>
      q.customer_phone === cleanPhone &&
      q.status === 'sent' &&
      q.sent_at &&
      nowMs - new Date(q.sent_at).getTime() < 24 * 60 * 60 * 1000
  );

  return item || null;
}

/**
 * Processador periódico de pesquisas de NPS no cron de automações
 */
export async function processNpsSurveys(supabase: ReturnType<typeof getServiceSupabase>): Promise<{
  checked: number;
  sent: number;
}> {
  let sentCount = 0;
  let checkedCount = 0;

  try {
    // Busca todas as instâncias ativas e conectadas
    const { data: instances } = await supabase
      .from('xerb_instances')
      .select('tenant_id, instance_name, status')
      .eq('status', 'CONNECTED');

    if (!instances?.length) return { checked: 0, sent: 0 };

    const nowMs = Date.now();

    for (const inst of instances) {
      const tenantId = inst.tenant_id;
      if (!tenantId) continue;

      const settings = await getReengagementSettings(tenantId);
      if (!settings.nps_enabled) continue;

      const queue = await getTenantNpsQueue(tenantId);
      const pendingItems = queue.filter((q) => q.status === 'pending');
      checkedCount += pendingItems.length;

      const delayMs = (settings.nps_delay_minutes || 40) * 60 * 1000;

      for (const item of pendingItems) {
        const deliveredMs = new Date(item.delivered_at).getTime();
        // Dispara se passou o tempo mínimo de entrega (ex: 40 min) e não mais que 6 horas
        if (nowMs - deliveredMs >= delayMs && nowMs - deliveredMs <= 6 * 60 * 60 * 1000) {
          const msg =
            settings.nps_custom_message ||
            [
              `Olá, *${item.customer_name}*! 🛵 Seu pedido *#${item.display_id}* foi entregue há pouco.`,
              '',
              'De *1 a 5*, o que você achou da qualidade da comida e do tempo de entrega?',
              '_(1 = Péssimo, 5 = Excelente)_',
              '',
              'Sua opinião sincera nos ajuda muito a melhorar! 🙏',
            ].join('\n');

          const ok = await sendTextMessage(inst.instance_name, item.customer_phone, msg).catch(() => false);
          if (ok) {
            await updateNpsQueueItem(tenantId, item.id, {
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
            sentCount++;
          }
        } else if (nowMs - deliveredMs > 6 * 60 * 60 * 1000) {
          // Expirou a janela de pesquisa
          await updateNpsQueueItem(tenantId, item.id, {
            status: 'dismissed',
          });
        }
      }
    }
  } catch (err) {
    console.warn('[processNpsSurveys] Erro ao processar pesquisas:', err);
  }

  return { checked: checkedCount, sent: sentCount };
}

/**
 * Processador de Campanhas de Fim de Semana ("Sextou")
 */
export async function processWeekendCampaigns(supabase: ReturnType<typeof getServiceSupabase>): Promise<{
  checked: number;
  sent: number;
}> {
  let sentCount = 0;
  let checkedCount = 0;

  try {
    const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const dayOfWeek = nowBR.getDay(); // 5 = sexta-feira
    const hour = nowBR.getHours();
    const todayYmd = nowBR.toISOString().slice(0, 10);

    const { data: instances } = await supabase
      .from('xerb_instances')
      .select('tenant_id, instance_name, status')
      .eq('status', 'CONNECTED');

    if (!instances?.length) return { checked: 0, sent: 0 };

    for (const inst of instances) {
      const tenantId = inst.tenant_id;
      if (!tenantId) continue;

      const [tenantRes, settings] = await Promise.all([
        supabase.from('xerb_tenants').select('name, phone').eq('id', tenantId).maybeSingle(),
        getReengagementSettings(tenantId),
      ]);

      const tenant = tenantRes.data;
      if (!tenant || !settings.weekend_campaign_enabled) continue;

      const targetDay = typeof settings.weekend_day === 'number' ? settings.weekend_day : 5;
      const targetHour = parseInt(settings.weekend_time?.split(':')[0] || '18', 10);

      // Só executa no dia configurado (ex: sexta = 5) e a partir do horário configurado
      if (dayOfWeek !== targetDay || hour < targetHour) continue;

      // Se já disparou hoje, ignora
      if (settings.weekend_last_sent_date === todayYmd) continue;

      // Busca clientes com interações nos últimos 21 dias (3 semanas)
      const minDate = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentLeads } = await supabase
        .from('xerb_leads')
        .select('customer_name, customer_phone')
        .eq('tenant_id', tenantId)
        .gte('created_at', minDate)
        .order('created_at', { ascending: false })
        .limit(30);

      const uniqueCustomers = new Map<string, string>();
      for (const l of recentLeads || []) {
        const phone = normalizeBrPhone(l.customer_phone);
        if (phone && phone !== normalizeBrPhone(tenant.phone)) {
          uniqueCustomers.set(phone, l.customer_name || 'Cliente');
        }
      }

      checkedCount += uniqueCustomers.size;

      // Dispara em lote seguro anti-ban (máx 20 por execução)
      let count = 0;
      for (const [phone, name] of Array.from(uniqueCustomers.entries()).slice(0, 20)) {
        const msg =
          settings.weekend_custom_message ||
          [
            `Fala, *${name}*! Sextou no *${tenant.name}*! 🥩🍻`,
            '',
            'Hoje a nossa cozinha já está a todo vapor preparando nossos melhores pratos quentinhos e no capricho.',
            '',
            'Bora garantir o seu jantar hoje sem fila? Só me mandar uma mensagem por aqui dizendo o que você vai querer! 👇',
          ].join('\n');

        const ok = await sendTextMessage(inst.instance_name, phone, msg).catch(() => false);
        if (ok) {
          sentCount++;
          count++;
          // Pausa respeitosa de 1.5s entre disparos
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      // Salva marcação de data de disparo
      await saveReengagementSettings(tenantId, { weekend_last_sent_date: todayYmd });
    }
  } catch (err) {
    console.warn('[processWeekendCampaigns] Erro ao processar:', err);
  }

  return { checked: checkedCount, sent: sentCount };
}

/**
 * Processador de Recuperação de Clientes Inativos (20+ dias sem pedir)
 */
export async function processInactiveReengagement(supabase: ReturnType<typeof getServiceSupabase>): Promise<{
  checked: number;
  sent: number;
}> {
  let sentCount = 0;
  let checkedCount = 0;

  try {
    const { data: instances } = await supabase
      .from('xerb_instances')
      .select('tenant_id, instance_name, status')
      .eq('status', 'CONNECTED');

    if (!instances?.length) return { checked: 0, sent: 0 };

    const nowMs = Date.now();

    for (const inst of instances) {
      const tenantId = inst.tenant_id;
      if (!tenantId) continue;

      const [tenantRes, settings] = await Promise.all([
        supabase.from('xerb_tenants').select('name, phone').eq('id', tenantId).maybeSingle(),
        getReengagementSettings(tenantId),
      ]);

      const tenant = tenantRes.data;
      if (!tenant || !settings.inactive_reengagement_enabled) continue;

      const thresholdDays = settings.inactive_threshold_days || 20;
      const minInactiveMs = thresholdDays * 24 * 60 * 60 * 1000;
      const maxInactiveMs = 50 * 24 * 60 * 60 * 1000;

      const minDateIso = new Date(nowMs - maxInactiveMs).toISOString();
      const maxDateIso = new Date(nowMs - minInactiveMs).toISOString();

      // Busca clientes com última atividade na faixa de inatividade
      const { data: inactives } = await supabase
        .from('xerb_leads')
        .select('id, customer_name, customer_phone, created_at, followup_sent_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', minDateIso)
        .lte('created_at', maxDateIso)
        .limit(15);

      if (!inactives?.length) continue;

      checkedCount += inactives.length;

      for (const item of inactives) {
        const phone = normalizeBrPhone(item.customer_phone);
        if (!phone || phone === normalizeBrPhone(tenant.phone)) continue;

        const msg =
          settings.inactive_custom_message ||
          [
            `Oi, *${item.customer_name || 'amigo(a)'}*! Sentimos sua falta aqui no *${tenant.name}*! 😋`,
            '',
            'Passando para lembrar que estamos com o cardápio atualizado e tudo preparado com o carinho de sempre.',
            '',
            'Que tal matar a saudade hoje? Só me dizer o que você vai querer que já agilizo para você! 🚀',
          ].join('\n');

        const ok = await sendTextMessage(inst.instance_name, phone, msg).catch(() => false);
        if (ok) {
          sentCount++;
          await supabase
            .from('xerb_leads')
            .update({ followup_sent_at: new Date().toISOString() })
            .eq('id', item.id);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  } catch (err) {
    console.warn('[processInactiveReengagement] Erro ao processar:', err);
  }

  return { checked: checkedCount, sent: sentCount };
}
