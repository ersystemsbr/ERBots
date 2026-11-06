'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import WhatsAppConnector from '@/components/WhatsAppConnector';
import BotSettingsForm from '@/components/BotSettingsForm';
import KnowledgeBaseManager from '@/components/KnowledgeBaseManager';
import LiveChat from '@/components/LiveChat';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import UserProfileManager from '@/components/UserProfileManager';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import ErSystemsAppsDashboard from '@/components/ErSystemsAppsDashboard';
import InstagramAgentManager, { InstagramIcon } from '@/components/InstagramAgentManager';
import IntegrationsManager from '@/components/IntegrationsManager';
import ReengagementManager from '@/components/ReengagementManager';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/api-client';
import { getAccessState } from '@/lib/plans';
import { Loader2, WifiOff, Bot, Sparkles, BookOpen, ShieldCheck, Building2, Layers, Flame } from 'lucide-react';

interface InstanceSnapshot {
  status: string;
  last_connected_at?: string | null;
  intentional_logout?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<string>('chat');
  const [settingsSubTab, setSettingsSubTab] = useState<string>('whatsapp');
  const [waActiveCard, setWaActiveCard] = useState<'connection' | 'bot' | 'knowledge'>('connection');
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [unexpectedDisconnect, setUnexpectedDisconnect] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

  const settingsTabs = [
    { id: 'whatsapp', label: 'Configurações WhatsApp', icon: Bot },
    { id: 'instagram', label: 'Configurações Instagram', icon: InstagramIcon },
    { id: 'reengagement', label: 'Vendas Ativas & NPS', icon: Flame },
    { id: 'integrations', label: 'Integrações (PDV/ERP)', icon: Layers },
    { id: 'plans', label: 'Planos & Assinaturas', icon: ShieldCheck },
    { id: 'profile', label: 'Dados da Empresa', icon: Building2 },
  ];

  const handleNavigate = (tab: string) => {
    if (tab === 'instagram') {
      setCurrentTab('instagram');
    } else if (tab === 'whatsapp' || tab === 'connection') {
      setCurrentTab('settings');
      setSettingsSubTab('whatsapp');
      setWaActiveCard('connection');
    } else if (tab === 'bot-settings') {
      setCurrentTab('settings');
      setSettingsSubTab('whatsapp');
      setWaActiveCard('bot');
    } else if (tab === 'knowledge') {
      setCurrentTab('settings');
      setSettingsSubTab('whatsapp');
      setWaActiveCard('knowledge');
    } else if (['reengagement', 'integrations', 'plans', 'profile'].includes(tab)) {
      setCurrentTab('settings');
      setSettingsSubTab(tab);
    } else {
      setCurrentTab(tab);
    }
  };

  const applyInstanceSnapshot = (inst?: InstanceSnapshot | null) => {
    if (!inst) {
      setIsConnected(false);
      setUnexpectedDisconnect(false);
      return;
    }
    const connected = inst.status === 'CONNECTED';
    setIsConnected(connected);
    setUnexpectedDisconnect(
      !connected &&
        inst.status === 'DISCONNECTED' &&
        Boolean(inst.last_connected_at) &&
        !inst.intentional_logout
    );
  };

