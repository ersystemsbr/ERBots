'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Save, RotateCcw, Info } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import { PLANS, formatBRL, type PlanId, type PlanDefinition } from '@/lib/plans';

const EDITABLE: PlanId[] = ['trial', 'start', 'pro', 'business'];

interface FormPlan {
  name: string;
  price: string;
  monthlyAiReplies: string;
  maxInstances: string;
  description: string;
  features: string;
}

function toForm(p: PlanDefinition): FormPlan {
  return {
    name: p.name,
    price: String(p.price),
    monthlyAiReplies: String(p.monthlyAiReplies),
    maxInstances: String(p.maxInstances),
    description: p.description,
    features: p.features.join('\n'),
  };
}

export default function AdminPlansEditor() {
  const [form, setForm] = useState<Record<PlanId, FormPlan> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/plans');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar planos.');
      const next = {} as Record<PlanId, FormPlan>;
      EDITABLE.forEach((id) => (next[id] = toForm(data.plans[id])));
      setForm(next);
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || 'Erro ao carregar planos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = (id: PlanId, field: keyof FormPlan, value: string) => {
    setForm((f) => (f ? { ...f, [id]: { ...f[id], [field]: value } } : f));
  };

  const resetPlan = (id: PlanId) => {
    setForm((f) => (f ? { ...f, [id]: toForm(PLANS[id]) } : f));
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setMsg(null);
    try {
      const plans: Record<string, any> = {};
      EDITABLE.forEach((id) => {
        const p = form[id];
        plans[id] = {
          name: p.name,
          price: Number(String(p.price).replace(',', '.')),
          monthlyAiReplies: Number(p.monthlyAiReplies),
          maxInstances: Number(p.maxInstances),
          description: p.description,
          features: p.features.split('\n'),
        };
      });
      const res = await authFetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');
      setMsg({ type: 'ok', text: 'Planos atualizados! A landing e a tela de assinatura já refletem os novos valores (até ~30s).' });
      await load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50';

  if (loading && !form) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
        Carregando planos…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/20 text-sky-200 text-xs flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          Os valores abaixo valem para <b>novas assinaturas</b>, para a landing page e para os limites de uso. Quem já assina
          continua pagando o valor contratado no Asaas até mudar de plano. Os limites (respostas de IA e conexões) valem
          imediatamente para todos os clientes do plano.
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl text-sm border ${
            msg.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}
        >
          {msg.text}
        </div>
      )}

      {form && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {EDITABLE.map((id) => {
            const p = form[id];
            return (
              <div key={id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white uppercase text-sm tracking-wide">
                    {id === 'trial' ? 'Teste grátis (limites)' : `Plano ${id}`}
                  </h3>
                  <button
                    onClick={() => resetPlan(id)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                    title="Voltar aos valores padrão (só efetiva ao salvar)"
                  >
                    <RotateCcw className="w-3 h-3" /> Restaurar padrão
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-400 space-y-1">
                    Nome exibido
                    <input className={inputCls} value={p.name} onChange={(e) => update(id, 'name', e.target.value)} />
                  </label>
                  <label className="text-xs text-slate-400 space-y-1">
                    Preço mensal (R$)
                    <input
                      className={`${inputCls} disabled:opacity-50`}
                      inputMode="decimal"
                      value={p.price}
                      disabled={id === 'trial'}
                      onChange={(e) => update(id, 'price', e.target.value)}
                    />
                  </label>
                  <label className="text-xs text-slate-400 space-y-1">
                    Respostas de IA por {id === 'trial' ? 'período de teste' : 'mês'}
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={p.monthlyAiReplies}
                      onChange={(e) => update(id, 'monthlyAiReplies', e.target.value.replace(/\D/g, ''))}
                    />
                  </label>
                  <label className="text-xs text-slate-400 space-y-1">
                    Conexões de WhatsApp
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={p.maxInstances}
                      onChange={(e) => update(id, 'maxInstances', e.target.value.replace(/\D/g, ''))}
                    />
                  </label>
                </div>

                <label className="text-xs text-slate-400 space-y-1 block">
                  Descrição curta
                  <input className={inputCls} value={p.description} onChange={(e) => update(id, 'description', e.target.value)} />
                </label>

                {id !== 'trial' && (
                  <label className="text-xs text-slate-400 space-y-1 block">
                    Benefícios (um por linha — conexões e respostas de IA são geradas automaticamente)
                    <textarea
                      rows={6}
                      className={inputCls}
                      value={p.features}
                      onChange={(e) => update(id, 'features', e.target.value)}
                    />
                  </label>
                )}

                {id !== 'trial' && (
                  <p className="text-[11px] text-slate-500">
                    Prévia: {formatBRL(Number(String(p.price).replace(',', '.')) || 0)}/mês
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div>
        <button
          onClick={save}
          disabled={saving || !form}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl disabled:opacity-60 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar planos
        </button>
      </div>
    </div>
  );
}
