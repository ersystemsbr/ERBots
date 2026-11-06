'use client';

import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api-client';
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  Cpu,
  RefreshCw,
  Copy,
  Check,
  Utensils,
  ExternalLink,
  Zap,
  ShoppingBag,
  Send,
  Sliders,
  ShieldCheck,
  Clock,
  ArrowRight,
  Database,
  Code,
  BookOpen,
  Flame,
  MapPin,
  Sparkles,
  Save,
} from 'lucide-react';

interface IntegrationsManagerProps {
  tenantId: string;
  isSuperAdmin?: boolean;
}

interface PosSystem {
  id: string;
  name: string;
  tagline: string;
  status: 'active' | 'available' | 'coming_soon';
  is_available: boolean;
  badge: string;
  config?: any;
}

export default function IntegrationsManager({ tenantId, isSuperAdmin }: IntegrationsManagerProps) {
  const [loading, setLoading] = useState(true);
  const [systems, setSystems] = useState<PosSystem[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [ifoodWebhookUrl, setIfoodWebhookUrl] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<string>('saipos');

  // Formulário Saipos
  const [saiposForm, setSaiposForm] = useState({
    id_partner: '',
    cod_store: '',
    token: '',
    store_id: '',
    environment: 'production' as 'production' | 'sandbox' | 'homolog',
    is_active: false,
    auto_inject_orders: true,
    notify_customer_whatsapp: true,
    default_payment: 'PIX' as 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH',
  });

  // Formulário iFood
  const [ifoodForm, setIfoodForm] = useState({
    client_id: '',
    client_secret: '',
    merchant_id: '',
    is_active: false,
    notify_customer_whatsapp: true,
  });

  // Formulário Google Meu Negócio
  const [googleForm, setGoogleForm] = useState({
    place_id: '',
    maps_review_url: '',
    is_active: false,
    auto_reply_5_star: true,
    alert_owner_low_rating: true,
  });
  const [testingGoogleAi, setTestingGoogleAi] = useState(false);
  const [sampleAiReply, setSampleAiReply] = useState<string | null>(null);

  // Estados de ação
  const [testingConnection, setTestingConnection] = useState(false);
  const [simulatingOrder, setSimulatingOrder] = useState(false);
  const [syncingMenu, setSyncingMenu] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/tenant/integrations/pos?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setSystems(data.systems || []);
        setRecentOrders(data.recentOrders || []);
        setWebhookUrl(data.webhookUrl || '');
        setIfoodWebhookUrl(data.ifoodWebhookUrl || '');

        const saiposSys = (data.systems || []).find((s: any) => s.id === 'saipos');
        if (saiposSys?.config) {
          const cfg = saiposSys.config;
          const idPartner = cfg.credentials?.id_partner || cfg.credentials?.token || '';
          const codStore = cfg.credentials?.cod_store || cfg.credentials?.store_id || '';
          setSaiposForm({
            id_partner: idPartner,
            cod_store: codStore,
            token: idPartner,
            store_id: codStore,
            environment: cfg.environment || 'production',
            is_active: Boolean(cfg.is_active),
            auto_inject_orders: cfg.settings?.auto_inject_orders !== false,
            notify_customer_whatsapp: cfg.settings?.notify_customer_whatsapp !== false,
            default_payment: cfg.settings?.default_payment || 'PIX',
          });
        }

        const ifoodSys = (data.systems || []).find((s: any) => s.id === 'ifood');
        if (ifoodSys?.config) {
          const cfg = ifoodSys.config;
          setIfoodForm({
            client_id: cfg.client_id || '',
            client_secret: cfg.client_secret || '',
            merchant_id: cfg.merchant_id || '',
            is_active: Boolean(cfg.is_active),
            notify_customer_whatsapp: cfg.notify_customer_whatsapp !== false,
          });
        }

        const googleSys = (data.systems || []).find((s: any) => s.id === 'google_business');
        if (googleSys?.config) {
          const cfg = googleSys.config;
          setGoogleForm({
            place_id: cfg.place_id || '',
            maps_review_url: cfg.maps_review_url || '',
            is_active: Boolean(cfg.is_active),
            auto_reply_5_star: cfg.auto_reply_5_star !== false,
            alert_owner_low_rating: cfg.alert_owner_low_rating !== false,
          });
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar integrações de PDV:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleFillTestData = () => {
    setSaiposForm((prev) => ({
      ...prev,
      id_partner: '33f12a976e2a7a100b37fe7d0d102257',
      cod_store: 'b2ad11df-f505-4409-b955-7da9420d871c',
      environment: 'homolog',
      is_active: true,
    }));
    setFeedbackMsg({
      type: 'success',
      text: 'Dados da Loja de Teste preenchidos! Clique em Salvar e depois em Disparar Pedido de Teste.',
    });
  };

  const handleSaveSaipos = async () => {
    try {
      setSavingSettings(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/integrations/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          provider: 'saipos',
          action: 'save',
          is_active: saiposForm.is_active,
          environment: saiposForm.environment,
          credentials: {
            id_partner: saiposForm.id_partner,
            cod_store: saiposForm.cod_store,
            token: saiposForm.id_partner,
            store_id: saiposForm.cod_store,
          },
          settings: {
            auto_inject_orders: saiposForm.auto_inject_orders,
            notify_customer_whatsapp: saiposForm.notify_customer_whatsapp,
            default_payment: saiposForm.default_payment,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setFeedbackMsg({
          type: 'success',
          text: 'Configurações da integração Saipos salvas com sucesso!',
        });
        await loadData();
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.message || data.error || 'Erro ao salvar configurações.',
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão ao salvar configurações.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    if (!saiposForm.id_partner.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe o IdPartner da loja na Saipos antes de testar.' });
      return;
    }
    try {
      setTestingConnection(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/integrations/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          provider: 'saipos',
          action: 'test_connection',
          credentials: {
            id_partner: saiposForm.id_partner,
            cod_store: saiposForm.cod_store,
            token: saiposForm.id_partner,
            store_id: saiposForm.cod_store,
          },
          environment: saiposForm.environment,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setFeedbackMsg({
          type: 'success',
          text: data.message || 'Conexão com a Saipos testada e autenticada com sucesso! 🚀',
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.message || data.error || 'Não foi possível validar o IdPartner junto à Saipos.',
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro de rede ao conectar à API da Saipos.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSimulateOrder = async () => {
    try {
      setSimulatingOrder(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/integrations/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          provider: 'saipos',
          action: 'simulate_order',
          credentials: {
            id_partner: saiposForm.id_partner,
            cod_store: saiposForm.cod_store,
            token: saiposForm.id_partner,
            store_id: saiposForm.cod_store,
          },
          environment: saiposForm.environment,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Pedido #${data.displayId || '1042'} enviado para o fluxo da Saipos!`,
        });
        await loadData();
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.message || data.error || 'Erro ao simular envio de pedido na Saipos.',
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao conectar para envio do pedido simulado.' });
    } finally {
      setSimulatingOrder(false);
    }
  };

  const handleSyncMenu = async () => {
    try {
      setSyncingMenu(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/integrations/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          provider: 'saipos',
          action: 'sync_menu',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setFeedbackMsg({
          type: 'success',
          text: data.message || 'Cardápio da Saipos sincronizado com sucesso com a IA!',
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.message || data.error || 'Erro ao sincronizar cardápio da Saipos.',
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao conectar para sincronizar o cardápio.' });
    } finally {
      setSyncingMenu(false);
    }
  };

  const handleSaveIfood = async () => {
    try {
      setSavingSettings(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/integrations/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          provider: 'ifood',
          is_active: ifoodForm.is_active,
          credentials: {
            client_id: ifoodForm.client_id,
            client_secret: ifoodForm.client_secret,
            merchant_id: ifoodForm.merchant_id,
          },
          settings: {
            notify_customer_whatsapp: ifoodForm.notify_customer_whatsapp,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({ type: 'success', text: 'Configurações do iFood / Open Delivery salvas com sucesso!' });
        loadData();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao salvar configurações do iFood.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao salvar.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveGoogle = async () => {
    try {
      setSavingSettings(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/integrations/google-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          settings: googleForm,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({ type: 'success', text: 'Configurações do Google Meu Negócio salvas com sucesso!' });
        loadData();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao salvar Google Meu Negócio.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao salvar.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestGoogleReply = async () => {
    try {
      setTestingGoogleAi(true);
      setSampleAiReply(null);
      const res = await authFetch('/api/tenant/integrations/google-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          action: 'test_ai_reply',
          sampleReview: {
            author: 'Mariana Silva',
            rating: 5,
            comment: 'Melhor espetinho da cidade! O chopp estava trincando de gelado e o atendimento nota 10.',
          },
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setSampleAiReply(data.reply);
      }
    } catch (err) {
      console.warn('Erro ao testar IA do Google:', err);
    } finally {
      setTestingGoogleAi(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="text-sm">Carregando integrações de PDV e ERP...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-medium border animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:text-white transition">
            ✕
          </button>
        </div>
      )}

      {/* Header Executivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 shrink-0">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
                Integrações PDV &amp; Delivery
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Automação de Pedidos
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Conecte o atendente do WhatsApp ao seu sistema de restaurante. O cliente pede no Zap, o pedido cai na cozinha e o status volta automático.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                saiposForm.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span>{saiposForm.is_active ? 'Saipos Conectada' : 'Sem PDV Ativo'}</span>
          </div>
        </div>
      </div>

      {/* Grid de Sistemas Suportados (Design Modular) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {systems.map((sys) => {
          const isSelected = selectedSystem === sys.id;
          return (
            <div
              key={sys.id}
              onClick={() => setSelectedSystem(sys.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left relative ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{sys.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                      sys.status === 'active'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : sys.is_available
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {sys.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{sys.tagline}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className={isSelected ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                  {isSelected ? 'Configurando agora' : 'Clique para ver'}
                </span>
                <ArrowRight
                  className={`w-3.5 h-3.5 transition-transform ${
                    isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-slate-600'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Painel do Sistema Selecionado: SAIPOS */}
      {selectedSystem === 'saipos' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-orange-500/20">
                  S
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Saipos Food Delivery &amp; PDV
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
                      API Oficial v2.5
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Injeta automaticamente os pedidos concluídos pelo robô do WhatsApp diretamente na tela de pedidos e KDS da Saipos.
                  </p>
                </div>
              </div>

              {/* Toggle Ligar/Desligar Saipos */}
              <button
                onClick={() => setSaiposForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-bold transition shadow-sm ${
                  saiposForm.is_active
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    saiposForm.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`}
                />
                <span>{saiposForm.is_active ? 'Integração ATIVA' : 'Integração DESATIVADA'}</span>
              </button>
            </div>

            {/* Guia de Ativação do Restaurante */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Como ativar o ERBots na sua conta Saipos:
                </span>
                <button
                  type="button"
                  onClick={handleFillTestData}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 flex items-center gap-1 w-fit"
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  Preencher dados da Loja de Teste (Sandbox)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-300">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-emerald-400 block">1. Acesse o Painel Saipos</span>
                  <p className="text-slate-400 leading-relaxed">
                    Entre em <strong className="text-slate-300">conta.saipos.com</strong> e abra o <strong>Menu → Canais de Vendas e Integrações</strong>.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-emerald-400 block">2. Habilite a Integração</span>
                  <p className="text-slate-400 leading-relaxed">
                    Busque por <strong>ERBots</strong> (ou canal externo), clique em <strong>Configurar</strong>, marque <em>Confirmar pedidos automaticamente</em> e salve.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                  <span className="font-bold text-emerald-400 block">3. Cole o IdPartner e Loja</span>
                  <p className="text-slate-400 leading-relaxed">
                    Copie o <strong>IdPartner</strong> gerado e cole abaixo junto com o <strong>ID da sua Loja</strong>. A chave Secret da ER Systems é validada automaticamente.
                  </p>
                </div>
              </div>
            </div>

            {/* Credenciais e Conexão */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Identificação da sua Loja na Saipos
                </h4>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                    IdPartner da Loja na Saipos <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={saiposForm.id_partner}
                    onChange={(e) =>
                      setSaiposForm((prev) => ({
                        ...prev,
                        id_partner: e.target.value,
                        token: e.target.value,
                      }))
                    }
                    placeholder="Ex: 33f12a976e2a7a100b37fe7d0d102257"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono transition"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Código exclusivo gerado na sua loja Saipos ao salvar a integração. O Secret da plataforma é autenticado de forma segura pelo servidor.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                      Código da Loja (cod_store) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={saiposForm.cod_store}
                      onChange={(e) =>
                        setSaiposForm((prev) => ({
                          ...prev,
                          cod_store: e.target.value,
                          store_id: e.target.value,
                        }))
                      }
                      placeholder="Ex: 99018"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono transition"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">ID numérico da loja na Saipos</span>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5 font-medium">Ambiente</label>
                    <select
                      value={saiposForm.environment}
                      onChange={(e: any) =>
                        setSaiposForm((prev) => ({ ...prev, environment: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                    >
                      <option value="production">Produção Oficial</option>
                      <option value="homolog">Homologação (Loja de Teste)</option>
                    </select>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">order-api.saipos.com</span>
                  </div>
                </div>
              </div>

              {/* Automações & Regras de Negócio */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  Regras de Automação com o WhatsApp
                </h4>

                <div className="space-y-2.5">
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={saiposForm.auto_inject_orders}
                      onChange={(e) =>
                        setSaiposForm((prev) => ({ ...prev, auto_inject_orders: e.target.checked }))
                      }
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Injeção Automática de Pedidos</span>
                      <span className="text-[11px] text-slate-400 leading-relaxed block">
                        Assim que o cliente confirma o pedido no WhatsApp, o robô dispara o pedido direto para a Saipos (KDS/Cozinha) sem intervenção manual.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={saiposForm.notify_customer_whatsapp}
                      onChange={(e) =>
                        setSaiposForm((prev) => ({
                          ...prev,
                          notify_customer_whatsapp: e.target.checked,
                        }))
                      }
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Avisos de Status Automáticos no WhatsApp do Cliente
                      </span>
                      <span className="text-[11px] text-slate-400 leading-relaxed block">
                        Quando a cozinha aceita o pedido, quando o motoboy sai para entrega ou quando for entregue, o robô manda mensagem no WhatsApp do cliente avisando em tempo real.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Barra de Ações: Testar Conexão, Simular Pedido, Salvar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
                >
                  {testingConnection ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validando Token...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Testar Conexão com a Saipos</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSimulateOrder}
                  disabled={simulatingOrder}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
                >
                  {simulatingOrder ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Injetando Pedido de Teste...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Disparar Pedido de Teste</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSyncMenu}
                  disabled={syncingMenu || !saiposForm.is_active}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
                  title="Puxa os produtos e preços do cardápio cadastrado na Saipos para a Base de Conhecimento da IA"
                >
                  {syncingMenu ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sincronizando Cardápio...</span>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Sincronizar Cardápio para a IA</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveSaipos}
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                {savingSettings ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                    <span>Salvar Configurações da Saipos</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Histórico de Pedidos Sincronizados com o PDV */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Últimos Pedidos Injetados no PDV
                </h4>
                <p className="text-xs text-slate-400">
                  Histórico de pedidos gerados pelo robô e enviados à Saipos com rastreamento de status.
                </p>
              </div>
              <button
                onClick={loadData}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Atualizar lista"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentOrders.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800/60 text-slate-500 text-xs space-y-2">
                <ShoppingBag className="w-8 h-8 mx-auto text-slate-600 stroke-[1.5]" />
                <p>Nenhum pedido registrado ainda nesta integração.</p>
                <p className="text-slate-600">
                  Clique em &quot;Disparar Pedido de Teste&quot; acima para simular uma venda de delivery com a Saipos.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto [scrollbar-width:none]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Pedido</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Total</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-mono font-bold text-white">
                          {order.display_id || order.external_order_id?.substring(0, 8)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-white">{order.customer_name}</div>
                          <div className="text-[11px] text-slate-500">{order.customer_phone}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold">
                            {order.order_type || 'DELIVERY'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-emerald-400">
                          R$ {Number(order.total_amount || 0).toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              order.status === 'DELIVERED'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : order.status === 'DISPATCHED'
                                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                                : order.status === 'CONFIRMED'
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500 text-[11px]">
                          {new Date(order.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Painel do Sistema: iFood / Open Delivery */}
      {selectedSystem === 'ifood' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-red-500/20">
                  <Utensils className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">iFood & Open Delivery</h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        ifoodForm.is_active
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {ifoodForm.is_active ? 'Conectado & Ativo' : 'Pendente de Configuração'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Padrão aberto oficial para sincronização de pedidos e status do iFood.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ifoodForm.is_active}
                  onChange={(e) => setIfoodForm({ ...ifoodForm, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-red-400" />
                Credenciais da Loja no iFood Developer
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Merchant ID (ID da Loja no iFood)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: c7891...-4b92-..."
                    value={ifoodForm.merchant_id}
                    onChange={(e) => setIfoodForm({ ...ifoodForm, merchant_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Client ID (Portal Desenvolvedor)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: client-id-..."
                    value={ifoodForm.client_id}
                    onChange={(e) => setIfoodForm({ ...ifoodForm, client_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    value={ifoodForm.client_secret}
                    onChange={(e) => setIfoodForm({ ...ifoodForm, client_secret: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* URL do Webhook do iFood */}
              {ifoodWebhookUrl && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-red-400" />
                      URL de Webhook para Eventos do iFood
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(ifoodWebhookUrl, 'ifood-webhook')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedKey === 'ifood-webhook' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar URL</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 break-all bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    {ifoodWebhookUrl}
                  </p>
                </div>
              )}

              {/* Regra de Reengajamento para iFood */}
              <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/20 flex items-start gap-3">
                <Flame className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-red-300">
                    Transforme Clientes do iFood em Clientes Recorrentes Diretos
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    Quando o motoboy do iFood entregar o pedido, o ERBots aciona a pesquisa de NPS no WhatsApp do cliente. Se a nota for 5, a IA convida o cliente a pedir direto pelo seu WhatsApp na próxima vez, economizando até 27% de taxas!
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveIfood}
                  disabled={savingSettings}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
                >
                  {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar Configurações do iFood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Painel do Sistema: Google Meu Negócio */}
      {selectedSystem === 'google_business' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-blue-500/20">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">Google Meu Negócio</h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        googleForm.is_active
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {googleForm.is_active ? 'Conectado & Ativo' : 'Disponível'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Monitoramento e respostas automáticas inteligentes por IA para avaliações no Google Maps.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={googleForm.is_active}
                  onChange={(e) => setGoogleForm({ ...googleForm, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Link da Ficha ou URL de Avaliações do Google Maps
                </label>
                <input
                  type="url"
                  placeholder="https://g.page/r/... ou link de receber mais avaliações da sua ficha"
                  value={googleForm.maps_review_url}
                  onChange={(e) => setGoogleForm({ ...googleForm, maps_review_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Este link também é enviado automaticamente na pesquisa de satisfação do WhatsApp para quem dá nota 5!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <label className="flex items-start gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={googleForm.auto_reply_5_star}
                    onChange={(e) => setGoogleForm({ ...googleForm, auto_reply_5_star: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-blue-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Respostas Automáticas com IA para Notas 4 e 5
                    </span>
                    <span className="text-[11px] text-slate-400">
                      A IA responde elogios em minutos com mensagens calorosas, agradecendo e citando o nome do cliente.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={googleForm.alert_owner_low_rating}
                    onChange={(e) =>
                      setGoogleForm({ ...googleForm, alert_owner_low_rating: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Alerta no WhatsApp do Dono para Notas Baixas
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Dispara notificação imediata se alguém der nota 1, 2 ou 3 para intervir rapidamente.
                    </span>
                  </div>
                </label>
              </div>

              {/* Teste da IA do Google */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Simular Resposta Humanizada com IA
                  </span>
                  <button
                    type="button"
                    onClick={handleTestGoogleReply}
                    disabled={testingGoogleAi}
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-semibold text-[11px] rounded-lg transition flex items-center gap-1.5"
                  >
                    {testingGoogleAi ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Gerar Resposta Exemplo
                  </button>
                </div>

                {sampleAiReply && (
                  <div className="p-3 bg-slate-900 border border-blue-500/30 rounded-xl text-xs text-blue-100 font-medium leading-relaxed">
                    "{sampleAiReply}"
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveGoogle}
                  disabled={savingSettings}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
                >
                  {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar Configurações do Google
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outros Sistemas: Fallback genérico */}
      {selectedSystem !== 'saipos' && selectedSystem !== 'ifood' && selectedSystem !== 'google_business' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-7 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-300">
            <Database className="w-7 h-7 text-emerald-400" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-white">
              {systems.find((s) => s.id === selectedSystem)?.name}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              O conector nativo para este sistema já está em estágio avançado de homologação. Enquanto isso, você já pode utilizar a Saipos ou integrar via Webhook / API REST do ERBots.
            </p>
          </div>
          <button
            onClick={() => setSelectedSystem('saipos')}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition inline-flex items-center gap-2"
          >
            <span>Voltar para Saipos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
