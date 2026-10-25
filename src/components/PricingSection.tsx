'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { PAID_PLAN_IDS, formatBRL, planFeatureList } from '@/lib/plans';
import { usePlans } from '@/lib/use-plans';

/** Seção de preços da landing. Valores vêm do painel admin (via /api/plans). */
export default function PricingSection() {
  const plans = usePlans();

  return (
    <section id="planos" className="py-20 bg-slate-900/60 border-y border-slate-900 scroll-mt-20">
      <div id="precos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Planos simples, sem taxa de adesão</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Teste grátis por 7 dias. Depois escolha o plano ideal — cancele quando quiser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PAID_PLAN_IDS.map((id) => {
            const p = plans[id];
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
                  <div className="mt-4 mb-6 flex items-baseline">
                    <span className="text-4xl font-extrabold text-white">{formatBRL(p.price)}</span>
                    <span className="text-xs text-slate-400 ml-1">/mês</span>
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
