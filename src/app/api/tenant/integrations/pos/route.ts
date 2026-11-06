import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  getTenantIntegration,
  saveTenantIntegration,
  testSaiposConnection,
  createSaiposOrder,
  syncSaiposCatalogToKnowledgeBase,
  SaiposCredentials,
  SaiposSettings,
} from '@/lib/integrations/saipos';
import { getIfoodIntegration, saveIfoodIntegration } from '@/lib/integrations/ifood';
import { getGoogleBusinessConfig } from '@/lib/integrations/google-business';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenant_id');

    const guard = await requireTenantAccess(req, tenantIdParam);
    if (!guard.ok) return guard.response;

    const tenantId = guard.tenant.id;
    const [saiposConfig, ifoodConfig, googleConfig] = await Promise.all([
      getTenantIntegration(tenantId, 'saipos'),
      getIfoodIntegration(tenantId),
      getGoogleBusinessConfig(tenantId),
    ]);

    // Busca pedidos recentes no PDV se a tabela existir
    const supabase = getServiceSupabase();
    let recentOrders: any[] = [];
    try {
      const { data } = await supabase
        .from('xerb_pos_orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) recentOrders = data;
    } catch {}

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://www.erbots.com.br');
    const webhookUrl = `${appUrl}/api/webhook/saipos?tenant_id=${tenantId}`;
    const ifoodWebhookUrl = `${appUrl}/api/webhook/ifood?tenant_id=${tenantId}`;

    return NextResponse.json({
      success: true,
      webhookUrl,
      ifoodWebhookUrl,
      systems: [
        {
          id: 'saipos',
          name: 'Saipos',
          tagline: 'PDV & Gestão de Delivery Inteligente para Restaurantes e Pizzarias',
          status: saiposConfig.is_active ? 'active' : 'available',
          is_available: true,
          badge: saiposConfig.is_active ? 'Conectado & Ativo' : 'Disponível',
          config: saiposConfig,
        },
        {
          id: 'ifood',
          name: 'iFood / Open Delivery',
          tagline: 'Padrão aberto oficial Open Delivery para sincronização com pedidos e status do iFood',
          status: ifoodConfig.is_active ? 'active' : 'available',
          is_available: true,
          badge: ifoodConfig.is_active ? 'Conectado & Ativo' : 'Disponível',
          config: ifoodConfig,
        },
        {
          id: 'google_business',
          name: 'Google Meu Negócio',
          tagline: 'Monitoramento de avaliações do Google Maps com respostas automáticas humanizadas por IA',
          status: googleConfig.is_active ? 'active' : 'available',
          is_available: true,
          badge: googleConfig.is_active ? 'Conectado & Ativo' : 'Disponível',
          config: googleConfig,
        },
      ],
      recentOrders,
    });
  } catch (err: any) {
    console.error('[API Tenant Integrations POS GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar integrações de PDV.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, action = 'save', provider = 'saipos', credentials, settings, is_active, environment } = body;

    const guard = await requireTenantAccess(req, tenant_id);
    if (!guard.ok) return guard.response;

    const tenantId = guard.tenant.id;

    if (action === 'test_connection') {
      const idPartner = (credentials?.id_partner || credentials?.token || '').trim();
      const codStore = (credentials?.cod_store || credentials?.store_id || '').trim();
      const testCreds: SaiposCredentials = {
        id_partner: idPartner,
        cod_store: codStore,
        token: idPartner,
        store_id: codStore,
        environment: environment || 'production',
      };
      const result = await testSaiposConnection(testCreds);
      return NextResponse.json(result);
    }

    if (action === 'simulate_order') {
      const saiposConfig = await getTenantIntegration(tenantId, 'saipos');
      const idPartner = (credentials?.id_partner || credentials?.token || saiposConfig.credentials.id_partner || saiposConfig.credentials.token || '').trim();
      const codStore = (credentials?.cod_store || credentials?.store_id || saiposConfig.credentials.cod_store || saiposConfig.credentials.store_id || '99018').trim();

      const creds: SaiposCredentials = {
        id_partner: idPartner,
        cod_store: codStore,
        token: idPartner,
        store_id: codStore,
        environment: environment || saiposConfig.environment,
      };

      const sampleOrder = {
        order_type: 'DELIVERY' as const,
        customer: {
          name: 'João Silva (Teste ERBots)',
          phone: guard.tenant.phone || guard.tenant.alert_phone || '5511999999999',
        },
        delivery_address: {
          street: 'Av. Paulista',
          number: '1000',
          complement: 'Apto 42',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
          postal_code: '01310-100',
          reference: 'Em frente ao metrô',
        },
        items: [
          {
            id: '43418185',
            name: 'Diversos (Item Teste)',
            quantity: 1,
            unit_price: 25.0,
            total_price: 25.0,
            notes: 'Item de teste via ERBots IA',
          },
        ],
        payments: [
          {
            type: 'PIX',
            value: 25.0,
            prepaid: true,
          },
        ],
        totals: {
          items_price: 25.0,
          delivery_fee: 0.0,
          discount: 0.0,
          total: 25.0,
        },
        notes: 'Pedido de teste enviado pelo Painel ERBots para validação de fluxo da cozinha.',
      };

      const injectResult = await createSaiposOrder(creds, sampleOrder);

      // Salva no histórico de pedidos apenas se o pedido foi realmente aceito pela Saipos
      if (injectResult.success) {
        const supabase = getServiceSupabase();
        try {
          await supabase.from('xerb_pos_orders').insert({
            tenant_id: tenantId,
            provider: 'saipos',
            external_order_id: injectResult.external_order_id,
            display_id: injectResult.display_id || '#1042',
            customer_name: sampleOrder.customer.name,
            customer_phone: sampleOrder.customer.phone,
            order_type: sampleOrder.order_type,
            status: 'CONFIRMED',
            items: sampleOrder.items,
            total_amount: sampleOrder.totals.total,
            payment_method: 'PIX',
            delivery_address: sampleOrder.delivery_address,
            notes: sampleOrder.notes,
            raw_payload: sampleOrder,
            response_payload: injectResult.rawResponse || {},
          });
        } catch {}
      }

      return NextResponse.json({
        success: injectResult.success,
        message: injectResult.message,
        orderId: injectResult.external_order_id,
        displayId: injectResult.display_id,
      });
    }

    if (action === 'sync_menu') {
      const syncResult = await syncSaiposCatalogToKnowledgeBase(tenantId);
      return NextResponse.json(syncResult);
    }

    if (provider === 'ifood') {
      const saved = await saveIfoodIntegration(tenantId, {
        client_id: (credentials?.client_id || '').trim(),
        client_secret: (credentials?.client_secret || '').trim(),
        merchant_id: (credentials?.merchant_id || '').trim(),
        is_active: Boolean(is_active),
        notify_customer_whatsapp: settings?.notify_customer_whatsapp !== false,
      });
      return NextResponse.json({
        success: saved,
        message: saved ? 'Configurações do iFood / Open Delivery salvas com sucesso!' : 'Erro ao salvar iFood.',
      });
    }

    // Ação Padrão: Salvar configurações Saipos
    const idPartner = (credentials?.id_partner || credentials?.token || '').trim();
    const codStore = (credentials?.cod_store || credentials?.store_id || '').trim();

    const saved = await saveTenantIntegration(tenantId, provider, {
      is_active: Boolean(is_active),
      environment: environment === 'sandbox' || environment === 'homolog' ? environment : 'production',
      credentials: {
        id_partner: idPartner,
        cod_store: codStore,
        token: idPartner,
        store_id: codStore,
      },
      settings: {
        auto_inject_orders: settings?.auto_inject_orders !== false,
        notify_customer_whatsapp: settings?.notify_customer_whatsapp !== false,
        default_payment: settings?.default_payment || 'PIX',
        sync_menu: Boolean(settings?.sync_menu),
      },
      webhook_secret: body.webhook_secret || undefined,
    });

    return NextResponse.json({
      success: saved,
      message: saved
        ? 'Configurações da integração Saipos salvas com sucesso!'
        : 'Erro ao persistir configurações.',
    });
  } catch (err: any) {
    console.error('[API Tenant Integrations POS POST]', err);
    return NextResponse.json({ error: 'Erro ao processar integração.' }, { status: 500 });
  }
}
