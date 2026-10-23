'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import WhatsAppConnector from '@/components/WhatsAppConnector';
import BotSettingsForm from '@/components/BotSettingsForm';
import KnowledgeBaseManager from '@/components/KnowledgeBaseManager';
import LiveChat from '@/components/LiveChat';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [currentTab, setCurrentTab] = useState<string>('whatsapp');
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    async function initTenant() {
      setLoading(true);
      try {
        // Tenta buscar tenant existente nas tabelas xerb_
        const { data: existingTenants, error: fetchErr } = await supabase
          .from('xerb_tenants')
          .select('*')
          .limit(1);

        if (existingTenants && existingTenants.length > 0) {
          setTenant(existingTenants[0]);
        } else {
          // Se ainda não houver nenhum tenant (primeira execução), cria o primeiro tenant demo/administrador
          const { data: newTenant, error: createErr } = await supabase
            .from('xerb_tenants')
            .insert({
              name: 'Minha Empresa Demo',
              slug: 'empresa-demo',
              segment: 'Comércio / Serviços',
              plan: 'trial',
              subscription_status: 'trialing',
            })
            .select()
            .single();

          if (newTenant) {
            setTenant(newTenant);
            // Cria configurações padrão do robô para este tenant
            await supabase.from('xerb_bot_settings').insert({
              tenant_id: newTenant.id,
              bot_name: 'Sofia da Empresa Demo',
              tone: 'friendly',
              system_prompt: 'Seja atencioso, tire dúvidas e auxilie com simpatia.',
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao inicializar tenant:', err);
        // Fallback local para permitir testes na interface mesmo sem o banco migrado
        setTenant({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Empresa Demonstração',
          slug: 'demo',
          plan: 'trial',
        });
      } finally {
        setLoading(false);
      }
    }

    initTenant();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm">Carregando painel do ERBots...</span>
      </div>
    );
  }

  const tenantId = tenant?.id || '00000000-0000-0000-0000-000000000001';
  const tenantSlug = tenant?.slug || 'demo';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        tenantName={tenant?.name}
        isConnected={isConnected}
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
