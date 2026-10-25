'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { authFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import {
  MessageSquare,
  Bot,
  User,
  Send,
  RefreshCw,
  UserCheck,
  Search,
  Volume2,
  VolumeX,
  ArrowLeft,
  Radio,
} from 'lucide-react';

interface Conversation {
  id: string;
  tenant_id?: string;
  remote_jid: string;
  contact_name: string;
  contact_phone: string;
  handling_status: 'AI' | 'HUMAN' | 'CLOSED';
  last_message: string;
  last_message_at: string;
  unread_count?: number;
}

interface Message {
  id: string;
  conversation_id?: string;
  sender: 'user' | 'ai' | 'human';
  content: string;
  created_at: string;
}

interface LiveChatProps {
  tenantId: string;
}

function playNotificationBeep() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.23);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    // Navegador pode bloquear áudio antes da primeira interação
  }
}

export default function LiveChat({ tenantId }: LiveChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'HUMAN' | 'AI'>('ALL');
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<string | null>(null);
  const soundEnabledRef = useRef<boolean>(true);

  useEffect(() => {
    selectedConvRef.current = selectedConvId;
  }, [selectedConvId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('erbots_chat_sound');
      if (saved === 'off') {
        setSoundEnabled(false);
        soundEnabledRef.current = false;
      }
    }
  }, []);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEnabledRef.current = next;
      if (typeof window !== 'undefined') {
        localStorage.setItem('erbots_chat_sound', next ? 'on' : 'off');
      }
      if (next) playNotificationBeep();
      return next;
    });
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const markConversationRead = useCallback(async (convId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId && (c.unread_count || 0) > 0 ? { ...c, unread_count: 0 } : c))
    );
    try {
      await supabase.from('xerb_conversations').update({ unread_count: 0 }).eq('id', convId);
    } catch {
      // Silencioso
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await supabase
        .from('xerb_conversations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('last_message_at', { ascending: false })
        .limit(150);

      if (data) {
        setConversations(data);
        setSelectedConvId((curr) => curr || (data.length > 0 ? data[0].id : null));
      }
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
    } finally {
      setLoadingConvs(false);
    }
  }, [tenantId]);

  const fetchMessages = useCallback(
    async (convId: string, showSpinner = false) => {
      if (showSpinner) setLoadingMessages(true);
      try {
        const { data } = await supabase
          .from('xerb_messages')
          .select('id, conversation_id, sender, content, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(200);

        if (data) {
          setMessages(data);
          setTimeout(scrollToBottom, 80);
        }
      } catch (err) {
        console.error('Erro ao buscar mensagens:', err);
      } finally {
        if (showSpinner) setLoadingMessages(false);
      }
    },
    [scrollToBottom]
  );

  // 1. Carrega conversas iniciais + assina Supabase Realtime para xerb_conversations
  useEffect(() => {
    if (!tenantId) return;
    fetchConversations();

    const convChannel = supabase
      .channel(`livechat-convs-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'xerb_conversations',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow: any = payload.old;
            if (oldRow?.id) {
              setConversations((prev) => prev.filter((c) => c.id !== oldRow.id));
            }
            return;
          }

          const updated = payload.new as Conversation;
          if (!updated?.id) return;

          const isActiveOpen = selectedConvRef.current === updated.id;

          setConversations((prev) => {
            const prevConv = prev.find((c) => c.id === updated.id);
            // Toca som se entrou em modo HUMAN ou aumentou unread_count
            if (
              soundEnabledRef.current &&
              ((!prevConv && (updated.unread_count || 0) > 0) ||
                (prevConv && (updated.unread_count || 0) > (prevConv.unread_count || 0)) ||
                (prevConv && prevConv.handling_status !== 'HUMAN' && updated.handling_status === 'HUMAN'))
            ) {
              playNotificationBeep();
            }

            const mergedRow = isActiveOpen ? { ...updated, unread_count: 0 } : updated;
            const others = prev.filter((c) => c.id !== updated.id);
            return [mergedRow, ...others].sort(
              (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
            );
          });

          if (isActiveOpen && (updated.unread_count || 0) > 0) {
            supabase
              .from('xerb_conversations')
              .update({ unread_count: 0 })
              .eq('id', updated.id)
              .then(() => {});
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(convChannel);
    };
  }, [tenantId, fetchConversations]);

  // 2. Carrega mensagens da conversa selecionada + assina Supabase Realtime para xerb_messages
  useEffect(() => {
    if (!selectedConvId) return;
    fetchMessages(selectedConvId, true);
    markConversationRead(selectedConvId);

    const msgChannel = supabase
      .channel(`livechat-msgs-${selectedConvId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'xerb_messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow: any = payload.old;
            if (oldRow?.id) {
              setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
            }
            return;
          }
          const incoming = payload.new as Message;
          if (!incoming?.id) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          setTimeout(scrollToBottom, 60);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [selectedConvId, fetchMessages, markConversationRead, scrollToBottom]);

  // 3. Fallback leve (apenas se o WebSocket Realtime não estiver conectado)
  useEffect(() => {
    if (realtimeConnected || !tenantId) return;
    const fallbackTimer = setInterval(() => {
      fetchConversations();
      if (selectedConvRef.current) fetchMessages(selectedConvRef.current, false);
    }, 15000);
    return () => clearInterval(fallbackTimer);
  }, [realtimeConnected, tenantId, fetchConversations, fetchMessages]);

  const humanWaitingCount = useMemo(
    () => conversations.filter((c) => c.handling_status === 'HUMAN').length,
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filterMode === 'HUMAN' && c.handling_status !== 'HUMAN') return false;
      if (filterMode === 'AI' && c.handling_status !== 'AI') return false;
      if (!q) return true;
      return (
        (c.contact_name || '').toLowerCase().includes(q) ||
        (c.contact_phone || '').toLowerCase().includes(q) ||
        (c.last_message || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, filterMode, searchTerm]);

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  const handleSelectConversation = (convId: string) => {
    setSelectedConvId(convId);
    setMobileShowChat(true);
    setErrorBanner(null);
  };

  const handleToggleHandling = async () => {
    if (!selectedConv) return;
    const nextStatus = selectedConv.handling_status === 'AI' ? 'HUMAN' : 'AI';
    try {
      const { error } = await supabase
        .from('xerb_conversations')
        .update({ handling_status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', selectedConv.id);
      if (error) throw error;

      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConv.id ? { ...c, handling_status: nextStatus } : c))
      );
    } catch {
      setErrorBanner('Não foi possível alterar o modo de atendimento.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConv || sending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);
    setErrorBanner(null);

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
        setErrorBanner(d.error || 'Falha ao enviar mensagem pelo WhatsApp.');
        setInputText(textToSend);
      } else if (!realtimeConnected) {
        fetchMessages(selectedConv.id, false);
        fetchConversations();
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Erro de conexão ao enviar mensagem.');
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row h-[calc(100vh-180px)] min-h-[560px] max-h-[780px]">
      {/* Coluna da Esquerda: Lista de Conversas */}
      <div
        className={`w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-800 flex-col h-full ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <h3 className="text-md font-bold text-white">Atendimentos</h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  realtimeConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
                title={
                  realtimeConnected
                    ? 'Conectado via WebSocket (Supabase Realtime)'
                    : 'Reconectando canal em tempo real...'
                }
              >
                <Radio className="w-2.5 h-2.5" />
                {realtimeConnected ? 'Ao vivo' : 'Sincronizando'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleSound}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title={soundEnabled ? 'Som de notificação ativado' : 'Som silenciado'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                onClick={fetchConversations}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="Atualizar lista"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar nome, telefone ou mensagem..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`py-1.5 rounded-lg font-semibold transition ${
                filterMode === 'ALL'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({conversations.length})
            </button>
            <button
              onClick={() => setFilterMode('HUMAN')}
              className={`py-1.5 rounded-lg font-semibold transition flex items-center justify-center gap-1 ${
                filterMode === 'HUMAN'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Humano
              {humanWaitingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-slate-950 text-[10px] font-extrabold">
                  {humanWaitingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilterMode('AI')}
              className={`py-1.5 rounded-lg font-semibold transition ${
                filterMode === 'AI'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              IA
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {loadingConvs ? (
            <div className="p-6 text-center text-xs text-slate-500">Carregando conversas...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              {conversations.length === 0
                ? 'Nenhuma conversa registrada ainda. Quando alguém mandar mensagem para o seu WhatsApp, ela aparecerá aqui instantaneamente!'
                : 'Nenhuma conversa encontrada para este filtro.'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const isAI = conv.handling_status === 'AI';
              const unread = conv.unread_count || 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full text-left p-4 transition flex flex-col gap-1.5 ${
                    isSelected ? 'bg-slate-800/90' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {conv.contact_name || conv.contact_phone}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {unread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          isAI
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {isAI ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {isAI ? 'IA' : 'Humano'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 truncate">{conv.last_message || 'Sem mensagens'}</p>

                  <span className="text-[10px] text-slate-500 self-end">
                    {conv.last_message_at
                      ? new Date(conv.last_message_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Coluna da Direita: Chat em Tempo Real */}
      <div
        className={`flex-1 flex-col h-full bg-slate-950/40 ${
          mobileShowChat ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedConv ? (
          <>
            {/* Header do Chat Selecionado */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  title="Voltar para conversas"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                    <span className="truncate">{selectedConv.contact_name}</span>
                    <span className="text-xs font-normal text-slate-400 shrink-0">
                      ({selectedConv.contact_phone})
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Modo atual:{' '}
                    <strong className={selectedConv.handling_status === 'AI' ? 'text-emerald-400' : 'text-blue-400'}>
                      {selectedConv.handling_status === 'AI'
                        ? 'Atendimento Automático por IA'
                        : 'Atendente Humano'}
                    </strong>
                  </p>
                </div>
              </div>

              <button
                onClick={handleToggleHandling}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  selectedConv.handling_status === 'AI'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                {selectedConv.handling_status === 'AI' ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5" /> Assumir
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5" /> Devolver à IA
                  </>
                )}
              </button>
            </div>

            {errorBanner && (
              <div className="px-4 py-2 bg-rose-500/15 border-b border-rose-500/30 text-xs text-rose-200 flex items-center justify-between">
                <span>{errorBanner}</span>
                <button onClick={() => setErrorBanner(null)} className="text-rose-300 font-bold ml-3">
                  ✕
                </button>
              </div>
            )}

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
                        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
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
                        <p className="whitespace-pre-line leading-relaxed break-words">{msg.content}</p>
                        <span className="text-[9px] opacity-60 mt-1 block text-right">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
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
                    ? 'Digite para responder como humano (a IA será pausada nesta conversa)...'
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
                <span className="hidden sm:inline">{sending ? 'Enviando...' : 'Enviar'}</span>
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
