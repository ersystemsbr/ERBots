'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import {
  Server,
  Activity,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Cpu,
  Smartphone,
} from 'lucide-react';

interface MonitorData {
  timestamp: string;
  evolution: {
    configured: boolean;
    reachable: boolean;
    latencyMs: number;
    apiUrl: string;
    totalInstances: number;
    openInstances: number;
    closedInstances: number;
    erbotsInstances: number;
    gastrosysInstances: number;
    testInstances: number;
    instances: Array<{
      name: string;
      state: string;
      profileName: string | null;
      ownerJid: string | null;
    }>;
  };
  supabase: {
    reachable: boolean;
    latencyMs: number;
    tenantsCount: number;
    totalMessages: number;
  };
  gemini: {
    configured: boolean;
    modelPrimary: string;
    modelFallback: string;
  };
  asaas: {
    configured: boolean;
    environment: string;
  };
  guardian: {
    active: boolean;
    notifierInstance: string | null;
    alertPhone: string;
  };
}

export default function AdminServerMonitor() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cleaning, setCleaning] = useState<boolean>(false);
  const [testingAlert, setTestingAlert] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await authFetch('/api/admin/monitor');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Falha ao carregar monitor:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => loadData(false), 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleCleanup = async (specificInstance?: string) => {
    const confirmMsg = specificInstance
      ? `Deseja realmente deletar a instância "${specificInstance}" do servidor?`
      : 'Deseja remover todas as instâncias de teste e órfãs desconectadas do servidor Linux?';
    if (!window.confirm(confirmMsg)) return;

    setCleaning(true);
    setFeedback(null);
    try {
      const res = await authFetch('/api/admin/instances/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specificInstance ? { instanceName: specificInstance } : {}),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Falha ao executar limpeza.');

      setFeedback({
        type: 'success',
        message: specificInstance
          ? `Instância "${specificInstance}" removida com sucesso.`
          : `Limpeza concluída! ${result.deletedCount || 0} instância(s) zumbi(s) removida(s).`,
      });
      await loadData(false);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao limpar instâncias.' });
    } finally {
      setCleaning(false);
    }
  };

  const handleTestAlert = async () => {
    setTestingAlert(true);
    setFeedback(null);
    try {
      const res = await authFetch('/api/admin/guardian/test-alert', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Falha ao disparar alerta.');

      setFeedback({
        type: 'success',
        message: `Alerta enviado com sucesso para ${result.targetPhone} via instância ${result.notifier}! Verifique seu WhatsApp.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao enviar alerta.' });
    } finally {
      setTestingAlert(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
        Carregando telemetria e status do servidor...
      </div>
    );
  }

  const evo = data?.evolution;
  const sb = data?.supabase;
  const ai = data?.gemini;
  const guard = data?.guardian;

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Monitor */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-white">Monitor de Servidor & Guardião WhatsApp</h3>
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Tempo Real
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Status operacional do servidor Linux (vaio-server), instâncias Evolution API, banco Supabase e sentinela WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer mr-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
            />
            Auto-atualizar (15s)
          </label>

          <button
            onClick={() => loadData(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition"
            title="Atualizar métricas agora"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Banner de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-75 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Cards de Status do Servidor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Evolution API */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              Evolution Gateway
            </span>
            {evo?.reachable ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                ONLINE • {evo.latencyMs}ms
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                OFFLINE
              </span>
            )}
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {evo?.openInstances ?? 0}{' '}
              <span className="text-xs font-normal text-slate-400">/ {evo?.totalInstances ?? 0} ativas</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate" title={evo?.apiUrl}>
              {evo?.apiUrl || 'URL não definida'}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>ERBots: {evo?.erbotsInstances ?? 0}</span>
            <span>GastroSys: {evo?.gastrosysInstances ?? 0}</span>
            <span className={evo?.testInstances ? 'text-amber-400 font-semibold' : ''}>
              Zumbis: {evo?.closedInstances ?? 0}
            </span>
          </div>
        </div>

        {/* Card 2: Supabase */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-400" />
              Banco Supabase
            </span>
            {sb?.reachable ? (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                ONLINE • {sb.latencyMs}ms
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                OFFLINE
              </span>
            )}
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {sb?.tenantsCount ?? 0}{' '}
              <span className="text-xs font-normal text-slate-400">empresas</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Histórico com <strong>{sb?.totalMessages?.toLocaleString('pt-BR') ?? 0}</strong> mensagens
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Postgres + Auth</span>
            <span className="text-emerald-400 font-medium">Conectado</span>
          </div>
        </div>

        {/* Card 3: Gemini AI */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-purple-400" />
              Gemini AI
            </span>
            {ai?.configured ? (
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold">
                OPERACIONAL
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                NÃO CONFIGURADO
              </span>
            )}
          </div>
          <div>
            <div className="text-sm font-bold text-white font-mono truncate">
              {ai?.modelPrimary || 'gemini-3.5-flash-lite'}
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              Fallback: <span className="font-mono">{ai?.modelFallback || 'gemini-3.6-flash'}</span>
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Alta velocidade</span>
            <span className="text-purple-400 font-medium">Google AI</span>
          </div>
        </div>

        {/* Card 4: Guardião WhatsApp */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Guardião WhatsApp
            </span>
            {guard?.active ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                ATIVO
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                STANDBY
              </span>
            )}
          </div>
          <div>
            <div className="text-sm font-bold text-white truncate" title={guard?.notifierInstance || ''}>
              {guard?.notifierInstance || 'Nenhuma instância'}
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              Alerta: <strong>{guard?.alertPhone || 'N/D'}</strong>
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Transbordo + Quedas</span>
            <span className="text-emerald-400 font-medium">24/7 Ativo</span>
          </div>
        </div>
      </div>

      {/* Barra de Ações Rápidas */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white">Ações de Manutenção & Teste</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Recupere memória do servidor Linux e teste a entrega de mensagens no WhatsApp do Gestor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleTestAlert}
            disabled={testingAlert}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 ${testingAlert ? 'animate-bounce' : ''}`} />
            {testingAlert ? 'Enviando Alerta...' : 'Testar Alerta no WhatsApp do Gestor'}
          </button>

          <button
            onClick={() => handleCleanup()}
            disabled={cleaning || !evo?.closedInstances}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition disabled:opacity-50"
          >
            <Trash2 className={`w-3.5 h-3.5 ${cleaning ? 'animate-spin' : ''}`} />
            {cleaning ? 'Limpando...' : `Limpar Instâncias Zumbis (${evo?.closedInstances ?? 0})`}
          </button>
        </div>
      </div>

      {/* Tabela de Instâncias no Servidor */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              Instâncias no Gateway Evolution API
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Todas as sessões carregadas na memória do servidor Linux e seu estado atual de conexão.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Total: <strong>{evo?.instances?.length ?? 0}</strong> instâncias
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Instância</th>
                <th className="py-3 px-4">Aplicação</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Perfil / Número</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {!evo?.instances?.length ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Nenhuma instância encontrada na Evolution API.
                  </td>
                </tr>
              ) : (
                evo.instances.map((inst) => {
                  const isErbots = inst.name.startsWith('erbots_');
                  const isGastrosys = inst.name.startsWith('gastrosys_');
                  const isOpen = inst.state.toLowerCase() === 'open';
                  const isConnecting = inst.state.toLowerCase() === 'connecting';
                  const phoneFormatted = inst.ownerJid
                    ? inst.ownerJid.replace('@s.whatsapp.net', '')
                    : '—';

                  return (
                    <tr key={inst.name} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-bold text-white">{inst.name}</td>
                      <td className="py-3 px-4">
                        {isErbots ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-sans font-semibold">
                            ERBots
                          </span>
                        ) : isGastrosys ? (
                          <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-sans font-semibold">
                            GastroSys
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-sans">
                            Teste / Outro
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-sans font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Conectado
                          </span>
                        ) : isConnecting ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-sans font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Conectando
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-sans font-bold">
                            <XCircle className="w-3 h-3" />
                            Desconectado
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        {inst.profileName ? (
                          <div>
                            <span className="font-semibold text-white">{inst.profileName}</span>
                            <span className="text-slate-500 block text-[11px] font-mono">{phoneFormatted}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">{phoneFormatted}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isOpen && !isGastrosys && (
                          <button
                            onClick={() => handleCleanup(inst.name)}
                            disabled={cleaning}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                            title={`Remover ${inst.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
