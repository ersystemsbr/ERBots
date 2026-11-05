import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  getTenantIntegration,
  saveTenantIntegration,
  testSaiposConnection,
  createSaiposOrder,
  SaiposCredentials,
  SaiposSettings,
} from '@/lib/integrations/saipos';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenant_id');

    const guard = await requireTenantAccess(req, tenantIdParam);
    if (!guard.ok) return guard.response;

    const tenantId = guard.tenant.id;
    const saiposConfig = await getTenantIntegration(tenantId, 'saipos');

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

    return NextResponse.json({
      success: true,
      webhookUrl,
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
          id: 'gastrosys',
          name: 'GastroSys (ER Systems)',
          tagline: 'PDV gastronômico próprio da ER Systems com mesas, comandas e estoque unificado',
          status: 'coming_soon',
          is_available: false,
          badge: 'Nativo da Casa (Em breve)',
        },
        {
          id: 'ifood',
          name: 'iFood / Open Delivery',
          tagline: 'Padrão aberto oficial Open Delivery para sincronização com iFood e marketplaces',
          status: 'coming_soon',
          is_available: false,
          badge: 'Em breve',
        },
        {
          id: 'anota_ai',
          name: 'Anota AI / Cardápio Web',
          tagline: 'Sincronização com cardápio digital web e pedidos online',
          status: 'coming_soon',
          is_available: false,
          badge: 'Em breve',
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
            name: 'Pizza Especial de Calabresa Artesanal',
            quantity: 1,
            unit_price: 59.9,
            total_price: 59.9,
            notes: 'Massa fina e crocante, bem assada',
            subitems: [{ name: 'Borda Recheada de Catupiry', price: 12.0, quantity: 1 }],
          },
          {
            name: 'Refrigerante Guaraná Antarctica 2L',
            quantity: 1,
            unit_price: 12.0,
            total_price: 12.0,
          },
        ],
        payments: [
          {
            type: 'PIX',
            value: 83.9,
            prepaid: true,
          },
        ],
        totals: {
          items_price: 71.9,
          delivery_fee: 12.0,
          discount: 0.0,
          total: 83.9,
        },
        notes: 'Pedido de teste enviado pelo Painel ERBots para validação de fluxo da cozinha.',
      };

      const injectResult = await createSaiposOrder(creds, sampleOrder);

      // Salva no histórico de pedidos se possível
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

      return NextResponse.json({
        success: injectResult.success,
        message: injectResult.message,
        orderId: injectResult.external_order_id,
        displayId: injectResult.display_id,
      });
    }

    // Ação Padrão: Salvar configurações
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
