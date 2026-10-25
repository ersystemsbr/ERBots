'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import {
  BarChart3,
  MessageSquare,
  Bot,
  Clock,
  Moon,
  Download,
  RefreshCw,
  CheckCircle2,
  UserCheck,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';

interface AnalyticsProps {
  tenantId: string;
  onNavigateTab?: (tab: string) => void;
}

export default function AnalyticsDashboard({ tenantId, onNavigateTab }: AnalyticsProps) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAnalytics = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/tenant/analytics?tenant_id=${encodeURIComponent(tenantId)}&days=${days}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Erro ao buscar resultados:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, days]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExportCsv = () => {
    const leads = data?.recentLeads || [];
    if (!leads.length) return;
    const header = ['Nome', 'Telefone', 'Status', 'Ultima_Mensagem', 'Data_Hora'];
    const rows = leads.map((l: any) => [
      `"${String(l.contact_name || '').replace(/"/g, '""')}"`,
      `"${String(l.contact_phone || '').replace(/"/g, '""')}"`,
      `"${l.handling_status || 'AI'}"`,
      `"${String(l.last_message || '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`,
      `"${l.last_message_at ? new Date(l.last_message_at).toLocaleString('pt-BR') : ''}"`,
    ]);
    const csv = '\uFEFF' + [header.join(';'), ...rows.map((r: string[]) => r.join(';'))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_erbots_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = data?.summary || {};
  const daily: Array<{ date: string; label: string; conversations: number; aiReplies: number }> =
    data?.dailySeries || [];
  const hourly: Array<{ hour: number; label: string; count: number }> = data?.hourlyDistribution || [];
  const leads: any[] = data?.recentLeads || [];

  const maxDaily = Math.max(1, ...daily.map((d) => Math.max(d.aiReplies, d.conversations)));
  const maxHourly = Math.max(1, ...hourly.map((h) => h.count));
  const usagePct =
    summary.monthlyAiLimit > 0
      ? Math.min(100, Math.round(((summary.monthlyAiUsed || 0) / summary.monthlyAiLimit) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho + Seletor de Período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Resultados &amp; Desempenho da IA
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Acompanhe quantas conversas sua atendente virtual resolveu, leads captados e tempo economizado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                days === d
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {d} dias
            </button>
          ))}
          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition"
            title="Atualizar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Conversas Ativas</span>
            <MessageSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">{summary.totalConversations ?? 0}</div>
          <span className="text-[11px] text-slate-500">Últimos {days} dias</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Respostas da IA</span>
            <Bot className="w-4 h-4 text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400">{summary.messagesAi ?? 0}</div>
          <span className="text-[11px] text-slate-500">
            {summary.messagesIn ?? 0} msgs recebidas
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Resolução Autônoma</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">{summary.aiResolutionRate ?? 100}%</div>
          <span className="text-[11px] text-slate-500">
            {summary.humanHandoffCount ?? 0} em atendimento humano
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Fora do Expediente</span>
            <Moon className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-300">{summary.afterHoursReplies ?? 0}</div>
          <span className="text-[11px] text-slate-500">Noite e fins de semana</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tempo Economizado</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-300">
            {summary.estimatedHoursSaved ?? 0}h
          </div>
          <span className="text-[11px] text-slate-500">Estimado da equipe</span>
        </div>
      </div>

      {/* Uso da Franquia Mensal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Consumo da franquia no mês atual ({summary.planName || 'Plano'})
            </span>
            <span className="font-mono text-slate-300">
              {summary.monthlyAiUsed ?? 0} / {summary.monthlyAiLimit ?? 0} respostas IA ({usagePct}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all ${
                usagePct >= 90 ? 'bg-rose-500' : usagePct >= 75 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('plans')}
            className="shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            Gerenciar plano
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Gráficos: Volume Diário + Horários de Pico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Diário */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Respostas Automáticas por Dia</h3>
              <p className="text-xs text-slate-400">Evolução diária no período selecionado</p>
            </div>
          </div>

          <div className="h-44 flex items-end gap-1 pt-4 border-b border-slate-800">
            {daily.slice(-30).map((d) => {
              const heightPct = Math.max(4, Math.round((d.aiReplies / maxDaily) * 100));
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-8 bg-slate-950 border border-slate-700 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10">
                    {d.label}: {d.aiReplies} IA • {d.conversations} conv.
                  </div>
                  <div
                    className={`w-full rounded-t transition-all ${
                      d.aiReplies > 0 ? 'bg-emerald-500/80 group-hover:bg-emerald-400' : 'bg-slate-800/60'
                    }`}
                    style={{ height: `${d.aiReplies > 0 ? heightPct : 4}%` }}
                  />
                </div>
              );
            })}
          </div>
          {daily.length > 0 && (
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{daily[Math.max(0, daily.length - 30)]?.label}</span>
              <span>Hoje ({daily[daily.length - 1]?.label})</span>
            </div>
          )}
        </div>

        {/* Gráfico Horários de Pico */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Horários de Maior Procura (00h–23h)</h3>
            <p className="text-xs text-slate-400">Quando seus clientes mais enviam mensagens no WhatsApp</p>
          </div>

          <div className="h-44 flex items-end gap-1 pt-4 border-b border-slate-800">
            {hourly.map((h) => {
              const heightPct = Math.max(4, Math.round((h.count / maxHourly) * 100));
              const isAfterHours = h.hour < 8 || h.hour >= 18;
              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-8 bg-slate-950 border border-slate-700 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10">
                    {h.label}: {h.count} mensagens
                  </div>
                  <div
                    className={`w-full rounded-t transition-all ${
                      h.count === 0
                        ? 'bg-slate-800/60'
                        : isAfterHours
                        ? 'bg-indigo-500/80 group-hover:bg-indigo-400'
                        : 'bg-teal-500/80 group-hover:bg-teal-400'
                    }`}
                    style={{ height: `${h.count > 0 ? heightPct : 4}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>00h</span>
            <span>08h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </div>
      </div>

      {/* Últimos Contatos / Leads + Exportar CSV */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Contatos &amp; Leads Recentes</h3>
            <p className="text-xs text-slate-400">
              Clientes que conversaram com seu WhatsApp recentemente
            </p>
          </div>

          <div className="flex items-center gap-2">
            {leads.length > 0 && (
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Exportar CSV
              </button>
            )}
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('chat')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition"
              >
                Abrir Live Chat
              </button>
            )}
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60">
            Nenhum atendimento registrado neste período ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-4 font-semibold">Cliente</th>
                  <th className="py-2.5 pr-4 font-semibold">WhatsApp</th>
                  <th className="py-2.5 pr-4 font-semibold">Modo</th>
                  <th className="py-2.5 pr-4 font-semibold">Última Mensagem</th>
                  <th className="py-2.5 font-semibold text-right">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 pr-4 font-semibold text-white">
                      {lead.contact_name || 'Sem nome'}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-slate-300">{lead.contact_phone}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lead.handling_status === 'HUMAN'
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {lead.handling_status === 'HUMAN' ? (
                          <>
                            <UserCheck className="w-3 h-3" /> Humano
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3" /> IA
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400 max-w-xs truncate">
                      {lead.last_message || '—'}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-500 whitespace-nowrap">
                      {lead.last_message_at
                        ? new Date(lead.last_message_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
