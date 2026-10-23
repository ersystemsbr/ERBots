'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  CreditCard,
  Building2,
  FileText,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface Payment {
  id: string;
  tenant_id: string;
  amount: number;
  plan: string;
  payment_method: string;
  status: string;
  paid_at: string;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  xerb_tenants?: {
    name: string;
    email: string;
    slug: string;
  } | null;
}

interface TenantSimple {
  id: string;
  name: string;
  email: string;
  slug: string;
  plan: string;
  subscription_status: string;
}

interface AdminPaymentsManagerProps {
  userEmail: string;
  tenants: TenantSimple[];
  initialTenantForPayment?: TenantSimple | null;
  onPaymentSuccess?: () => void;
}

const PLAN_DEFAULTS: Record<string, number> = {
  start: 97,
  pro: 197,
  business: 397,
  custom: 497,
};

export default function AdminPaymentsManager({
  userEmail,
  tenants,
  initialTenantForPayment,
  onPaymentSuccess,
}: AdminPaymentsManagerProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tablePending, setTablePending] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal de lançamento de pagamento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [amount, setAmount] = useState('97.00');
  const [plan, setPlan] = useState('pro');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [extendDays, setExtendDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Carrega histórico de pagamentos
  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payments', {
        headers: {
          'x-user-email': userEmail,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setPayments(data.payments || []);
        setTablePending(!!data.tablePending);
      } else {
        console.error('Erro ao buscar pagamentos:', data.error);
      }
    } catch (err) {
      console.error('Erro de conexão com pagamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      fetchPayments();
    }
  }, [userEmail]);

  // Se receber um tenant para abrir modal direto da tabela de clientes
  useEffect(() => {
    if (initialTenantForPayment) {
      setSelectedTenantId(initialTenantForPayment.id);
      const targetPlan = initialTenantForPayment.plan === 'trial' ? 'pro' : initialTenantForPayment.plan;
      setPlan(targetPlan);
      setAmount((PLAN_DEFAULTS[targetPlan] || 97).toFixed(2));
      setIsModalOpen(true);
    }
  }, [initialTenantForPayment]);

  const handlePlanChange = (newPlan: string) => {
    setPlan(newPlan);
    if (PLAN_DEFAULTS[newPlan]) {
      setAmount(PLAN_DEFAULTS[newPlan].toFixed(2));
    }
  };

  const handleOpenNewPayment = () => {
    if (tenants.length > 0 && !selectedTenantId) {
      setSelectedTenantId(tenants[0].id);
      const p = tenants[0].plan === 'trial' ? 'pro' : tenants[0].plan;
      setPlan(p);
      setAmount((PLAN_DEFAULTS[p] || 97).toFixed(2));
    }
    setActionError(null);
    setActionSuccess(null);
    setIsModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) {
      setActionError('Selecione um cliente para vincular o pagamento.');
      return;
    }

    setSavingPayment(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify({
          tenant_id: selectedTenantId,
          amount: parseFloat(amount),
          plan,
          payment_method: paymentMethod,
          extend_days: extendDays,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar pagamento');
      }

      setActionSuccess('Pagamento registrado e assinatura ativada com sucesso!');
      setTimeout(() => {
        setIsModalOpen(false);
        setActionSuccess(null);
        setNotes('');
      }, 1500);

      fetchPayments();
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao processar pagamento');
    } finally {
      setSavingPayment(false);
    }
  };

  // Filtragem
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const tenantName = p.xerb_tenants?.name?.toLowerCase() || '';
      const tenantEmail = p.xerb_tenants?.email?.toLowerCase() || '';
      const planName = p.plan?.toLowerCase() || '';
      const method = p.payment_method?.toLowerCase() || '';
      const query = searchTerm.toLowerCase();

      const matchesSearch =
        !searchTerm ||
        tenantName.includes(query) ||
        tenantEmail.includes(query) ||
        planName.includes(query) ||
        method.includes(query);

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, searchTerm, statusFilter]);

  // Cálculos financeiros
  const metrics = useMemo(() => {
    const confirmed = payments.filter((p) => p.status === 'confirmed');
    const totalRevenue = confirmed.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const avgTicket = confirmed.length > 0 ? totalRevenue / confirmed.length : 0;
    return {
      totalRevenue,
      confirmedCount: confirmed.length,
      avgTicket,
    };
  }, [payments]);

  return (
    <div className="space-y-6">
      {/* Banner de Aviso caso a tabela xerb_payments ainda não tenha sido rodada no SQL Editor */}
      {tablePending && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-amber-200">
              Aviso: Tabela `xerb_payments` ainda não foi criada no Supabase
            </p>
            <p className="text-slate-300">
              Para salvar e persistir todo o histórico contábil de transações, execute o script{' '}
              <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs">
                database/add_super_admin_payments.sql
              </code>{' '}
              no SQL Editor do seu Supabase.
            </p>
          </div>
        </div>
      )}

      {/* Topo de Métricas Financeiras */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Faturado Registrado
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            R${' '}
            {metrics.totalRevenue.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">Soma de todos os pagamentos confirmados</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Pagamentos Confirmados
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            {metrics.confirmedCount} <span className="text-sm font-normal text-slate-400">transações</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Comprovantes e ativações</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Ticket Médio
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            R${' '}
            {metrics.avgTicket.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">Média por cliente pagante</p>
        </div>
      </div>

      {/* Controles de Busca e Botão Novo Pagamento */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, e-mail, plano ou método..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="confirmed">Confirmados</option>
              <option value="pending">Pendentes</option>
              <option value="failed">Falhados</option>
              <option value="refunded">Reembolsados</option>
            </select>
          </div>

          <button
            onClick={fetchPayments}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button
          onClick={handleOpenNewPayment}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-semibold text-sm hover:from-emerald-400 hover:to-teal-400 transition shadow-lg shadow-emerald-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          + Lançar Pagamento Manual
        </button>
      </div>

      {/* Tabela de Pagamentos */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-4 px-6">Cliente</th>
                <th className="py-4 px-4">Plano</th>
                <th className="py-4 px-4">Valor</th>
                <th className="py-4 px-4">Método</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Data Pagamento</th>
                <th className="py-4 px-4">Expira em</th>
                <th className="py-4 px-6 text-right">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Carregando lançamentos contábeis...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-60" />
                    Nenhum pagamento encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const clientName = p.xerb_tenants?.name || 'Cliente Desconhecido';
                  const clientEmail = p.xerb_tenants?.email || '';

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      {/* Cliente */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-emerald-400 text-sm">
                            {clientName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100">{clientName}</div>
                            <div className="text-xs text-slate-400">{clientEmail}</div>
                          </div>
                        </div>
                      </td>

                      {/* Plano */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                          {p.plan}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className="py-4 px-4 font-mono font-bold text-white">
                        R${' '}
                        {Number(p.amount).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Método */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                          {p.payment_method === 'pix' ? 'Pix' : p.payment_method}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {p.status === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirmado
                          </span>
                        ) : p.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            Pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            {p.status}
                          </span>
                        )}
                      </td>

                      {/* Data Pagamento */}
                      <td className="py-4 px-4 text-xs text-slate-400">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : '-'}
                      </td>

                      {/* Expira em */}
                      <td className="py-4 px-4 text-xs text-slate-400 font-mono">
                        {p.expires_at ? new Date(p.expires_at).toLocaleDateString('pt-BR') : '-'}
                      </td>

                      {/* Observações */}
                      <td className="py-4 px-6 text-right text-xs text-slate-400 max-w-xs truncate">
                        {p.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Lançar Pagamento Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Lançar Pagamento Manual</h3>
                <p className="text-xs text-slate-400">
                  Renova e ativa o plano do cliente instantaneamente no SaaS
                </p>
              </div>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {actionSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              {/* Seleção do Cliente */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cliente / Empresa
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  required
                >
                  <option value="" disabled>
                    Selecione um cliente...
                  </option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email}) - Atual: {t.plan.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plano e Valor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Plano</label>
                  <select
                    value={plan}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 uppercase"
                  >
                    <option value="start">START (R$ 97/mês)</option>
                    <option value="pro">PRO (R$ 197/mês)</option>
                    <option value="business">BUSINESS (R$ 397/mês)</option>
                    <option value="custom">CUSTOM / AVULSO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Valor Pago (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500/50"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Forma de Pagamento e Período */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Forma de Pagamento
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="pix">Pix</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="boleto">Boleto Bancário</option>
                    <option value="transfer">Transferência / TED</option>
                    <option value="manual">Manual / Cortesia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Dias de Validade
                  </label>
                  <select
                    value={extendDays}
                    onChange={(e) => setExtendDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value={30}>+ 30 dias (1 mês)</option>
                    <option value={60}>+ 60 dias (2 meses)</option>
                    <option value={90}>+ 90 dias (Trimestral)</option>
                    <option value={180}>+ 180 dias (Semestral)</option>
                    <option value={365}>+ 365 dias (Anual)</option>
                  </select>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Observações / Comprovante (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Recebido via Pix banco Inter, comprovante arquivado."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Botões */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-semibold text-sm hover:from-emerald-400 hover:to-teal-400 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {savingPayment ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar e Ativar Assinatura
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
