'use client';

import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api-client';
import { DEFAULT_HANDOFF_KEYWORDS } from '@/lib/ai/gemini';
import { Save, Bot, Clock, UserCheck, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface BotSettingsFormProps {
  tenantId: string;
}

const LEGACY_SET = new Set(['atendente', 'humano', 'falar com atendente', 'pessoa', 'suporte']);

function isLegacyKeywords(arr?: string[] | null): boolean {
  if (!Array.isArray(arr) || arr.length !== LEGACY_SET.size) return false;
  return arr.every((k) => LEGACY_SET.has(String(k || '').trim().toLowerCase()));
}

export default function BotSettingsForm({ tenantId }: BotSettingsFormProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Campos do formulário
  const [botName, setBotName] = useState<string>('Assistente Virtual');
  const [tone, setTone] = useState<'formal' | 'friendly' | 'enthusiastic' | 'direct'>('friendly');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [systemPrompt, setSystemPrompt] = useState<string>('');

  // Horário
  const [hoursEnabled, setHoursEnabled] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [outOfHoursMessage, setOutOfHoursMessage] = useState<string>(
    'Olá! No momento estamos fora do nosso horário de atendimento. Deixe sua mensagem que responderemos assim que retornarmos!'
  );

  // Transbordo Humano
  const [handoffEnabled, setHandoffEnabled] = useState<boolean>(true);
  const [keywordsStr, setKeywordsStr] = useState<string>(DEFAULT_HANDOFF_KEYWORDS.slice(0, 8).join(', '));
  const [handoffMessage, setHandoffMessage] = useState<string>(
    'Com certeza! Estou transferindo seu atendimento para nossa equipe humana. Aguarde um instante que já vamos te responder.'
  );

  const daysList = [
    { id: 0, label: 'Dom' },
    { id: 1, label: 'Seg' },
    { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' },
    { id: 4, label: 'Qui' },
    { id: 5, label: 'Sex' },
    { id: 6, label: 'Sáb' },
  ];

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  useEffect(() => {
    async function loadSettings() {
      if (!tenantId) return;
      setLoading(true);
      try {
        const res = await authFetch(`/api/tenant/bot-settings?tenant_id=${encodeURIComponent(tenantId)}`);
        const json = await res.json().catch(() => ({}));
        const data = json?.settings;

        if (data) {
          setBotName(data.bot_name || 'Assistente Virtual');
          setTone(data.tone || 'friendly');
          setIsActive(data.is_active !== false);
          setSystemPrompt(data.system_prompt || '');

          if (data.business_hours) {
            setHoursEnabled(Boolean(data.business_hours.enabled));
            setStartTime(data.business_hours.start || '08:00');
            setEndTime(data.business_hours.end || '18:00');
            setSelectedDays(data.business_hours.days || [1, 2, 3, 4, 5]);
            setOutOfHoursMessage(
              data.business_hours.out_of_hours_message ||
                'Olá! No momento estamos fora do nosso horário de atendimento. Deixe sua mensagem que responderemos assim que retornarmos!'
            );
          }

          setHandoffEnabled(data.human_handoff_enabled !== false);
          if (Array.isArray(data.human_handoff_keywords) && data.human_handoff_keywords.length > 0) {
            setKeywordsStr(
              isLegacyKeywords(data.human_handoff_keywords)
                ? DEFAULT_HANDOFF_KEYWORDS.slice(0, 8).join(', ')
                : data.human_handoff_keywords.join(', ')
            );
          }
          setHandoffMessage(
            data.human_handoff_message ||
              'Com certeza! Estou transferindo seu atendimento para nossa equipe humana. Aguarde um instante que já vamos te responder.'
          );
        }
      } catch (err) {
        console.error('Erro ao carregar configurações do robô:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [tenantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    setSaveError(null);

    try {
      const keywordsArray = keywordsStr
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await authFetch('/api/tenant/bot-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          bot_name: botName,
          tone,
          is_active: isActive,
          system_prompt: systemPrompt,
          business_hours: {
            enabled: hoursEnabled,
            days: selectedDays,
            start: startTime,
            end: endTime,
            out_of_hours_message: outOfHoursMessage,
          },
          human_handoff_enabled: handoffEnabled,
          human_handoff_keywords: keywordsArray,
          human_handoff_message: handoffMessage,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível salvar as configurações.');
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        Carregando configurações da IA...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {saveError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Bloco 1: Identidade e Personalidade */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Bot className="w-6 h-6 text-emerald-400" />
              Identidade e Tom de Voz da IA
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Personalize como o atendente virtual se apresenta e conversa com seus clientes.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-sm font-medium text-slate-300">
              {isActive ? 'Robô Ativo' : 'Robô Pausado'}
            </span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 relative"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Nome do Atendente Virtual
            </label>
            <input
              type="text"
              maxLength={80}
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Ex: Sofia, Lucas, Julia da Clínica X"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Tom de Voz
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="friendly">Amigável e Acolhedor (Recomendado)</option>
              <option value="formal">Formal e Polido (Ideal para advocacia/médicos)</option>
              <option value="enthusiastic">Entusiasmado e Vibrante (Ideal para academias/eventos)</option>
              <option value="direct">Objetivo e Prático (Respostas curtas e diretas)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Instruções Personalizadas do Dono do Negócio
              </span>
              <span className="text-xs font-normal text-slate-500">{systemPrompt.length}/4000</span>
            </label>
            <textarea
              rows={4}
              maxLength={4000}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Ex: 'Sempre enfatize que nossas consultas devem ser agendadas com 24h de antecedência. Não passamos orçamento sem avaliação prévia. Seja caloroso.'"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Bloco 2: Pausar IA Fora do Expediente */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-emerald-400" />
              Pausar IA Fora do Expediente (Opcional)
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Por padrão a IA atende <strong>24h por dia</strong>. Ative apenas se preferir enviar uma mensagem fixa de ausência fora do horário comercial (suporta turnos noturnos, ex.: 18:00 às 02:00).
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={hoursEnabled}
              onChange={(e) => setHoursEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 relative"></div>
          </label>
        </div>

        {hoursEnabled && (
          <div className="space-y-6 pt-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Dias em que a IA Atende Normalmente
              </label>
              <div className="flex flex-wrap gap-2">
                {daysList.map((d) => {
                  const selected = selectedDays.includes(d.id);
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => toggleDay(d.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        selected
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Horário de Início
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Horário de Término
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Mensagem Automática Fora do Expediente
              </label>
              <input
                type="text"
                maxLength={500}
                value={outOfHoursMessage}
                onChange={(e) => setOutOfHoursMessage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bloco 3: Transbordo Humano */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-emerald-400" />
              Transbordo para Atendente Humano
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Permita que a conversa seja transferida para sua equipe e dispare alerta no seu WhatsApp quando o cliente pedir ajuda humana.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={handoffEnabled}
              onChange={(e) => setHandoffEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 relative"></div>
          </label>
        </div>

        {handoffEnabled && (
          <div className="space-y-6 pt-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Frases/palavras exatas que acionam a transferência imediata (separadas por vírgula)
              </label>
              <input
                type="text"
                value={keywordsStr}
                onChange={(e) => setKeywordsStr(e.target.value)}
                placeholder="atendente, atendimento humano, falar com humano, falar com o gerente"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
              />
              <span className="text-xs text-slate-500 mt-1 block">
                Use expressões claras (evite palavras genéricas isoladas como &ldquo;pessoa&rdquo; ou &ldquo;suporte&rdquo;). A própria IA também transfere automaticamente quando percebe necessidade.
              </span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Mensagem enviada ao transferir
              </label>
              <input
                type="text"
                maxLength={500}
                value={handoffMessage}
                onChange={(e) => setHandoffMessage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Botão de Salvar */}
      <div className="flex items-center justify-end gap-4 pt-4">
        {savedSuccess && (
          <span className="text-emerald-400 text-sm font-medium flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4" />
            Configurações salvas com sucesso!
          </span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}
