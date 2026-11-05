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
  const [selectedSystem, setSelectedSystem] = useState<string>('saipos');

  // Formulário Saipos
  const [saiposForm, setSaiposForm] = useState({
    token: '',
    store_id: '',
    environment: 'production' as 'production' | 'sandbox',
    is_active: false,
    auto_inject_orders: true,
    notify_customer_whatsapp: true,
    default_payment: 'PIX' as 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH',
  });

  // Estados de ação
  const [testingConnection, setTestingConnection] = useState(false);
  const [simulatingOrder, setSimulatingOrder] = useState(false);
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

        const saiposSys = (data.systems || []).find((s: any) => s.id === 'saipos');
        if (saiposSys?.config) {
          const cfg = saiposSys.config;
          setSaiposForm({
            token: cfg.credentials?.token || '',
            store_id: cfg.credentials?.store_id || '',
            environment: cfg.environment || 'production',
            is_active: Boolean(cfg.is_active),
            auto_inject_orders: cfg.settings?.auto_inject_orders !== false,
            notify_customer_whatsapp: cfg.settings?.notify_customer_whatsapp !== false,
            default_payment: cfg.settings?.default_payment || 'PIX',
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
            token: saiposForm.token,
            store_id: saiposForm.store_id,
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
    if (!saiposForm.token.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe o Token da Saipos antes de testar.' });
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
            token: saiposForm.token,
            store_id: saiposForm.store_id,
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
          text: data.message || data.error || 'Não foi possível validar o token da Saipos.',
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
            token: saiposForm.token,
            store_id: saiposForm.store_id,
          },
          environment: saiposForm.environment,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Pedido #${data.displayId || '1042'} injetado com sucesso no fluxo da Saipos!`,
        });
        await loadData();
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.message || data.error || 'Erro ao simular envio de pedido.',
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao conectar para envio do pedido simulado.' });
    } finally {
      setSimulatingOrder(false);
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
                      API v1 Integrador
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

            {/* Credenciais e Conexão */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Credenciais de Acesso à Saipos
                </h4>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                    Token de Integração da Saipos <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={saiposForm.token}
                    onChange={(e) => setSaiposForm((prev) => ({ ...prev, token: e.target.value }))}
                    placeholder="Cole seu token gerado no painel da Saipos (ex: eyJhbGciOi...)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    No painel da Saipos, acesse: <strong className="text-slate-400">Configurações → Integrações → ERBots / Open Delivery</strong> para gerar o token.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5 font-medium">ID da Loja / Filial</label>
                    <input
                      type="text"
                      value={saiposForm.store_id}
                      onChange={(e) => setSaiposForm((prev) => ({ ...prev, store_id: e.target.value }))}
                      placeholder="Ex: 1042"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                    />
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
                      <option value="production">Produção (api.saipos.com)</option>
                      <option value="sandbox">Sandbox / Testes</option>
                    </select>
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

            {/* URL do Webhook da Saipos */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  URL de Notificações / Webhook (Cole na Saipos)
                </span>
                <span className="text-[11px] text-slate-400">
                  Recebe eventos em tempo real: <code className="text-emerald-400">CONFIRMED</code>, <code className="text-emerald-400">DISPATCHED</code>, <code className="text-emerald-400">DELIVERED</code>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition shrink-0 flex items-center gap-1.5"
                >
                  {copiedKey === 'webhook' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
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

      {/* Outros Sistemas: GastroSys, iFood, Anota AI */}
      {selectedSystem !== 'saipos' && (
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
