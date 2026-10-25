'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Sparkles,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  XCircle,
  Zap,
} from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { useCommercialCatalog } from '@/lib/use-plans';
import {
  planFeatureList,
  PAID_PLAN_IDS,
  PaidPlanId,
  BillingInterval,
  computeAnnualPricing,
  currentUsagePeriod,
  formatBRL,
  getAccessState,
  getPlan,
  isValidCpfCnpj,
  onlyDigits,
} from '@/lib/plans';

interface SubscriptionPlansProps {
  tenant: any;
  onTenantUpdated?: (tenant: any) => void;
}

function maskCpfCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatPaymentPlanLabel(planKey: string): string {
  if (planKey === 'extra_pack') return 'Pacote Extra IA';
  return planKey;
}

export default function SubscriptionPlans({ tenant, onTenantUpdated }: SubscriptionPlansProps) {
  const currentPlanId: string = tenant?.plan || 'trial';
  const currentInterval: BillingInterval = tenant?.billing_interval === 'yearly' ? 'yearly' : 'monthly';
  const extraCredits: number = Number(tenant?.extra_ai_credits) || 0;
  const { plans, addons } = useCommercialCatalog();
  const currentPlan = getPlan(currentPlanId, plans);
  const access = getAccessState(tenant || {});
  const status: string = tenant?.subscription_status || 'trialing';

  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(currentInterval);
  const [cpfCnpj, setCpfCnpj] = useState<string>(maskCpfCnpj(tenant?.cpf_cnpj || ''));
  const [busyPlan, setBusyPlan] = useState<PaidPlanId | null>(null);
  const [busyTopup, setBusyTopup] = useState<boolean>(false);
  const [canceling, setCanceling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingInvoiceUrl, setPendingInvoiceUrl] = useState<string | null>(tenant?.pending_invoice_url || null);
  const [usedReplies, setUsedReplies] = useState<number | null>(null);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    setPendingInvoiceUrl(tenant?.pending_invoice_url || null);
  }, [tenant?.pending_invoice_url]);

  const loadExtras = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const { data } = await supabase
        .from('xerb_usage')
        .select('ai_replies')
        .eq('tenant_id', tenant.id)
        .eq('period', currentUsagePeriod())
        .maybeSingle();
      setUsedReplies(data ? Number(data.ai_replies) || 0 : 0);
    } catch {
      setUsedReplies(null);
    }
    try {
      const { data } = await supabase
        .from('xerb_payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(12);
      setPayments(data || []);
    } catch {
      setPayments([]);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const refreshTenant = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await authFetch('/api/tenant/bootstrap', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.tenant && onTenantUpdated) onTenantUpdated(data.tenant);
      await loadExtras();
    } finally {
      setRefreshing(false);
    }
  }, [loadExtras, onTenantUpdated]);

  useEffect(() => {
    const onFocus = () => {
      if (pendingInvoiceUrl) refreshTenant();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [pendingInvoiceUrl, refreshTenant]);

  const handleSubscribe = async (planId: PaidPlanId) => {
    setError(null);
    setInfo(null);
    if (!isValidCpfCnpj(cpfCnpj)) {
      setError('Informe um CPF ou CNPJ válido no campo acima para emitir a cobrança.');
      return;
    }
    setBusyPlan(planId);
    try {
      const res = await authFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          plan: planId,
          interval: selectedInterval,
          cpf_cnpj: onlyDigits(cpfCnpj),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Não foi possível iniciar o pagamento. Tente novamente.');
        return;
      }
      if (data.invoiceUrl) {
        setPendingInvoiceUrl(data.invoiceUrl);
        setInfo(
          'Fatura gerada! Se a janela de pagamento não abrir automaticamente no seu celular, toque no botão "Abrir Fatura para Pagar" abaixo.'
        );
        window.open(data.invoiceUrl, '_blank', 'noopener');
      } else {
        setInfo('Assinatura criada. A fatura será enviada ao seu e-mail em instantes.');
      }
    } catch {
      setError('Falha de conexão ao iniciar o pagamento.');
    } finally {
      setBusyPlan(null);
    }
  };

  const handleBuyExtraPack = async () => {
    setError(null);
    setInfo(null);
    if (!isValidCpfCnpj(cpfCnpj)) {
      setError('Informe um CPF ou CNPJ válido no campo acima para emitir a cobrança do pacote extra.');
      return;
    }
    setBusyTopup(true);
    try {
      const res = await authFetch('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          cpf_cnpj: onlyDigits(cpfCnpj),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Não foi possível gerar o pacote extra.');
        return;
      }
      if (data.invoiceUrl) {
        setPendingInvoiceUrl(data.invoiceUrl);
        setInfo(
          `Cobrança avulsa de +${(data.replies || addons.extraPackReplies).toLocaleString('pt-BR')} respostas gerada! Assim que o pagamento for confirmado, seus créditos extras entram na hora.`
        );
        window.open(data.invoiceUrl, '_blank', 'noopener');
      }
    } catch {
      setError('Falha de conexão ao gerar pacote avulso.');
    } finally {
      setBusyTopup(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancelar a assinatura? Você mantém o acesso até o fim do período já pago.')) return;
    setError(null);
    setInfo(null);
    setCanceling(true);
    try {
      const res = await authFetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Não foi possível cancelar a assinatura.');
        return;
      }
      setInfo('Assinatura cancelada. O acesso continua até o fim do período pago.');
      await refreshTenant();
    } catch {
      setError('Falha de conexão ao cancelar.');
    } finally {
      setCanceling(false);
    }
  };

  const limit = currentPlan.monthlyAiReplies;
  const pct = usedReplies !== null && limit > 0 ? Math.min(100, Math.round((usedReplies / limit) * 100)) : 0;
  const endsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString('pt-BR') : null;
  const hasSubscription = Boolean(tenant?.billing_subscription_id);
  const hasAnnualDiscount = addons.annualDiscountPercent > 0;
  const currentAnnualPricing = computeAnnualPricing(currentPlan.price, addons.annualDiscountPercent);

  let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  let badgeText = 'Assinatura ativa';
  if (status === 'trialing') badgeText = 'Período de teste';
  if (status === 'past_due') {
    badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    badgeText = 'Pagamento em atraso';
  }
  if (status === 'canceled') {
    badgeClass = 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    badgeText = 'Cancelada';
  }
  if (!access.allowed) {
    badgeClass = 'bg-red-500/10 text-red-400 border-red-500/20';
    badgeText = 'Atendente pausado';
  }

  return (
    <div className="space-y-8">
      {/* Status atual */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeClass}`}>
                {access.allowed ? <Sparkles className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {badgeText}
              </div>
              {extraCredits > 0 && (
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-teal-500/10 text-teal-300 border-teal-500/30">
                  <Zap className="w-3.5 h-3.5" />
                  +{extraCredits.toLocaleString('pt-BR')} créditos extras disponíveis
                </div>
              )}
            </div>

            <h2 className="text-xl font-bold text-white">
              Plano atual: {currentPlan.name}
              {currentPlan.price > 0 && (
                <span className="text-slate-400 font-medium text-base">
                  {' '}
                  ·{' '}
                  {currentInterval === 'yearly'
                    ? `${formatBRL(currentAnnualPricing.yearlyTotal)}/ano`
                    : `${formatBRL(currentPlan.price)}/mês`}
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {access.message}
              {endsAt && access.allowed ? ` Válido até ${endsAt}.` : ''}
            </p>
          </div>
          <button
            onClick={refreshTenant}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar status
          </button>
        </div>

        {/* Medidor de uso */}
        {usedReplies !== null && (
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Respostas de IA neste mês</span>
              <span>
                {usedReplies.toLocaleString('pt-BR')} / {limit.toLocaleString('pt-BR')}
                {extraCredits > 0 ? ` (+${extraCredits.toLocaleString('pt-BR')} reserva)` : ''}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {pct >= 90 && extraCredits === 0 && (
              <p className="text-xs text-amber-400 mt-1.5">
                Você está perto do limite do plano. Adicione um pacote extra abaixo ou faça upgrade para nunca pausar o atendimento.
              </p>
            )}
          </div>
        )}

        {hasSubscription && status !== 'canceled' && (
          <div>
            <button
              onClick={handleCancel}
              disabled={canceling}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition disabled:opacity-60"
            >
              {canceling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Cancelar assinatura
            </button>
          </div>
        )}
      </div>

      {/* CPF/CNPJ + Pacote Extra Avulso */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              CPF ou CNPJ para emissão da cobrança
            </label>
            <input
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              inputMode="numeric"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Pagamento via Pix (liberação em segundos), cartão de crédito ou boleto bancário pelo Asaas.
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-500/30 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Zap className="w-4 h-4" />
              Pacote Avulso de Respostas IA
            </div>
            <h3 className="text-base font-extrabold text-white">
              +{addons.extraPackReplies.toLocaleString('pt-BR')} respostas por {formatBRL(addons.extraPackPrice)}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Créditos reservas que <strong>não expiram na virada do mês</strong> — só são usados se sua franquia mensal acabar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBuyExtraPack}
            disabled={busyTopup || busyPlan !== null || !access.allowed}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
            title={!access.allowed ? 'Ative um plano para usar pacotes extras' : ''}
          >
            {busyTopup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Comprar Pacote
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
      )}
      {(info || pendingInvoiceUrl) && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm rounded-xl px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>
            {info ||
              'Você possui uma fatura aguardando pagamento. Assim que o Pix ou cartão for confirmado, seu plano ou pacote é liberado automaticamente!'}
          </span>
          {pendingInvoiceUrl && (
            <a
              href={pendingInvoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shrink-0 transition"
            >
              Abrir Fatura para Pagar
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Seletor Ciclo Mensal / Anual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Escolha seu plano</h3>
          <p className="text-xs text-slate-400">
            Troque entre ciclo mensal ou anual com desconto imediato.
          </p>
        </div>

        <div className="inline-flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setSelectedInterval('monthly')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              selectedInterval === 'monthly'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setSelectedInterval('yearly')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${
              selectedInterval === 'yearly'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Anual</span>
            {hasAnnualDiscount && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  selectedInterval === 'yearly'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                -{addons.annualDiscountPercent}% OFF
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PAID_PLAN_IDS.map((id) => {
          const p = plans[id];
          const annual = computeAnnualPricing(p.price, addons.annualDiscountPercent);
          const shownMonthly = selectedInterval === 'yearly' ? annual.monthlyEquivalent : p.price;
          const isCurrent =
            currentPlanId === id && status === 'active' && currentInterval === selectedInterval;
          const busy = busyPlan === id;

          return (
            <div
              key={id}
              className={`bg-slate-900 rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition relative shadow-xl ${
                p.popular
                  ? 'border-2 border-emerald-500 ring-4 ring-emerald-500/10'
                  : 'border border-slate-800 hover:border-slate-700'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                  Mais Popular
                </span>
              )}

              <div>
                <h3 className="text-lg font-bold text-white">{p.name}</h3>
                <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{p.description}</p>

                <div className="mt-4 mb-6">
                  <div className="flex items-baseline gap-1.5">
                    {selectedInterval === 'yearly' && hasAnnualDiscount && (
                      <span className="text-sm text-slate-500 line-through font-semibold">
                        {formatBRL(p.price)}
                      </span>
                    )}
                    <span className="text-3xl sm:text-4xl font-extrabold text-white">
                      {formatBRL(shownMonthly)}
                    </span>
                    <span className="text-xs text-slate-400 ml-0.5 font-medium">/mês</span>
                  </div>
                  {selectedInterval === 'yearly' ? (
                    <p className="text-[11px] text-emerald-400 font-medium mt-1">
                      Cobrança anual de {formatBRL(annual.yearlyTotal)} (economize {formatBRL(annual.yearlySavings)})
                    </p>
                  ) : (
                    hasAnnualDiscount && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        ou {formatBRL(annual.monthlyEquivalent)}/mês no plano anual
                      </p>
                    )
                  )}
                </div>

                <ul className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-300">
                  {planFeatureList(p).map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSubscribe(id)}
                disabled={busy || busyPlan !== null || busyTopup || isCurrent}
                className={`mt-8 w-full py-2.5 rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60 ${
                  p.popular
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {isCurrent
                  ? 'Plano atual'
                  : status === 'active'
                  ? `Mudar para ${p.name} (${selectedInterval === 'yearly' ? 'Anual' : 'Mensal'})`
                  : `Contratar ${p.name} (${selectedInterval === 'yearly' ? 'Anual' : 'Mensal'})`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Histórico */}
      {payments.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-4">Histórico de pagamentos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Valor</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Fatura</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {payments.map((pay) => (
                  <tr key={pay.id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-4">{new Date(pay.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 pr-4 capitalize">{formatPaymentPlanLabel(pay.plan)}</td>
                    <td className="py-2 pr-4">{formatBRL(Number(pay.amount) || 0)}</td>
                    <td className="py-2 pr-4">{pay.status}</td>
                    <td className="py-2">
                      {pay.invoice_url ? (
                        <a
                          href={pay.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                        >
                          Abrir <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
