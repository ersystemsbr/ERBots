'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  FlaskConical,
  Send,
  X,
  Bot,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

interface OnboardingChecklistProps {
  tenantId: string;
  isConnected: boolean;
  onNavigateTab: (tab: string) => void;
}

interface SimMsg {
  sender: 'user' | 'ai';
  content: string;
  handoff?: boolean;
  capturedLead?: {
    customerName?: string;
    interest: string;
    preferredSlot?: string;
    notes?: string;
  } | null;
}

export default function OnboardingChecklist({
  tenantId,
  isConnected,
  onNavigateTab,
}: OnboardingChecklistProps) {
  const [botConfigured, setBotConfigured] = useState<boolean>(false);
  const [knowledgeCount, setKnowledgeCount] = useState<number>(0);
  const [simulatorTested, setSimulatorTested] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Estado do modal Simulador
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [simMessages, setSimMessages] = useState<SimMsg[]>([]);
  const [simInput, setSimInput] = useState<string>('');
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [ignoreHours, setIgnoreHours] = useState<boolean>(true);
  const [simError, setSimError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await authFetch(`/api/tenant/analytics?tenant_id=${encodeURIComponent(tenantId)}&days=7`);
      if (res.ok) {
        const d = await res.json();
        setBotConfigured(Boolean(d.onboarding?.botConfigured));
        setKnowledgeCount(Number(d.onboarding?.knowledgeCount || 0));
      }
    } catch {
      // Silencioso
    }
  }, [tenantId]);

  useEffect(() => {
    loadStatus();
    if (typeof window !== 'undefined' && tenantId) {
      setSimulatorTested(localStorage.getItem(`erbots_sim_tested_${tenantId}`) === '1');
      setDismissed(localStorage.getItem(`erbots_onboarding_dismissed_${tenantId}`) === '1');
    }
  }, [tenantId, loadStatus]);

  const steps = [
    {
      id: 'bot',
      done: botConfigured,
      title: '1. Personalizar identidade da IA',
      desc: 'Defina o nome da atendente, tom de voz e instruções da empresa.',
      actionLabel: 'Personalizar',
      onAction: () => onNavigateTab('bot-settings'),
    },
    {
      id: 'kb',
      done: knowledgeCount >= 3,
      title: `2. Treinar Base de Conhecimento (${knowledgeCount}/3 itens)`,
      desc: 'Cadastre seus preços, horários e dúvidas comuns (ou use um modelo pronto).',
      actionLabel: 'Treinar IA',
      onAction: () => onNavigateTab('knowledge'),
    },
    {
      id: 'sim',
      done: simulatorTested,
      title: '3. Testar conversa no Simulador',
      desc: 'Converse com sua IA aqui mesmo antes de ativar para seus clientes.',
      actionLabel: 'Testar IA',
      onAction: () => setShowSimulator(true),
    },
    {
      id: 'wa',
      done: isConnected,
      title: '4. Conectar WhatsApp via QR Code',
      desc: 'Leia o QR Code com o celular da empresa para colocar no ar 24/7.',
      actionLabel: isConnected ? 'Conectado' : 'Conectar',
      onAction: () => onNavigateTab('whatsapp'),
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const pct = Math.round((completedCount / steps.length) * 100);
  const allDone = completedCount === steps.length;

  const handleSendSim = async (customText?: string) => {
    const text = (customText ?? simInput).trim();
    if (!text || simLoading) return;
    setSimInput('');
    setSimError(null);

    const nextHistory: SimMsg[] = [...simMessages, { sender: 'user', content: text }];
    setSimMessages(nextHistory);
    setSimLoading(true);

    try {
      const res = await authFetch('/api/tenant/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          message: text,
          history: simMessages.map((m) => ({ sender: m.sender, content: m.content })),
          ignoreBusinessHours: ignoreHours,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSimError(data.error || 'Erro ao simular resposta.');
      } else {
        setSimMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            content: data.reply || '(sem resposta)',
            handoff: data.triggerHandoff,
            capturedLead: data.capturedLead || null,
          },
        ]);
        setSimulatorTested(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`erbots_sim_tested_${tenantId}`, '1');
        }
      }
    } catch (err: any) {
      setSimError(err?.message || 'Erro de rede.');
    } finally {
      setSimLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`erbots_onboarding_dismissed_${tenantId}`, '1');
    }
  };

  return (
    <>
      {dismissed && allDone ? (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowSimulator(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-emerald-400 transition"
          >
            <FlaskConical className="w-4 h-4" />
            Simulador de Teste da IA
          </button>
        </div>
      ) : (
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    {allDone ? 'Configuração inicial concluída!' : 'Guia Rápido de Ativação'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {completedCount}/{steps.length} ({pct}%)
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Siga os passos abaixo para colocar sua atendente virtual funcionando com máxima qualidade.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setShowSimulator(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Testar IA
              </button>
              {allDone && (
                <button
                  onClick={handleDismiss}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 hover:text-white transition"
                >
                  Ocultar guia
                </button>
              )}
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
                title={collapsed ? 'Expandir' : 'Recolher'}
              >
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!collapsed && (
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                    step.done
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      {step.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span>{step.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>

                  <button
                    onClick={step.onAction}
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                      step.done
                        ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
                    }`}
                  >
                    {step.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Simulador da IA */}
      {showSimulator && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Simulador de Atendimento IA</h3>
                  <p className="text-[11px] text-slate-400">
                    Usa suas regras e Base de Conhecimento reais (sem enviar no WhatsApp)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {simMessages.length > 0 && (
                  <button
                    onClick={() => setSimMessages([])}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Reiniciar conversa"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setShowSimulator(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreHours}
                  onChange={(e) => setIgnoreHours(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500"
                />
                <span>Ignorar restrição de horário comercial durante o teste</span>
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px]">
              {simMessages.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <Bot className="w-10 h-10 text-emerald-400/70 mx-auto" />
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Envie uma pergunta como se fosse um cliente real. Experimente um exemplo:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {[
                      'Olá! Qual o horário de atendimento?',
                      'Quais formas de pagamento vocês aceitam?',
                      'Quero falar com um atendente humano',
                    ].map((sample) => (
                      <button
                        key={sample}
                        onClick={() => handleSendSim(sample)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                simMessages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                      }`}
                    >
                      <p className="whitespace-pre-line leading-relaxed">{m.content}</p>
                      {(m.handoff || m.capturedLead) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.capturedLead && (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                              🎯 Lead captado: {m.capturedLead.interest}
                              {m.capturedLead.preferredSlot ? ` (${m.capturedLead.preferredSlot})` : ''}
                            </span>
                          )}
                          {m.handoff && (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                              🔔 Transbordo humano acionado
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {simLoading && (
                <div className="text-xs text-slate-400 italic">Digitando resposta da IA...</div>
              )}

              {simError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                  {simError}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendSim();
              }}
              className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2"
            >
              <input
                type="text"
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                placeholder="Digite como um cliente..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={simLoading || !simInput.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
