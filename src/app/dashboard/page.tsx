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
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/api-client';
import { getAccessState } from '@/lib/plans';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<string>('whatsapp');
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
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
    !!tenant && !isSuperAdmin && (!access.allowed || tenant.subscription_status === 'past_due' || (tenant.subscription_status === 'trialing' && access.daysLeft <= 2));

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

        {currentTab === 'whatsapp' && (
          <WhatsAppConnector
            tenantId={tenantId}
            tenantSlug={tenantSlug}
            onStatusChange={setIsConnected}
          />
        )}

        {currentTab === 'chat' && <LiveChat tenantId={tenantId} />}

        {currentTab === 'bot-settings' && <BotSettingsForm tenantId={tenantId} />}

        {currentTab === 'knowledge' && <KnowledgeBaseManager tenantId={tenantId} />}

        {currentTab === 'plans' && (
          <SubscriptionPlans tenant={tenant} onTenantUpdated={setTenant} />
        )}

        {currentTab === 'profile' && (
          <UserProfileManager
            tenant={tenant}
            onTenantUpdated={setTenant}
            onNavigateToPlans={() => setCurrentTab('plans')}
          />
        )}
      </main>
    </div>
  );
}
