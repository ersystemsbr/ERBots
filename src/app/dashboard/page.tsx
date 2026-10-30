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
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/api-client';
import { getAccessState } from '@/lib/plans';
import { Loader2, WifiOff } from 'lucide-react';

interface InstanceSnapshot {
  status: string;
  last_connected_at?: string | null;
  intentional_logout?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<string>('whatsapp');
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [unexpectedDisconnect, setUnexpectedDisconnect] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

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
        {unexpectedDisconnect && currentTab !== 'whatsapp' && (
          <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-rose-200">
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-5 h-5 text-rose-400 shrink-0" />
              <span>
                <strong>Seu WhatsApp desconectou!</strong> O atendimento automático está pausado até reconectar o aparelho.
              </span>
            </div>
            <button
              onClick={() => setCurrentTab('whatsapp')}
              className="shrink-0 px-4 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs rounded-lg transition"
            >
              Reconectar WhatsApp
            </button>
          </div>
        )}

        {showBanner && currentTab !== 'plans' && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm ${
              !access.allowed
                ? 'bg-red-500/10 border-red-500/30 text-red-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            }`}
          >
            <span>{access.message}</span>
            <button
              onClick={() => setCurrentTab('plans')}
              className="shrink-0 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition"
            >
              {!access.allowed ? 'Reativar agora' : 'Ver planos'}
            </button>
          </div>
        )}

        {tenantId && (
          <OnboardingChecklist
            tenantId={tenantId}
            isConnected={isConnected}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'whatsapp' && (
          <WhatsAppConnector
            tenantId={tenantId}
            tenantSlug={tenantSlug}
            onStatusChange={(connected) => {
              setIsConnected(connected);
              if (connected) setUnexpectedDisconnect(false);
            }}
          />
        )}

        {currentTab === 'chat' && <LiveChat tenantId={tenantId} />}

        {currentTab === 'analytics' && (
          <AnalyticsDashboard tenantId={tenantId} onNavigateTab={setCurrentTab} />
        )}

        {currentTab === 'bot-settings' && <BotSettingsForm tenantId={tenantId} />}

        {currentTab === 'knowledge' && (
          <KnowledgeBaseManager tenantId={tenantId} tenantSegment={tenant?.segment} />
        )}

        {currentTab === 'plans' && (
          <SubscriptionPlans tenant={tenant} onTenantUpdated={setTenant} />
        )}

        {currentTab === 'profile' && (
          <UserProfileManager
            tenant={tenant}
            onTenantUpdated={setTenant}
            onNavigateToPlans={() => setCurrentTab('plans')}
            isSuperAdmin={isSuperAdmin}
          />
        )}
      </main>
    </div>
  );
}
