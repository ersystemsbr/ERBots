'use client';

import { authFetch } from '@/lib/api-client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Bot, User, Send, RefreshCw, UserCheck, CheckCircle2 } from 'lucide-react';

interface Conversation {
  id: string;
  remote_jid: string;
  contact_name: string;
  contact_phone: string;
  handling_status: 'AI' | 'HUMAN' | 'CLOSED';
  last_message: string;
  last_message_at: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai' | 'human';
  content: string;
  created_at: string;
}

interface LiveChatProps {
  tenantId: string;
}

export default function LiveChat({ tenantId }: LiveChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('xerb_conversations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('last_message_at', { ascending: false });

      if (data) {
        setConversations(data);
        if (!selectedConvId && data.length > 0) {
          setSelectedConvId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
    } finally {
      setLoadingConvs(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('xerb_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 6000);
    return () => clearInterval(interval);
  }, [tenantId]);

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      const msgInterval = setInterval(() => {
        fetchMessages(selectedConvId);
      }, 4000);
      return () => clearInterval(msgInterval);
    }
  }, [selectedConvId]);

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  const handleToggleHandling = async () => {
    if (!selectedConv) return;
    const nextStatus = selectedConv.handling_status === 'AI' ? 'HUMAN' : 'AI';
    try {
      await supabase
        .from('xerb_conversations')
        .update({ handling_status: nextStatus })
        .eq('id', selectedConv.id);

      setConversations(
        conversations.map((c) => (c.id === selectedConv.id ? { ...c, handling_status: nextStatus } : c))
      );
    } catch (err) {
      alert('Erro ao alterar status de atendimento.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConv || sending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await authFetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          conversation_id: selectedConv.id,
          text: textToSend,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        alert(`Erro ao enviar mensagem: ${d.error || 'Falha no envio'}`);
      } else {
        fetchMessages(selectedConv.id);
        fetchConversations();
      }
    } catch (err: any) {
      alert(`Erro: ${err?.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row h-[720px]">
      {/* Coluna da Esquerda: Lista de Conversas */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            Atendimentos
          </h3>
          <button
            onClick={fetchConversations}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {loadingConvs ? (
            <div className="p-6 text-center text-xs text-slate-500">Carregando conversas...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhuma conversa registrada ainda. Quando alguém mandar mensagem para o seu WhatsApp, ela aparecerá aqui!
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const isAI = conv.handling_status === 'AI';

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-left p-4 transition flex flex-col gap-1.5 ${
                    isSelected ? 'bg-slate-800/90' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white truncate max-w-[170px]">
                      {conv.contact_name || conv.contact_phone}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                        isAI
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {isAI ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {isAI ? 'IA Atendendo' : 'Humano'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 truncate">{conv.last_message || 'Sem mensagens'}</p>

                  <span className="text-[10px] text-slate-500 self-end">
                    {conv.last_message_at
                      ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Coluna da Direita: Chat em Tempo Real */}
      <div className="flex-1 flex flex-col h-full bg-slate-950/40">
        {selectedConv ? (
          <>
            {/* Header do Chat Selecionado */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  {selectedConv.contact_name}
                  <span className="text-xs font-normal text-slate-400">({selectedConv.contact_phone})</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modo atual:{' '}
                  <strong className={selectedConv.handling_status === 'AI' ? 'text-emerald-400' : 'text-blue-400'}>
                    {selectedConv.handling_status === 'AI' ? 'Atendimento Automático por IA' : 'Atendente Humano'}
                  </strong>
                </p>
              </div>

              <button
                onClick={handleToggleHandling}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  selectedConv.handling_status === 'AI'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                {selectedConv.handling_status === 'AI' ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5" /> Assumir Atendimento
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5" /> Devolver para IA
                  </>
                )}
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages && messages.length === 0 ? (
                <div className="text-center text-xs text-slate-500 pt-8">Carregando histórico...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-slate-500 pt-8">Nenhuma mensagem nesta conversa.</div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  const isAi = msg.sender === 'ai';

                  return (
                    <div key={msg.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
                          isUser
                            ? 'bg-slate-800 text-slate-200 rounded-bl-none'
                            : isAi
                            ? 'bg-emerald-600 text-white rounded-br-none'
                            : 'bg-blue-600 text-white rounded-br-none'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] opacity-75 font-semibold">
                          {isUser ? (
                            <span>Cliente</span>
                          ) : isAi ? (
                            <span className="flex items-center gap-1">
                              <Bot className="w-3 h-3" /> IA ERBots
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" /> Atendente Humano
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                        <span className="text-[9px] opacity-60 mt-1 block text-right">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input para envio humano */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900/60 flex gap-2">
              <input
                type="text"
                placeholder={
                  selectedConv.handling_status === 'AI'
                    ? 'Digite para responder como humano (a conversa passará para modo humano)...'
                    : 'Digite sua mensagem para o cliente...'
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm p-8">
            <MessageSquare className="w-12 h-12 mb-2 text-slate-600" />
            Selecione uma conversa ao lado para acompanhar o atendimento em tempo real.
          </div>
        )}
      </div>
    </div>
  );
}
