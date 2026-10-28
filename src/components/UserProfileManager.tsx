'use client';

import { authFetch } from '@/lib/api-client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Building2,
  Mail,
  Phone,
  Tag,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Zap,
  RefreshCw,
} from 'lucide-react';

interface UserProfileManagerProps {
  tenant: any;
  onTenantUpdated: (updatedTenant: any) => void;
  onNavigateToPlans?: () => void;
}

const SEGMENT_OPTIONS = [
  'Clínicas & Saúde',
  'Imobiliárias & Corretores',
  'Barbearias & Estética',
  'Comércio & Lojas',
  'Escritórios & Serviços',
  'Pet Shop & Veterinária',
  'Restaurante / Bar / Delivery',
  'Educação & Cursos',
  'Automotivo & Frotas',
  'Software / Tecnologia / SaaS',
  'Outro',
];

export default function UserProfileManager({
  tenant,
  onTenantUpdated,
  onNavigateToPlans,
}: UserProfileManagerProps) {
  // Dados da Empresa
  const [name, setName] = useState(tenant?.name || '');
  const [segment, setSegment] = useState(tenant?.segment || 'Clínicas & Saúde');
  const [customSegment, setCustomSegment] = useState('');
  const [phone, setPhone] = useState(tenant?.phone || '');
  const [alertPhone, setAlertPhone] = useState(tenant?.alert_phone || '');
  const [email, setEmail] = useState(tenant?.email || '');
  const [slug, setSlug] = useState(tenant?.slug || '');
  const [cpfCnpj, setCpfCnpj] = useState(tenant?.cpf_cnpj || '');

  // Troca de Senha
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados gerais
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Integrações & Chaves de API
  const [serverUrl, setServerUrl] = useState('https://www.erbots.com.br');
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedServerUrl, setCopiedServerUrl] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);
  const [integrationsMsg, setIntegrationsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (tenant?.id) {
      authFetch(`/api/tenant/integrations?tenant_id=${encodeURIComponent(tenant.id)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            if (data.serverUrl) setServerUrl(data.serverUrl);
            if (data.apiKey) setApiKey(data.apiKey);
            if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
            if (data.webhookSecret) setWebhookSecret(data.webhookSecret);
          }
        })
        .catch((err) => console.warn('Erro ao carregar integrações:', err));
    }
  }, [tenant?.id]);

  const handleCopyApiKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
  };

  const handleCopyServerUrl = () => {
    navigator.clipboard.writeText(serverUrl);
    setCopiedServerUrl(true);
    setTimeout(() => setCopiedServerUrl(false), 2000);
  };

  const handleSaveIntegrations = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntegrations(true);
    setIntegrationsMsg(null);
    try {
      const res = await authFetch('/api/tenant/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          webhook_url: webhookUrl,
          webhook_secret: webhookSecret,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar integrações.');
      setIntegrationsMsg({ type: 'success', text: 'Parâmetros de integração salvos com sucesso!' });
      setTimeout(() => setIntegrationsMsg(null), 4000);
    } catch (err: any) {
      setIntegrationsMsg({ type: 'error', text: err?.message || 'Falha ao salvar integrações.' });
    } finally {
      setSavingIntegrations(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!confirm('Deseja realmente gerar uma nova chave de API? Sistemas externos que utilizam a chave atual deixarão de funcionar até serem atualizados.')) {
      return;
    }
    setRegeneratingKey(true);
    setIntegrationsMsg(null);
    try {
      const res = await authFetch('/api/tenant/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          regenerate_api_key: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao regenerar chave.');
      if (data.apiKey) setApiKey(data.apiKey);
      setIntegrationsMsg({ type: 'success', text: 'Nova chave de API gerada com sucesso!' });
      setTimeout(() => setIntegrationsMsg(null), 4000);
    } catch (err: any) {
      setIntegrationsMsg({ type: 'error', text: err?.message || 'Falha ao regenerar chave.' });
    } finally {
      setRegeneratingKey(false);
    }
  };

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '');
      if (SEGMENT_OPTIONS.includes(tenant.segment)) {
        setSegment(tenant.segment);
        setCustomSegment('');
      } else {
        setSegment('Outro');
        setCustomSegment(tenant.segment || '');
      }
      setPhone(tenant.phone || '');
      setAlertPhone(tenant.alert_phone || '');
      setEmail(tenant.email || '');
      setSlug(tenant.slug || '');
      setCpfCnpj(tenant.cpf_cnpj || '');
    }
  }, [tenant]);

  const handleCopyId = () => {
    if (!tenant?.id) return;
    navigator.clipboard.writeText(tenant.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const finalSegment = segment === 'Outro' && customSegment.trim() ? customSegment.trim() : segment;

      const res = await authFetch('/api/tenant/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenant.id,
          name: name.trim(),
          segment: finalSegment,
          phone: phone.trim(),
          alert_phone: alertPhone.trim(),
          email: email.trim().toLowerCase(),
          cpf_cnpj: cpfCnpj.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar os dados.');
      }

      onTenantUpdated(data.tenant);
      setFeedback({ type: 'success', text: 'Dados da empresa atualizados com sucesso!' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Falha ao salvar alterações.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!newPassword || newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'A nova senha deve ter no mínimo 8 caracteres.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'A confirmação de senha não confere.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err?.message || 'Erro ao atualizar senha.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Vitalício / Sem expiração';
    try {
      return new Date(isoString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const getPlanBadge = (plan?: string) => {
    const p = (plan || 'trial').toLowerCase();
    if (p === 'business') return { label: 'Plano Business', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
    if (p === 'pro') return { label: 'Plano Pro', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    if (p === 'start') return { label: 'Plano Start', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    return { label: 'Período Trial (Teste)', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
  };

  const planInfo = getPlanBadge(tenant?.plan);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Building2 className="w-7 h-7 text-emerald-400" />
          Perfil & Dados da Empresa
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Gerencie as informações cadastrais do seu negócio, contatos comerciais e configurações da conta.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{feedback.text}</span>
        </div>
      )}

      {/* Formulário Principal: Dados da Empresa */}
      <form onSubmit={handleSaveProfile} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Dados Cadastrais
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Essas informações identificam sua empresa e são utilizadas nas mensagens de atendimento do robô.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Nome da Empresa */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nome da Empresa / Estabelecimento *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="Ex: Minha Loja Virtual"
            />
          </div>

          {/* Segmento */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              Segmento de Atuação
            </label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
            >
              {SEGMENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Campo customizado se 'Outro' selecionado */}
          {segment === 'Outro' && (
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Especifique seu Ramo de Atividade:
              </label>
              <input
                type="text"
                value={customSegment}
                onChange={(e) => setCustomSegment(e.target.value)}
                placeholder="Ex: Fabricação de Esquadrias, Estúdio Fotográfico..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          )}

          {/* Telefone / WhatsApp Comercial */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              WhatsApp Comercial (Atendimento)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="Ex: (11) 99999-9999"
            />
          </div>

          {/* WhatsApp Pessoal do Gestor para Alertas */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              WhatsApp Pessoal p/ Alertas (Transbordo e Queda)
            </label>
            <input
              type="text"
              value={alertPhone}
              onChange={(e) => setAlertPhone(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="Seu celular pessoal c/ DDD (Ex: 11988887777)"
            />
          </div>

          {/* E-mail de Contato */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              E-mail de Notificações / Acesso
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="contato@minhaempresa.com.br"
            />
          </div>

          {/* CPF / CNPJ (usado na cobrança) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              CPF ou CNPJ (para emissão da cobrança)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value.replace(/[^\d./-]/g, '').slice(0, 18))}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="Somente números ou com pontuação"
            />
          </div>

          {/* Slug / Identificador (somente leitura para estabilidade) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Identificador Único da Empresa (Slug)</span>
              <span className="text-[10px] text-slate-500">Fixo após criação da conta</span>
            </label>
            <div className="flex rounded-xl overflow-hidden border border-slate-800 bg-slate-900/80 opacity-80">
              <span className="px-3.5 py-2.5 bg-slate-800/70 text-xs text-slate-500 border-r border-slate-800 flex items-center">
                erbots.com.br/
              </span>
              <input
                type="text"
                value={slug}
                readOnly
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-400 cursor-not-allowed focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>

      {/* Cartão de Plano & Status da Conta */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Plano & Licença ERBots
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Detalhes da sua assinatura e data de renovação.
            </p>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-center ${planInfo.color}`}>
            {planInfo.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
            <span className="block text-xs font-medium text-slate-400">Status da Conta:</span>
            <span className="text-sm font-bold text-emerald-400 capitalize mt-1 block">
              {tenant?.subscription_status === 'active'
                ? 'Ativo (Mensalidade em dia)'
                : tenant?.subscription_status === 'trialing'
                ? 'Em Período de Teste Gratuito'
                : 'Atrasado / Pendente'}
            </span>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
            <span className="block text-xs font-medium text-slate-400">Validade do Período:</span>
            <span className="text-sm font-bold text-white mt-1 block">
              {formatDate(tenant?.trial_ends_at)}
            </span>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
            <span className="block text-xs font-medium text-slate-400">Identificador da Conta (ID):</span>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs font-mono text-slate-300 truncate">{tenant?.id}</code>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition"
                title="Copiar ID da Empresa"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {onNavigateToPlans && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onNavigateToPlans}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition"
            >
              <span>Ver Planos e Opções de Pagamento</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Cartão de Integrações Externas & API Key */}
      <form onSubmit={handleSaveIntegrations} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xl">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" />
              Chaves de API & Integrações Externas (CRM / GastroSys)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Conecte seu CRM, sistema de gestão ou automações para disparar mensagens e receber leads do WhatsApp em tempo real.
            </p>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 w-fit">
            API REST v1 Headless
          </span>
        </div>

        {integrationsMsg && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
              integrationsMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {integrationsMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{integrationsMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Server URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              URL do Servidor ERBots (ERBOTS_SERVER_URL)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={serverUrl}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyServerUrl}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition shrink-0"
                title="Copiar URL do Servidor"
              >
                {copiedServerUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Cole esta URL no seu CRM para apontar ao ERBots.</p>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Chave Secreta de API (ERBOTS_API_KEY)
              </label>
              <button
                type="button"
                onClick={handleRegenerateApiKey}
                disabled={regeneratingKey}
                className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3 h-3 ${regeneratingKey ? 'animate-spin' : ''}`} />
                <span>Regenerar chave</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={apiKey || 'Gerando chave...'}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyApiKey}
                disabled={!apiKey}
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shrink-0 shadow-xs"
                title="Copiar Chave de API"
              >
                {copiedApiKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Chave exclusiva da sua empresa. Não compartilhe publicamente.</p>
          </div>
        </div>

        {/* Webhook de Saída */}
        <div className="pt-3 border-t border-slate-800/80">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            URL do Webhook do seu CRM (Disparo Automático de Leads e Mensagens)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://crm61.vercel.app/api/erbots/webhook"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono transition"
              />
            </div>
            <div>
              <input
                type="text"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Segredo opcional (secret)"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono transition"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            O ERBots enviará requisições POST para esta URL assim que mensagens chegarem ou leads forem capturados.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={savingIntegrations}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition disabled:opacity-50"
          >
            {savingIntegrations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingIntegrations ? 'Salvando...' : 'Salvar Parâmetros de Integração'}
          </button>
        </div>
      </form>

      {/* Cartão de Segurança: Alteração de Senha */}
      <form onSubmit={handleChangePassword} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xl">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            Segurança & Alteração de Senha
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Deseja redefinir sua senha de acesso ao ERBots? Digite a nova senha abaixo.
          </p>
        </div>

        {passwordMsg && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {passwordMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nova Senha (mínimo 8 caracteres)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirme a Nova Senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={passwordLoading || !newPassword}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition disabled:opacity-40"
          >
            {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4 text-amber-400" />}
            {passwordLoading ? 'Atualizando...' : 'Atualizar Minha Senha'}
          </button>
        </div>
      </form>
    </div>
  );
}
