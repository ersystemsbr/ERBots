'use client';

import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api-client';
import {
  Sparkles,
  Star,
  Flame,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  PhoneCall,
  Save,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface ReengagementManagerProps {
  tenantId: string;
}

export default function ReengagementManager({ tenantId }: ReengagementManagerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulário de Configurações
  const [settings, setSettings] = useState({
    nps_enabled: false,
    nps_delay_minutes: 40,
    google_maps_url: '',
    nps_custom_message: '',
    weekend_campaign_enabled: false,
    weekend_day: 5, // 5 = Sexta-feira
    weekend_time: '18:00',
    weekend_custom_message: '',
    inactive_reengagement_enabled: false,
    inactive_threshold_days: 20,
    inactive_custom_message: '',
  });

  const [stats, setStats] = useState({
    totalNpsSent: 0,
    totalNpsResponded: 0,
    avgRating: null as string | null,
  });

  const [recentNps, setRecentNps] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/tenant/reengagement?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.recentNps) {
          setRecentNps(data.recentNps);
        }
      }
    } catch (err) {
      console.error('[ReengagementManager] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) loadData();
  }, [tenantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedbackMsg(null);
    try {
      const res = await authFetch('/api/tenant/reengagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          settings,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({ type: 'success', text: 'Configurações de Vendas Ativas e Reengajamento salvas com sucesso!' });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao salvar configurações.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Falha na comunicação com o servidor.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm">Carregando painel de Vendas Ativas e Reengajamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner Superior de Destaque */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Flame className="w-3.5 h-3.5" />
              Máquina de Vendas Recorrentes
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Vendas Ativas & Reengajamento
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              O seu <strong className="text-white">iFood Próprio sem taxas</strong>: transforme clientes que já pediram em compradores recorrentes no WhatsApp e colete avaliações 5 estrelas no seu Google Maps automaticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar Métricas
          </button>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Star className="w-5 h-5 fill-emerald-400/30" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Nota Média NPS</p>
              <p className="text-xl font-bold text-white">
                {stats.avgRating ? `${stats.avgRating} / 5.0` : 'Ainda sem notas'}
              </p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Pesquisas Enviadas</p>
              <p className="text-xl font-bold text-white">{stats.totalNpsSent}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Respostas Recebidas</p>
              <p className="text-xl font-bold text-white">{stats.totalNpsResponded}</p>
            </div>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <div className="flex-1 font-medium">{feedbackMsg.text}</div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* CARD 1: NPS AUTOMÁTICO PÓS-ENTREGA */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Star className="w-5 h-5 fill-amber-400/20" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Pesquisa de Satisfação (NPS Pós-Entrega)
                </h3>
                <p className="text-xs text-slate-400">
                  Dispara automaticamente no WhatsApp do cliente após a confirmação de entrega do pedido.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.nps_enabled}
                onChange={(e) => setSettings({ ...settings, nps_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {settings.nps_enabled && (
            <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tempo de Espera após a Entrega
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={10}
                      max={180}
                      value={settings.nps_delay_minutes}
                      onChange={(e) =>
                        setSettings({ ...settings, nps_delay_minutes: Number(e.target.value) || 40 })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500">minutos</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Padrão: 40 minutos (tempo ideal para o cliente saborear a refeição).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Link do Google Maps / Google Meu Negócio (Opcional)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://g.page/r/... ou link da sua ficha no Maps"
                      value={settings.google_maps_url || ''}
                      onChange={(e) => setSettings({ ...settings, google_maps_url: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                    <MapPin className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Quem der nota 4 ou 5 recebe um convite com este link para avaliar no Google Maps!
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mensagem da Pesquisa de Satisfação (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Deixe em branco para usar o padrão automático do seu segmento. Variáveis disponíveis: {cliente}, {empresa}, {pedido}"
                  value={settings.nps_custom_message || ''}
                  onChange={(e) => setSettings({ ...settings, nps_custom_message: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Use as tags <code className="text-emerald-400">{"{cliente}"}</code>, <code className="text-emerald-400">{"{empresa}"}</code> e <code className="text-emerald-400">{"{pedido}"}</code> para personalizar.
                </p>
              </div>

              {/* Como Funciona a Proteção de Reputação */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-xs space-y-2">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Como o ERBots gerencia a reputação do seu restaurante:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-slate-400">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800/60">
                    <span className="text-emerald-400 font-bold block mb-1">⭐ Cliente deu Nota 4 ou 5:</span>
                    O robô agradece o elogio e convida o cliente a postar a mesma avaliação no perfil do seu Google Maps, impulsionando suas vendas orgânicas na cidade.
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800/60">
                    <span className="text-amber-400 font-bold block mb-1">⚠️ Cliente deu Nota 1, 2 ou 3:</span>
                    O robô acolhe com empatia e dispara um <strong className="text-white">Alerta Urgente no WhatsApp do Dono</strong> para reverter a insatisfação antes de virar reclamação pública!
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CARD 2: CAMPANHA DE FIM DE SEMANA ("SEXTOU!") */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Campanha Semanal de Fim de Semana ("Sextou!")
                </h3>
                <p className="text-xs text-slate-400">
                  Dispara uma mensagem amigável para quem comprou nas últimas 3 semanas para antecipar pedidos.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.weekend_campaign_enabled}
                onChange={(e) => setSettings({ ...settings, weekend_campaign_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
            </label>
          </div>

          {settings.weekend_campaign_enabled && (
            <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Dia do Disparo
                  </label>
                  <select
                    value={settings.weekend_day}
                    onChange={(e) => setSettings({ ...settings, weekend_day: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value={5}>Toda Sexta-feira (Recomendado para Restaurantes)</option>
                    <option value={6}>Todo Sábado</option>
                    <option value={4}>Toda Quinta-feira</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Horário de Início
                  </label>
                  <input
                    type="time"
                    value={settings.weekend_time || '18:00'}
                    onChange={(e) => setSettings({ ...settings, weekend_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cadência humanizada com pausa anti-ban automática entre os disparos.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mensagem Customizada do Fim de Semana (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Deixe em branco para usar o texto padrão profissional do seu segmento. Variáveis: {cliente}, {empresa}"
                  value={settings.weekend_custom_message || ''}
                  onChange={(e) => setSettings({ ...settings, weekend_custom_message: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Use as tags <code className="text-purple-400">{"{cliente}"}</code> e <code className="text-purple-400">{"{empresa}"}</code> para personalizar com o nome da sua empresa e do cliente.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CARD 3: RECUPERAÇÃO DE CLIENTES INATIVOS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Recuperação Automática de Inativos
                </h3>
                <p className="text-xs text-slate-400">
                  Detecta clientes que compravam com frequência e sumiram há mais de 20 dias, resgatando a venda.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.inactive_reengagement_enabled}
                onChange={(e) =>
                  setSettings({ ...settings, inactive_reengagement_enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          {settings.inactive_reengagement_enabled && (
            <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Dias sem pedir para considerar inativo
                </label>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    min={10}
                    max={60}
                    value={settings.inactive_threshold_days}
                    onChange={(e) =>
                      setSettings({ ...settings, inactive_threshold_days: Number(e.target.value) || 20 })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500">dias</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Se um cliente pediu no último mês e ficou 20 dias sem pedir nada, a IA manda uma mensagem acolhedora.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mensagem de Recuperação Customizada (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Deixe em branco para usar o padrão do seu segmento. Variáveis: {cliente}, {empresa}"
                  value={settings.inactive_custom_message || ''}
                  onChange={(e) => setSettings({ ...settings, inactive_custom_message: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Use as tags <code className="text-cyan-400">{"{cliente}"}</code> e <code className="text-cyan-400">{"{empresa}"}</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* TABELA DE FEEDBACKS E NPS RECENTES */}
        {recentNps && recentNps.length > 0 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              Últimas Pesquisas de Satisfação Enviadas
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 rounded-l-lg">Cliente</th>
                    <th className="p-3">Pedido</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 rounded-r-lg">Nota NPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {recentNps.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-medium text-white">{item.customer_name}</td>
                      <td className="p-3 text-slate-400">#{item.display_id}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            item.status === 'responded'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'sent'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.status === 'responded'
                            ? 'Respondido'
                            : item.status === 'sent'
                            ? 'Enviado'
                            : 'Agendado'}
                        </span>
                      </td>
                      <td className="p-3">
                        {item.rating ? (
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${
                              item.rating >= 4 ? 'text-amber-400' : 'text-rose-400'
                            }`}
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                            {item.rating} / 5
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">Aguardando</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Botão de Salvar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar Configurações de Vendas Ativas
          </button>
        </div>
      </form>
    </div>
  );
}
