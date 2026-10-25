'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Sparkles } from 'lucide-react';
import {
  PAID_PLAN_IDS,
  computeAnnualPricing,
  formatBRL,
  planFeatureList,
  type BillingInterval,
} from '@/lib/plans';
import { useCommercialCatalog } from '@/lib/use-plans';

/** Seção de preços da landing. Valores e desconto anual vêm do painel admin (via /api/plans). */
export default function PricingSection() {
  const { plans, addons } = useCommercialCatalog();
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const hasAnnualDiscount = addons.annualDiscountPercent > 0;

  return (
    <section id="planos" className="py-20 bg-slate-900/60 border-y border-slate-900 scroll-mt-20">
      <div id="precos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Planos simples, sem taxa de adesão</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Teste grátis por 7 dias. Depois escolha o plano ideal — cancele quando quiser.
          </p>

          {/* Seletor Mensal / Anual */}
          <div className="pt-3 flex justify-center">
            <div className="inline-flex items-center p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setInterval('monthly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  interval === 'monthly'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setInterval('yearly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${
                  interval === 'yearly'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>Anual</span>
                {hasAnnualDiscount && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      interval === 'yearly'
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PAID_PLAN_IDS.map((id) => {
            const p = plans[id];
            const annual = computeAnnualPricing(p.price, addons.annualDiscountPercent);
            const shownMonthly = interval === 'yearly' ? annual.monthlyEquivalent : p.price;

            return (
              <div
                key={id}
                className={`relative bg-slate-900 rounded-2xl p-8 flex flex-col justify-between shadow-xl ${
                  p.popular ? 'border-2 border-emerald-500 ring-4 ring-emerald-500/10' : 'border border-slate-800'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full">
                    Mais Popular
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-bold text-white">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{p.description}</p>

                  <div className="mt-4 mb-6">
                    <div className="flex items-baseline gap-1.5">
                      {interval === 'yearly' && hasAnnualDiscount && (
                        <span className="text-sm text-slate-500 line-through font-semibold">
                          {formatBRL(p.price)}
                        </span>
                      )}
                      <span className="text-4xl font-extrabold text-white">{formatBRL(shownMonthly)}</span>
                      <span className="text-xs text-slate-400">/mês</span>
                    </div>
                    {interval === 'yearly' ? (
                      <p className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 shrink-0" />
                        {formatBRL(annual.yearlyTotal)}/ano (economia de {formatBRL(annual.yearlySavings)})
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
                    {planFeatureList(p).map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  href="/cadastro"
                  className={`mt-8 w-full inline-flex items-center justify-center py-3 rounded-xl font-bold text-sm transition ${
                    p.popular
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  }`}
                >
                  Começar teste grátis
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
