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
import { isDefaultAdmin } from '@/lib/admin';
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
        // 1. Tenta pegar o usuário autenticado
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        let targetTenant: any = null;

        if (user) {
          const userEmail = user.email?.toLowerCase().trim() || '';
          setIsSuperAdmin(isDefaultAdmin(userEmail));

          // Busca tenant do usuário logado (por user_id ou e-mail cadastrado)
          const { data: userTenant } = await supabase
            .from('xerb_tenants')
            .select('*')
            .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (userTenant) {
            targetTenant = userTenant;
            // Se o tenant existia sem user_id, vincula agora
            if (!userTenant.user_id || userTenant.user_id !== user.id) {
              await supabase
                .from('xerb_tenants')
                .update({ user_id: user.id, updated_at: new Date().toISOString() })
                .eq('id', userTenant.id);
            }
          } else {
            // Usuário autenticado no Supabase (ex: via GastroSys) acessando ERBots pela 1ª vez: auto-provisiona
            const isSuper = isDefaultAdmin(userEmail);
            const compName = user.user_metadata?.company_name || user.user_metadata?.full_name || (isSuper ? 'ER Systems' : 'Minha Empresa');
            const slug = `${compName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;

            const { data: createdTenant } = await supabase
              .from('xerb_tenants')
              .insert({
                user_id: user.id,
                name: compName,
                slug,
                segment: 'Geral',
                email: userEmail,
                plan: isSuper ? 'business' : 'trial',
                subscription_status: isSuper ? 'active' : 'trialing',
                trial_ends_at: new Date(Date.now() + (isSuper ? 365 : 7) * 24 * 60 * 60 * 1000).toISOString(),
                is_super_admin: isSuper,
              })
              .select()
              .single();

            if (createdTenant) {
              targetTenant = createdTenant;
              // Cria robô padrão
              await supabase.from('xerb_bot_settings').insert({
                tenant_id: createdTenant.id,
                bot_name: `Atendente da ${compName}`,
                tone: 'friendly',
                gemini_model: 'gemini-2.5-flash',
                system_prompt: `Você é o atendente virtual inteligente da empresa ${compName}.`,
                is_active: true,
                human_handoff_enabled: true,
              });
            }
          }
        }

        // 2. Se não autenticado, tenta o localStorage
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

        if (targetTenant) {
          setTenant(targetTenant);
          if (typeof window !== 'undefined') {
            localStorage.setItem('erbots_active_tenant_id', targetTenant.id);
          }
        } else {
          // Se não há usuário logado nem tenant selecionado, vai para login
          router.push('/login');
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
        isSuperAdmin={isSuperAdmin}
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
