'use client';

import React from 'react';
import { ShieldCheck, Check, Zap, Sparkles } from 'lucide-react';

interface SubscriptionPlansProps {
  currentPlan?: string;
  trialEndsAt?: string;
}

export default function SubscriptionPlans({ currentPlan = 'trial', trialEndsAt }: SubscriptionPlansProps) {
  const plans = [
    {
      id: 'start',
      name: 'Start',
      price: 'R$ 149',
      period: '/mês',
      description: 'Ideal para profissionais autônomos, consultórios e pequenos negócios.',
      features: [
        '1 Conexão de WhatsApp',
        'Atendente IA Gemini 24/7',
        'Base de Conhecimento (FAQ e Serviços)',
        'Personalização de Tom de Voz',
        'Horário de Atendimento',
        'Suporte via WhatsApp',
      ],
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 'R$ 249',
      period: '/mês',
      description: 'O mais escolhido para empresas que buscam automação e controle total.',
      features: [
        '1 Conexão de WhatsApp',
        'Atendente IA Gemini com resposta ultra-rápida',
        'Base de Conhecimento Ilimitada',
        'Transbordo Humano Inteligente',
        'Live Chat / CRM em Tempo Real',
        'Histórico Completo de Mensagens',
        'Suporte Prioritário',
      ],
      popular: true,
    },
    {
      id: 'business',
      name: 'Business',
      price: 'R$ 449',
      period: '/mês',
      description: 'Para empresas maiores, clínicas com várias unidades e alto volume.',
      features: [
        'Até 3 Conexões de WhatsApp simultâneas',
        'IA com ajuste fino de prompts complexos',
        'Transbordo com roteamento de equipe',
        'Webhooks customizados para sistemas externos',
        'Treinamento e Setup Assistido',
        'Gerente de Contas Dedicado',
      ],
      popular: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Status da Assinatura Atual */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Período de Testes Ativo (Trial)
          </div>
          <h2 className="text-xl font-bold text-white">Sua conta está no Plano de Degustação</h2>
          <p className="text-sm text-slate-400 mt-1">
            Aproveite todas as funcionalidades liberadas.
            {trialEndsAt ? ` Seu teste expira em ${new Date(trialEndsAt).toLocaleDateString()}.` : ' Válido por 7 dias.'}
          </p>
        </div>

        <button
          onClick={() => alert('Integração de checkout do Mercado Pago / Asaas pronta para ativação!')}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition shrink-0"
        >
          Ativar Assinatura Definitiva
        </button>
      </div>

      {/* Cards de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => {
          const isCurrent = currentPlan === p.id;

          return (
            <div
              key={p.id}
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

                <div className="mt-4 mb-6 flex items-baseline">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white">{p.price}</span>
                  <span className="text-xs text-slate-400 ml-1 font-medium">{p.period}</span>
                </div>

                <ul className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-300">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => alert(`Plano ${p.name} selecionado! Abrindo checkout Pix...`)}
                className={`mt-8 w-full py-2.5 rounded-xl font-bold text-xs transition shadow-md ${
                  p.popular
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                {isCurrent ? 'Plano Atual' : `Contratar ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
