'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import WhatsAppConnector from '@/components/WhatsAppConnector';
import BotSettingsForm from '@/components/BotSettingsForm';
import KnowledgeBaseManager from '@/components/KnowledgeBaseManager';
import LiveChat from '@/components/LiveChat';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<string>('whatsapp');
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    async function initTenant() {
      setLoading(true);
      try {
        // 1. Tenta pegar o usuário autenticado
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        let targetTenant: any = null;

        if (user) {
          // Busca tenant do usuário logado
          const { data: userTenant } = await supabase
            .from('xerb_tenants')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (userTenant) targetTenant = userTenant;
        }

        // 2. Se não achou pelo user_id, verifica se tem tenant ativo no localStorage
        if (!targetTenant) {
          const cachedTenantId = typeof window !== 'undefined' ? localStorage.getItem('erbots_active_tenant_id') : null;
          if (cachedTenantId) {
            const { data: cachedTenant } = await supabase
              .from('xerb_tenants')
              .select('*')
              .eq('id', cachedTenantId)
              .maybeSingle();

            if (cachedTenant) targetTenant = cachedTenant;
          }
        }

        // 3. Fallback: Se ainda não tiver nenhum selecionado, busca o tenant mais recente
        if (!targetTenant) {
          const { data: recentTenants } = await supabase
            .from('xerb_tenants')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

          if (recentTenants && recentTenants.length > 0) {
            targetTenant = recentTenants[0];
          }
        }

        if (targetTenant) {
          setTenant(targetTenant);
          if (typeof window !== 'undefined') {
            localStorage.setItem('erbots_active_tenant_id', targetTenant.id);
          }
        } else {
          // Se não há nenhum tenant cadastrado na base, redireciona para criar conta
          router.push('/cadastro');
          return;
        }
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        tenantName={tenant?.name}
        isConnected={isConnected}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <SubscriptionPlans
            currentPlan={tenant?.plan}
            trialEndsAt={tenant?.trial_ends_at}
          />
        )}
      </main>
    </div>
  );
}
