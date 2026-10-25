'use client';

import { authFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';

import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, CheckCircle2, AlertCircle, RefreshCw, LogOut, Send, Zap } from 'lucide-react';

interface WhatsAppConnectorProps {
  tenantId: string;
  tenantSlug: string;
  onStatusChange?: (isConnected: boolean) => void;
}

export default function WhatsAppConnector({ tenantId, tenantSlug, onStatusChange }: WhatsAppConnectorProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<'CONNECTED' | 'QRCODE' | 'DISCONNECTED' | 'IDLE'>('IDLE');
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string>('');
  const [testPhone, setTestPhone] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>('Olá! Este é um teste do atendente virtual ERBots.');
  const [testSending, setTestSending] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchStatus = async (action: 'STATUS' | 'CONNECT' = 'STATUS') => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/whatsapp/instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status);
        setQrcode(data.qrcode);
        setPhone(data.phone);
        setProfileName(data.profileName);
        setInstanceName(data.instanceName || `erbots_${tenantSlug}`);
        if (onStatusChange) {
          onStatusChange(data.status === 'CONNECTED');
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Deseja realmente desconectar este WhatsApp? O robô deixará de responder até uma nova leitura.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch('/api/whatsapp/instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, action: 'LOGOUT' }),
      });
      if (res.ok) {
        setStatus('DISCONNECTED');
        setQrcode(null);
        setPhone(null);
        if (onStatusChange) onStatusChange(false);
      }
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      alert('Digite o número com DDD para enviar o teste.');
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await authFetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          to_phone: testPhone,
          text: testMessage,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult('Mensagem de teste enviada com sucesso!');
      } else {
        setTestResult(`Falha ao enviar: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      setTestResult(`Erro: ${err?.message}`);
    } finally {
      setTestSending(false);
    }
  };

  useEffect(() => {
    fetchStatus('STATUS');
  }, [tenantId]);

  // Escuta mudanças em tempo real na tabela xerb_instances (ex.: leitura do QR Code ou desconexão)
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`wa-connector-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'xerb_instances',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;
          if (row.status === 'CONNECTED') {
            fetchStatus('STATUS');
          } else if (row.status === 'DISCONNECTED') {
            setStatus('DISCONNECTED');
            setQrcode(null);
            if (onStatusChange) onStatusChange(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  // Polling de contingência para detectar leitura do QR Code caso WebSocket oscile
  useEffect(() => {
    if (status === 'QRCODE') {
      const timer = setInterval(() => {
        fetchStatus('STATUS');
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [status, tenantId]);

  return (
    <div className="space-y-6">
      {/* Header do Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-emerald-400" />
              Conexão do WhatsApp
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Conecte o número de WhatsApp da sua empresa para ativar o atendimento 24 horas por dia.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchStatus('CONNECT')}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Status
            </button>
          </div>
        </div>

        {/* Corpo: Estados de Conexão */}
        <div className="pt-6">
          {status === 'CONNECTED' ? (
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Online e Respondendo
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {profileName || 'WhatsApp Comercial'}
                  </h3>
                  <p className="text-sm text-slate-400">
                    Número conectado: <span className="text-emerald-400 font-mono font-medium">{phone || 'Identificado'}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Instância: <span className="font-mono">{instanceName}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-sm font-semibold rounded-xl transition"
              >
                <LogOut className="w-4 h-4" />
                Desconectar Aparelho
              </button>
            </div>
          ) : status === 'QRCODE' && qrcode ? (
            <div className="flex flex-col lg:flex-row items-center justify-center gap-8 py-6">
              {/* QR Code */}
              <div className="bg-white p-4 rounded-2xl shadow-2xl border-4 border-emerald-500/30 flex flex-col items-center">
                <img
                  src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
                />
                <span className="text-xs text-slate-600 mt-2 font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" /> Atualização em tempo real
                </span>
              </div>

              {/* Instruções */}
              <div className="max-w-md space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
                  <QrCode className="w-4 h-4" /> Aguardando Leitura
                </div>
                <h3 className="text-xl font-bold text-white">Como conectar em 3 passos:</h3>
                <ol className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-700">1</span>
                    <span>Abra o <strong>WhatsApp</strong> no celular comercial da sua empresa.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-700">2</span>
                    <span>Acesse <strong>Configurações</strong> (ou os 3 pontinhos) &gt; <strong>Aparelhos Conectados</strong>.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-700">3</span>
                    <span>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code ao lado.</span>
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 px-4 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
                <AlertCircle className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Nenhum WhatsApp Conectado</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Clique no botão abaixo para gerar um QR Code exclusivo e parear o WhatsApp do seu negócio com a IA.
              </p>
              <button
                onClick={() => fetchStatus('CONNECT')}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
              >
                <Zap className="w-4 h-4 fill-current" />
                {loading ? 'Gerando QR Code...' : 'Gerar QR Code de Conexão'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card de Teste de Envio */}
      {status === 'CONNECTED' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-md font-bold text-white flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-emerald-400" />
            Teste de Disparo Direto
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Envie uma mensagem instantânea para o seu próprio número pessoal para verificar se o envio do robô está funcionando com perfeição.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="DDD + Número (ex: 11999998888)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Mensagem de teste"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 sm:col-span-1"
            />
            <button
              onClick={handleSendTest}
              disabled={testSending}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm rounded-xl transition disabled:opacity-50"
            >
              {testSending ? 'Disparando...' : 'Enviar Teste'}
            </button>
          </div>

          {testResult && (
            <p className="text-xs mt-3 text-slate-300 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
              {testResult}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
