'use client';

import { authFetch } from '@/lib/api-client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  DollarSign,
  Smartphone,
  MessageSquare,
  Users,
  Activity,
  Server,
  RefreshCw,
  LogOut,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  Bot,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isDefaultAdmin } from '@/lib/admin';
import AdminTenantsTable from '@/components/admin/AdminTenantsTable';
import AdminPaymentsManager from '@/components/admin/AdminPaymentsManager';

interface Metrics {
  mrr: number;
  totalTenants: number;
  activeSubscribers: number;
  trialTenants: number;
  connectedInstances: number;
  totalInstances: number;
  totalMessages: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'tenants' | 'payments' | 'system'>('tenants');

  // Dados globais do admin
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [tenantForPayment, setTenantForPayment] = useState<any | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState<string | null>(null);

  // 1. Verificação de autenticação e Super Admin
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (!user || !user.email) {
          router.push('/login');
          return;
        }

        setCurrentUser(user);
        const authorized = isDefaultAdmin(user.email);
        setIsAdmin(authorized);

        if (!authorized) {
          setLoading(false);
          return;
        }

        // Se for admin, carrega dados iniciais
        await loadDashboardData(user.email);
      } catch (err) {
        console.error('Erro na autenticação do admin:', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  // Carrega métricas e lista de clientes
  const loadDashboardData = async (userEmail: string) => {
    setLoadingMetrics(true);
    try {
      const [metricsRes, tenantsRes] = await Promise.all([
        authFetch('/api/admin/metrics'),
        authFetch('/api/admin/tenants'),
      ]);

      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData.metrics);
      }

      if (tenantsRes.ok) {
        const tData = await tenantsRes.json();
        setTenants(tData.tenants || []);
      }
    } catch (e) {
      console.error('Erro ao carregar métricas:', e);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const loadHealth = async () => {
    try {
      const res = await authFetch('/api/admin/health');
      if (res.ok) setHealth(await res.json());
    } catch (e) {
      console.error('Erro ao carregar diagnóstico:', e);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'system') {
      loadHealth();
    }
  }, [isAdmin, activeTab]);

  const handleResyncWebhooks = async () => {
    setResyncing(true);
    setResyncMsg(null);
    try {
      const res = await authFetch('/api/admin/webhooks', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao ressincronizar.');
      setResyncMsg(
        `${data.success}/${data.total} instâncias atualizadas${data.tokenProtected ? ' (com token)' : ' (SEM token: defina WEBHOOK_SECRET)'}` +
          (data.failed?.length ? ` — falhas: ${data.failed.join(', ')}` : '')
      );
    } catch (e: any) {
      setResyncMsg(`Erro: ${e?.message}`);
    } finally {
      setResyncing(false);
    }
  };

  const handleRefresh = () => {
    if (currentUser?.email) {
      loadDashboardData(currentUser.email);
    }
  };

  const handleOpenPaymentForTenant = (tenant: any) => {
    setTenantForPayment(tenant);
    setActiveTab('payments');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    router.push('/login');
  };

  const copySqlToClipboard = () => {
    const sqlText = `-- Script de Criação do Módulo Super Admin & Pagamentos
ALTER TABLE public.xerb_tenants ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;
UPDATE public.xerb_tenants SET is_super_admin = true WHERE email IN ('er.systems.br@gmail.com', 'seozefood@gmail.com');

INSERT INTO public.xerb_system_config (key, value, description)
VALUES ('super_admin_emails', 'er.systems.br@gmail.com,seozefood@gmail.com', 'Super Admins')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

CREATE TABLE IF NOT EXISTS public.xerb_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('trial', 'start', 'pro', 'business', 'custom')),
    payment_method TEXT DEFAULT 'pix' CHECK (payment_method IN ('pix', 'credit_card', 'boleto', 'manual', 'transfer')),
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
    paid_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);`;
    navigator.clipboard.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Verificando credenciais de Super Admin...</span>
      </div>
    );
  }

  // Se não for Super Admin autorizado
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-6 shadow-2xl shadow-rose-500/20">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Acesso Restrito ao Painel Master</h1>
        <p className="text-slate-400 max-w-md text-sm mb-6">
          A conta logada ({currentUser?.email}) não possui privilégios de Super Administrador da plataforma ERBots.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm font-medium transition"
          >
            Voltar ao Meu Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-sm font-medium transition"
          >
            Trocar de Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header do Super Admin */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-slate-900/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo com insígnia Super Admin */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <ShieldCheck className="w-5 h-5 text-slate-950 font-bold" />
                </div>
                <span className="text-lg font-bold tracking-tight text-white">
                  ER<span className="text-emerald-400">Bots</span>
                </span>
              </Link>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                👑 Super Admin Master
              </span>
            </div>

            {/* Ações da Direita */}
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-xs text-slate-400 font-mono">
                {currentUser?.email}
              </span>

              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
              >
                <span>Dashboard Cliente</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Bloco de Boas-Vindas & Ações */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Gestão Central de Clientes & Faturamento
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Monitore todas as empresas cadastradas, instâncias WhatsApp ativas e receba pagamentos do SaaS.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loadingMetrics}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin text-emerald-400' : ''}`} />
            Atualizar Dados
          </button>
        </div>

        {/* Grade de KPIs / Métricas do SaaS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* MRR Estimado */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              MRR Projetado
            </span>
            <div className="mt-2 text-xl font-bold text-emerald-400">
              R${' '}
              {(metrics?.mrr || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <span className="text-[10px] text-slate-500">Planos ativos / mês</span>
          </div>

          {/* Total Clientes */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Total Empresas
            </span>
            <div className="mt-2 text-xl font-bold text-white">
              {metrics?.totalTenants || 0}
            </div>
            <span className="text-[10px] text-slate-500">Tenants cadastrados</span>
          </div>

          {/* Assinantes Ativos */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Assinantes
            </span>
            <div className="mt-2 text-xl font-bold text-blue-400">
              {metrics?.activeSubscribers || 0}
            </div>
            <span className="text-[10px] text-slate-500">Contratos pagos</span>
          </div>

          {/* Em Período de Teste */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Em Trial (Teste)
            </span>
            <div className="mt-2 text-xl font-bold text-amber-400">
              {metrics?.trialTenants || 0}
            </div>
            <span className="text-[10px] text-slate-500">Potenciais assinantes</span>
          </div>

          {/* WhatsApps Conectados */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              WhatsApps Online
            </span>
            <div className="mt-2 text-xl font-bold text-emerald-400">
              {metrics?.connectedInstances || 0} / {metrics?.totalInstances || 0}
            </div>
            <span className="text-[10px] text-slate-500">Instâncias ativas</span>
          </div>

          {/* Mensagens IA */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Mensagens IA
            </span>
            <div className="mt-2 text-xl font-bold text-purple-400">
              {metrics?.totalMessages || 0}
            </div>
            <span className="text-[10px] text-slate-500">Histórico de conversas</span>
          </div>
        </div>

        {/* Navegação por Abas */}
        <div className="flex border-b border-slate-800 space-x-8">
          <button
            onClick={() => setActiveTab('tenants')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'tenants'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Clientes & Assinaturas ({tenants.length})
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'payments'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Pagamentos & Faturamento
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'system'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Sistema & Infraestrutura
          </button>
        </div>

        {/* Conteúdo da Aba 1: Clientes & Assinaturas */}
        {activeTab === 'tenants' && (
          <AdminTenantsTable
            tenants={tenants}
            userEmail={currentUser?.email || ''}
            onRefresh={handleRefresh}
            onOpenPaymentModal={handleOpenPaymentForTenant}
          />
        )}

        {/* Conteúdo da Aba 2: Pagamentos & Faturamento */}
        {activeTab === 'payments' && (
          <AdminPaymentsManager
            userEmail={currentUser?.email || ''}
            tenants={tenants}
            initialTenantForPayment={tenantForPayment}
            onPaymentSuccess={handleRefresh}
          />
        )}

        {/* Conteúdo da Aba 3: Sistema & Infraestrutura */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            {/* Diagnóstico de Segurança & Configuração */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Diagnóstico de Segurança &amp; Configuração</h3>
                    <p className="text-xs text-slate-400">Pré-requisitos de produção (nenhum segredo é exibido)</p>
                  </div>
                </div>
                <button
                  onClick={loadHealth}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reverificar
                </button>
              </div>

              {!health ? (
                <p className="text-xs text-slate-400">Verificando…</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {[
                    {
                      ok: health.serviceRoleKey?.configured && health.serviceRoleKey?.validRole,
                      label: 'SUPABASE_SERVICE_ROLE_KEY configurada (role service_role)',
                      fix: 'Defina na Vercel (Settings > Environment Variables) e faça redeploy. Obrigatório ANTES de rodar o SQL de hardening.',
                    },
                    {
                      ok: health.webhookSecretConfigured,
                      label: 'WEBHOOK_SECRET configurado (webhook protegido)',
                      fix: 'Defina WEBHOOK_SECRET na Vercel (string aleatória longa), faça redeploy e clique em "Ressincronizar webhooks".',
                    },
                    {
                      ok: health.evolutionConfigured && !health.evolutionUrlIsTemporaryTunnel,
                      label: 'Evolution API com URL estável (não é túnel temporário trycloudflare)',
                      fix: 'A URL atual é um túnel temporário ou não está configurada. Migre para domínio fixo.',
                    },
                    {
                      ok: health.geminiConfigured,
                      label: 'Chave do Gemini encontrada',
                      fix: 'Configure GEMINI_API_KEY na Vercel.',
                    },
                    {
                      ok: health.asaasConfigured,
                      label: `Cobrança Asaas configurada (ASAAS_API_KEY)${health.asaasSandbox ? ' — modo SANDBOX' : ''}`,
                      fix: 'Defina ASAAS_API_KEY (e ASAAS_ENV=sandbox para testes) na Vercel. Sem isso o checkout de planos fica indisponível.',
                    },
                    {
                      ok: health.asaasWebhookTokenConfigured,
                      label: 'ASAAS_WEBHOOK_TOKEN configurado (webhook de pagamentos)',
                      fix: 'Defina ASAAS_WEBHOOK_TOKEN na Vercel e cadastre o mesmo token no webhook do Asaas apontando para /api/webhook/asaas.',
                    },                    {
                      ok: health.appUrlConfigured,
                      label: 'NEXT_PUBLIC_APP_URL configurada',
                      fix: 'Defina a URL pública do app na Vercel.',
                    },
                  ].map((item, idx) => (
                    <li
                      key={idx}
                      className={`p-3 rounded-xl border ${
                        item.ok
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                      }`}
                    >
                      <div className="font-semibold">
                        {item.ok ? '✅' : '❌'} {item.label}
                      </div>
                      {!item.ok && <div className="mt-1 text-slate-400">{item.fix}</div>}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleResyncWebhooks}
                  disabled={resyncing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? 'animate-spin' : ''}`} />
                  Ressincronizar webhooks de todas as instâncias
                </button>
                {resyncMsg && <span className="text-xs text-slate-300">{resyncMsg}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Webhook & Evolution API */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Evolution API & Webhook Global</h3>
                    <p className="text-xs text-slate-400">Gateway de conexão WhatsApp</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Webhook URL Ativo:</label>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 break-all select-all">
                      https://erbots.vercel.app/api/webhook/whatsapp
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Servidor Evolution API:</label>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 break-all select-all">
                      https://evolution.erbots.com.br
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Todas as instâncias criadas apontam automaticamente para o webhook de produção da Vercel.
                  </p>
                </div>
              </div>

              {/* Card Inteligência Artificial & Fallback */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Cascata de Modelos Gemini IA</h3>
                    <p className="text-xs text-slate-400">Tolerância a falha e rotação automática de cota</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-300 font-mono">1. gemini-2.5-flash</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                      Principal (Default)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-300 font-mono">2. gemini-2.0-flash</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-semibold">
                      Fallback 1
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-300 font-mono">3. gemini-2.0-flash-lite</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-semibold">
                      Fallback 2
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-300 font-mono">4. gemini-1.5-flash</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-semibold">
                      Fallback 3
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Script SQL Supabase */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Instalação SQL no Supabase</h3>
                    <p className="text-xs text-slate-400">
                      Script para criar tabela de pagamentos (`xerb_payments`) e permissões de Super Admin
                    </p>
                  </div>
                </div>

                <button
                  onClick={copySqlToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
{`-- 1. Coluna is_super_admin na tabela xerb_tenants
ALTER TABLE public.xerb_tenants ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;
UPDATE public.xerb_tenants SET is_super_admin = true WHERE email IN ('er.systems.br@gmail.com', 'seozefood@gmail.com');

-- 2. Lista de Super Admins
INSERT INTO public.xerb_system_config (key, value, description)
VALUES ('super_admin_emails', 'er.systems.br@gmail.com,seozefood@gmail.com', 'Super Admins')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 3. Tabela xerb_payments
CREATE TABLE IF NOT EXISTS public.xerb_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.xerb_tenants(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('trial', 'start', 'pro', 'business', 'custom')),
    payment_method TEXT DEFAULT 'pix' CHECK (payment_method IN ('pix', 'credit_card', 'boleto', 'manual', 'transfer')),
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
    paid_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