  useEffect(() => {
    async function initTenant() {
      setLoading(true);
      try {
        // 1. Exige sessão autenticada
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          router.push('/login');
          return;
        }

        // 2. O servidor localiza/vincula/cria o tenant do usuário (o navegador não decide plano/posse)
        const res = await authFetch('/api/tenant/bootstrap', { method: 'POST' });
        if (res.status === 401) {
          router.push('/login');
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.tenant) {
          console.warn('Erro ao carregar conta:', data?.error);
          router.push('/login');
          return;
        }

        setIsSuperAdmin(Boolean(data.isSuperAdmin));
        setTenant(data.tenant);
      } catch (err) {
        console.warn('Erro ao inicializar tenant no dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    initTenant();
  }, [router]);

  // Monitora em tempo real o estado da instância WhatsApp do tenant (para badge na barra e alerta de queda)
  useEffect(() => {
    const tid = tenant?.id;
    if (!tid) return;

    let active = true;
    (async () => {
      try {
        const res = await authFetch(`/api/whatsapp/instance?tenant_id=${encodeURIComponent(tid)}`);
        if (res.ok && active) {
          const d = await res.json();
          applyInstanceSnapshot(d.instance);
        }
      } catch {
        // Silencioso
      }
    })();

    const channel = supabase
      .channel(`dashboard-instance-${tid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'xerb_instances',
          filter: `tenant_id=eq.${tid}`,
        },
        (payload) => {
          const next = (payload.new || null) as InstanceSnapshot | null;
          if (next) applyInstanceSnapshot(next);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('erbots_active_tenant_id');
    }
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm">Carregando painel do ERBots...</span>
      </div>
    );
  }

  const tenantId = tenant?.id;
  const tenantSlug = tenant?.slug || 'empresa';
  const access = getAccessState(tenant || {});
  const showBanner =
    !!tenant &&
    !isSuperAdmin &&
    (!access.allowed ||
      tenant.subscription_status === 'past_due' ||
      (tenant.subscription_status === 'trialing' && access.daysLeft <= 2));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        tenantName={tenant?.name}
        isConnected={isConnected}
        onLogout={handleLogout}
        isSuperAdmin={isSuperAdmin}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {unexpectedDisconnect && !(currentTab === 'settings' && settingsSubTab === 'whatsapp') && (
          <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-rose-200">
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-5 h-5 text-rose-400 shrink-0" />
              <span>
                <strong>Seu WhatsApp desconectou!</strong> O atendimento automático está pausado até reconectar o aparelho.
              </span>
            </div>
            <button
              onClick={() => handleNavigate('whatsapp')}
              className="shrink-0 px-4 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs rounded-lg transition"
            >
              Reconectar WhatsApp
            </button>
          </div>
        )}

        {showBanner && !(currentTab === 'settings' && settingsSubTab === 'plans') && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm ${
              !access.allowed
                ? 'bg-red-500/10 border-red-500/30 text-red-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            }`}
          >
            <span>{access.message}</span>
            <button
              onClick={() => handleNavigate('plans')}
              className="shrink-0 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition"
            >
              {!access.allowed ? 'Reativar agora' : 'Ver planos'}
            </button>
          </div>
        )}

        {/* ABA: Live Chat */}
        {currentTab === 'chat' && <LiveChat tenantId={tenantId} />}

        {/* ABA: Resultados / Métricas */}
        {currentTab === 'analytics' && (
          <AnalyticsDashboard tenantId={tenantId} onNavigateTab={handleNavigate} />
        )}

        {/* ABA: Agente Instagram */}
        {currentTab === 'instagram' && (
          <InstagramAgentManager />
        )}

        {/* ABA: Apps ER Systems (Ecossistema de Soluções) */}
        {currentTab === 'apps' && <ErSystemsAppsDashboard />}

        {/* ABA: Configurações */}
        {currentTab === 'settings' && (
          <div className="space-y-6">
            {/* Navegação por Sub-Abas no mesmo formato das abas do Painel Master */}
            <div className="flex border-b border-slate-800 space-x-6 sm:space-x-8 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = settingsSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsSubTab(tab.id)}
                    className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'border-emerald-400 text-emerald-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Conteúdo da Sub-Aba de Configurações ativa */}
            <div>
              {/* SUB-ABA: Configurações WhatsApp (Hub em formato de 3 Cards) */}
              {settingsSubTab === 'whatsapp' && (
                <div className="space-y-6">
                  {/* 3 Cards de Seleção WhatsApp */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Card 1: Conexão WhatsApp */}
                    <button
                      type="button"
                      onClick={() => setWaActiveCard('connection')}
                      className={`p-5 rounded-2xl border text-left transition shadow-md flex flex-col justify-between relative overflow-hidden ${
                        waActiveCard === 'connection'
                          ? 'bg-slate-900 border-emerald-500/60 ring-2 ring-emerald-500/20'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            waActiveCard === 'connection'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Bot className="w-5 h-5" />
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isConnected
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isConnected ? '● Conectado' : '○ Desconectado'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Conexão WhatsApp</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          QR Code, status do pareamento e número ativo
                        </p>
                      </div>
                    </button>

                    {/* Card 2: Personalizar IA */}
                    <button
                      type="button"
                      onClick={() => setWaActiveCard('bot')}
                      className={`p-5 rounded-2xl border text-left transition shadow-md flex flex-col justify-between relative overflow-hidden ${
                        waActiveCard === 'bot'
                          ? 'bg-slate-900 border-emerald-500/60 ring-2 ring-emerald-500/20'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            waActiveCard === 'bot'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          Atendente Virtual
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Personalizar IA</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Tom de voz, instruções, nome e prompt do atendente
                        </p>
                      </div>
                    </button>

                    {/* Card 3: Base de Conhecimento */}
                    <button
                      type="button"
                      onClick={() => setWaActiveCard('knowledge')}
                      className={`p-5 rounded-2xl border text-left transition shadow-md flex flex-col justify-between relative overflow-hidden ${
                        waActiveCard === 'knowledge'
                          ? 'bg-slate-900 border-emerald-500/60 ring-2 ring-emerald-500/20'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            waActiveCard === 'knowledge'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          Respostas Prontas
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Base de Conhecimento</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Cardápio, FAQs, horários, preços e políticas
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Conteúdo do Card Ativo */}
                  <div className="pt-2">
                    {waActiveCard === 'connection' && (
                      <WhatsAppConnector
                        tenantId={tenantId}
                        tenantSlug={tenantSlug}
                        onStatusChange={(connected) => {
                          setIsConnected(connected);
                          if (connected) setUnexpectedDisconnect(false);
                        }}
                      />
                    )}

                    {waActiveCard === 'bot' && (
                      <BotSettingsForm tenantId={tenantId} />
                    )}

                    {waActiveCard === 'knowledge' && (
                      <KnowledgeBaseManager tenantId={tenantId} tenantSegment={tenant?.segment} />
                    )}
                  </div>
                </div>
              )}

              {/* SUB-ABA: Configurações Instagram (Cards de Voz da Marca & Meta Graph API) */}
              {settingsSubTab === 'instagram' && (
                <InstagramAgentManager onlySettings={true} />
              )}

              {/* SUB-ABA: Vendas Ativas & NPS */}
              {settingsSubTab === 'reengagement' && (
                <ReengagementManager tenantId={tenantId} />
              )}

              {/* SUB-ABA: Integrações */}
              {settingsSubTab === 'integrations' && (
                <IntegrationsManager tenantId={tenantId} isSuperAdmin={isSuperAdmin} />
              )}

              {/* SUB-ABA: Planos & Assinaturas */}
              {settingsSubTab === 'plans' && (
                <SubscriptionPlans tenant={tenant} onTenantUpdated={setTenant} />
              )}

              {/* SUB-ABA: Dados da Empresa */}
              {settingsSubTab === 'profile' && (
                <UserProfileManager
                  tenant={tenant}
                  onTenantUpdated={setTenant}
                  onNavigateToPlans={() => setSettingsSubTab('plans')}
                  isSuperAdmin={isSuperAdmin}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
