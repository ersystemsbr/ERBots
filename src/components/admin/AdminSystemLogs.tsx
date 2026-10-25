'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle, Info, Trash2, RefreshCw, AlertOctagon } from 'lucide-react';
import { authFetch } from '@/lib/api-client';

interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  tenant_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export default function AdminSystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [clearing, setClearing] = useState<boolean>(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const qs = levelFilter === 'all' ? '?limit=40' : `?level=${levelFilter}&limit=40`;
      const res = await authFetch(`/api/admin/logs${qs}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setLoading(false);
    }
  }, [levelFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClear = async () => {
    if (!confirm('Deseja limpar o histórico de eventos do painel de monitoramento?')) return;
    setClearing(true);
    try {
      const res = await authFetch('/api/admin/logs', { method: 'DELETE' });
      if (res.ok) setLogs([]);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">Monitoramento de Eventos &amp; Erros</h3>
            <p className="text-xs text-slate-400">
              Quedas de WhatsApp, reconexões, falhas de envio e exceções do sistema (retenção automática de 30 dias)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'error', label: 'Erros' },
              { id: 'warn', label: 'Alertas' },
              { id: 'info', label: 'Info' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setLevelFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${
                levelFilter === f.id
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}

          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Atualizar logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {logs.length > 0 && (
            <button
              onClick={handleClear}
              disabled={clearing}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-medium transition"
              title="Limpar logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500">Carregando eventos...</div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800/60">
          Nenhum erro ou alerta registrado neste filtro. Tudo operando normalmente!
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-slate-950/60">
          {logs.map((log) => {
            const isErr = log.level === 'error';
            const isWarn = log.level === 'warn';
            return (
              <div key={log.id} className="p-3 text-xs flex flex-col gap-1 hover:bg-slate-900/50 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isErr
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : isWarn
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {isErr ? (
                        <AlertOctagon className="w-3 h-3" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <Info className="w-3 h-3" />
                      )}
                      {log.level.toUpperCase()}
                    </span>
                    <span className="font-mono text-slate-400 truncate">{log.source}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-slate-200 font-medium">{log.message}</p>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <pre className="mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
