'use client';

import { authFetch } from '@/lib/api-client';
import { usePlans } from '@/lib/use-plans';
import { formatBRL } from '@/lib/plans';

import React, { useState } from 'react';
import {
  Building2,
  Smartphone,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Edit,
  DollarSign,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  segment: string;
  plan: string;
  subscription_status: string;
  trial_ends_at: string;
  created_at: string;
  instance?: {
    name: string;
    status: string;
    phone: string | null;
    profileName: string | null;
  } | null;
  bot?: {
    name: string;
    model: string;
    isActive: boolean;
  } | null;
}

interface AdminTenantsTableProps {
  tenants: Tenant[];
  userEmail: string;
  onRefresh: () => void;
  onOpenPaymentModal: (tenant: Tenant) => void;
}

export default function AdminTenantsTable({
  tenants,
  userEmail,
  onRefresh,
  onOpenPaymentModal,
}: AdminTenantsTableProps) {
  const plansCfg = usePlans();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editName, setEditName] = useState('');
  const [editSegment, setEditSegment] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // Filtros
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.phone || '').includes(searchTerm);

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && t.subscription_status === statusFilter;
  });

  const handleOpenEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditName(tenant.name || '');
    setEditSegment(tenant.segment || 'Geral');
    setEditPhone(tenant.phone || '');
    setEditEmail(tenant.email || '');
    setEditSlug(tenant.slug || '');
    setNewPlan(tenant.plan || 'trial');
    setNewStatus(tenant.subscription_status || 'trialing');
  };

  const handleSaveEdit = async () => {
    if (!editingTenant) return;
    setSaving(true);
    try {
      const res = await authFetch('/api/admin/tenants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: editingTenant.id,
          name: editName.trim(),
          segment: editSegment.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim().toLowerCase(),
          slug: editSlug.trim().toLowerCase(),
          plan: newPlan,
          subscription_status: newStatus,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao atualizar.');
      }

      setEditingTenant(null);
      onRefresh();
    } catch (err: any) {
      alert(`Erro: ${err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExtendTrial = async (tenantId: string, days: number) => {
    if (!confirm(`Deseja prorrogar o teste desta empresa em +${days} dias?`)) return;
    try {
      const res = await authFetch('/api/admin/tenants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          extend_trial_days: days,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Falha ao prorrogar.');
      }

      onRefresh();
    } catch (err: any) {
      alert(`Erro: ${err?.message}`);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/D';
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

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por empresa, e-mail ou WhatsApp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="trialing">Em Teste (Trial)</option>
              <option value="past_due">Atrasados / Bloqueados</option>
              <option value="canceled">Cancelados</option>
            </select>
          </div>

          <button
            onClick={onRefresh}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Atualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabela de Tenants */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Empresa / Cliente</th>
                <th className="px-6 py-4">WhatsApp Conectado</th>
                <th className="px-6 py-4">Plano</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Vencimento / Trial</th>
                <th className="px-6 py-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-normal">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                    Nenhum cliente encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const isConnected = tenant.instance?.status === 'CONNECTED';
                  const isTrial = tenant.subscription_status === 'trialing';
                  const isActive = tenant.subscription_status === 'active';

                  return (
                    <tr key={tenant.id} className="hover:bg-slate-800/30 transition">
                      {/* Empresa */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              {tenant.name}
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {tenant.segment || 'Geral'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {tenant.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp */}
                      <td className="px-6 py-4">
                        {tenant.instance ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                                }`}
                              />
                              <span
                                className={`text-xs font-semibold ${
                                  isConnected ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {isConnected ? 'Conectado' : 'Desconectado'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {tenant.instance.phone || 'Sem número'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Sem instância</span>
                        )}
                      </td>

                      {/* Plano */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-200">
                          {tenant.plan || 'trial'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Ativo
                          </span>
                        ) : isTrial ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5" />
                            Teste Grátis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" />
                            {tenant.subscription_status}
                          </span>
                        )}
                      </td>

                      {/* Vencimento / Trial */}
                      <td className="px-6 py-4 text-xs font-mono text-slate-300">
                        {formatDate(tenant.trial_ends_at)}
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Botão Prorrogar Trial */}
                          <button
                            onClick={() => handleExtendTrial(tenant.id, 7)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg border border-slate-700 transition"
                            title="Prorrogar Teste por +7 dias"
                          >
                            <Clock className="w-4 h-4" />
                          </button>

                          {/* Botão Registrar Pagamento */}
                          <button
                            onClick={() => onOpenPaymentModal(tenant)}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30 transition"
                            title="Lançar Pagamento / Ativar Plano"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>

                          {/* Botão Editar Plano/Status */}
                          <button
                            onClick={() => handleOpenEdit(tenant)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                            title="Alterar Plano e Status"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edição Completa dos Dados do Cliente */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-8">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-emerald-400" />
                Editar Cadastro & Plano: {editingTenant.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Altere os dados cadastrais da empresa ou atualize o plano/status da assinatura.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Nome da Empresa */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Nome da Empresa / Cliente: *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Nome da empresa"
                />
              </div>

              {/* Segmento */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Segmento de Atuação:
                </label>
                <input
                  type="text"
                  value={editSegment}
                  onChange={(e) => setEditSegment(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Ex: Comércio, Software..."
                />
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Telefone / WhatsApp:
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="(11) 99999-9999"
                />
              </div>

              {/* E-mail */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  E-mail do Cliente:
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="cliente@email.com"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Identificador (Slug):
                </label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="minha-empresa"
                />
              </div>

              {/* Plano */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Plano do Cliente:
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="trial">Trial (Teste Grátis)</option>
                  <option value="start">Plano Start ({formatBRL(plansCfg.start.price)}/mês)</option>
                  <option value="pro">Plano Pro ({formatBRL(plansCfg.pro.price)}/mês)</option>
                  <option value="business">Plano Business ({formatBRL(plansCfg.business.price)}/mês)</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Status da Assinatura:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="active">Ativo (Liberado)</option>
                  <option value="trialing">Em Teste (Trial)</option>
                  <option value="past_due">Atrasado / Pendente</option>
                  <option value="canceled">Cancelado / Bloqueado</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingTenant(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving || !editName.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold rounded-xl transition disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
