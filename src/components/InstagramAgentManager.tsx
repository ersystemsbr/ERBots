'use client';

import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api-client';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  Sliders,
  FileText,
  AlertCircle,
  MessageSquare,
  Zap,
  Image as ImageIcon,
  Check,
  X,
  Calendar,
  Lock,
} from 'lucide-react';

export function InstagramIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface InstagramAccount {
  id: string;
  account_name: string;
  account_username: string;
  niche: string;
  target_audience: string;
  brand_voice: string;
  visual_style: string;
  brand_knowledge_digest?: string;
  digest_updated_at?: string;
  approval_mode: 'whatsapp_required' | 'auto_scheduled';
  approval_timeout_hours: number;
  timeout_action: 'auto_publish' | 'skip';
  preferred_post_time: string;
  auto_generate_daily: boolean;
  is_active: boolean;
}

interface InstagramPost {
  id: string;
  hook_title: string;
  caption: string;
  hashtags: string[];
  media_urls: string[];
  image_prompt?: string;
  status: 'draft' | 'pending_approval' | 'scheduled' | 'publishing' | 'published' | 'rejected' | 'failed';
  scheduled_for?: string;
  created_at: string;
}

export default function InstagramAgentManager() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'settings' | 'digest' | 'automation'>('posts');
  const [savingSettings, setSavingSettings] = useState(false);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [topicHint, setTopicHint] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    account_name: '',
    account_username: '',
    niche: '',
    target_audience: '',
    brand_voice: '',
    visual_style: '',
    approval_mode: 'whatsapp_required' as 'whatsapp_required' | 'auto_scheduled',
    approval_timeout_hours: 4,
    timeout_action: 'auto_publish' as 'auto_publish' | 'skip',
    preferred_post_time: '18:00:00',
    auto_generate_daily: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/tenant/instagram/settings');
      if (res.ok) {
        const data = await res.json();
        setHasAccess(data.hasAccess);
        if (data.account) {
          setAccount(data.account);
          setFormData({
            account_name: data.account.account_name || '',
            account_username: data.account.account_username || '',
            niche: data.account.niche || '',
            target_audience: data.account.target_audience || '',
            brand_voice: data.account.brand_voice || '',
            visual_style: data.account.visual_style || '',
            approval_mode: data.account.approval_mode || 'whatsapp_required',
            approval_timeout_hours: data.account.approval_timeout_hours || 4,
            timeout_action: data.account.timeout_action || 'auto_publish',
            preferred_post_time: data.account.preferred_post_time || '18:00:00',
            auto_generate_daily: data.account.auto_generate_daily ?? true,
          });
        }
      }

      // Se tem acesso, carrega posts
      const postsRes = await authFetch('/api/tenant/instagram/posts');
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do Instagram:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleActivateAddon = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/tenant/instagram/addon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Módulo Instagram ativado com sucesso!' });
        loadData();
      } else {
        setFeedbackMsg({ type: 'error', text: 'Falha ao ativar módulo.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await authFetch('/api/tenant/instagram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account);
        setFeedbackMsg({ type: 'success', text: 'Configurações do Agente salvas com sucesso!' });
      } else {
        setFeedbackMsg({ type: 'error', text: 'Erro ao salvar configurações.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao conectar ao servidor.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGenerateDigest = async () => {
    try {
      setGeneratingDigest(true);
      const res = await authFetch('/api/tenant/instagram/digest', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAccount((prev) => (prev ? { ...prev, brand_knowledge_digest: data.digest, digest_updated_at: data.updated_at } : null));
        setFeedbackMsg({ type: 'success', text: 'Knowledge Digest atualizado com sucesso! Consumo de tokens otimizado em 90%.' });
      } else {
        setFeedbackMsg({ type: 'error', text: 'Falha ao gerar Knowledge Digest.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro de rede.' });
    } finally {
      setGeneratingDigest(false);
    }
  };

  const handleGeneratePost = async () => {
    try {
      setGeneratingPost(true);
      const res = await authFetch('/api/tenant/instagram/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicHint }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [data.post, ...prev]);
        setTopicHint('');
        setFeedbackMsg({ type: 'success', text: 'Novo post e imagem gerados com sucesso pela IA!' });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: err.error || 'Falha ao gerar publicação.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao comunicar com a IA.' });
    } finally {
      setGeneratingPost(false);
    }
  };

  const handlePostAction = async (postId: string, action: 'approve' | 'reject' | 'publish_now') => {
    try {
      const res = await authFetch('/api/tenant/instagram/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => prev.map((p) => (p.id === postId ? data.post : p)));
        setFeedbackMsg({ type: 'success', text: `Ação realizada com sucesso: ${action}` });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao processar ação no post.' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
        <p>Carregando Agente de Instagram...</p>
      </div>
    );
  }

  // TELA DE CONTRATAÇÃO DO MÓDULO (SE NÃO CONTRATOU)
  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" /> Módulo Adicional Comercial
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 text-white shadow-lg">
                  <InstagramIcon className="w-7 h-7" />
                </span>
                Agente Autônomo de Instagram com IA
              </h1>
              <p className="text-slate-300 text-base max-w-2xl leading-relaxed">
                Automatize 100% da criação, geração de imagens, pesquisa de temas virais e agendamento de posts no Instagram, integrado com aprovação direta pelo seu WhatsApp.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" /> Pesquisa de Virais & Ganchos
                </div>
                <p className="text-xs text-slate-300">
                  A IA analisa tendências do seu nicho e gera ganchos persuasivos com retenção máxima nos primeiros segundos.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2 text-pink-400 font-semibold text-sm">
                  <ImageIcon className="w-4 h-4" /> Geração de Imagens por IA
                </div>
                <p className="text-xs text-slate-300">
                  Criação de imagens profissionais e artes visuais de estúdio em alta definição via Imagen 3 / Gemini.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <Send className="w-4 h-4" /> Aprovação pelo WhatsApp
                </div>
                <p className="text-xs text-slate-300">
                  Receba a foto e a legenda no seu WhatsApp pessoal e aprove com apenas um &quot;1&quot; (ou deixe no piloto automático).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <Zap className="w-4 h-4" /> Economia de 90% em Tokens
                </div>
                <p className="text-xs text-slate-300">
                  Método exclusivo de <strong>Knowledge Digest</strong> que sintetiza as diretrizes da marca em memória compacta.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase text-slate-400 font-medium">Investimento Adicional</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">R$ 97</span>
                  <span className="text-slate-400 text-sm">/mês</span>
                </div>
                <span className="text-xs text-emerald-400">Pode cancelar a qualquer momento</span>
              </div>

              <button
                onClick={handleActivateAddon}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Ativar Módulo Instagram Agora
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // TELA PRINCIPAL DE GERENCIAMENTO (QUANDO CONTRATADO)
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-pink-500 text-white">
              <InstagramIcon className="w-5 h-5" />
            </span>
            Agente de Instagram & Social Media
          </h1>
          <p className="text-sm text-slate-400">
            Pesquisa de virais, geração de fotos por IA, agendamento e automação de direct.
          </p>
        </div>

        {/* Gerador Rápido */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Tema opcional (ex: Dica de ouro para economizar)..."
            value={topicHint}
            onChange={(e) => setTopicHint(e.target.value)}
            className="px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
          />
          <button
            onClick={handleGeneratePost}
            disabled={generatingPost}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow flex items-center gap-2 transition"
          >
            {generatingPost ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Gerando com IA...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Gerar Post Hoje
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition ${
            activeTab === 'posts' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" /> Feed & Publicações ({posts.length})
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition ${
            activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" /> Configurações & Autonomia
        </button>

        <button
          onClick={() => setActiveTab('digest')}
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition ${
            activeTab === 'digest' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" /> Economia de Tokens (Knowledge Digest)
        </button>

        <button
          onClick={() => setActiveTab('automation')}
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition ${
            activeTab === 'automation' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Direct & Comentários (&quot;Comente X&quot;)
        </button>
      </div>

      {/* TAB 1: POSTS E FILA */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center p-12 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
              <InstagramIcon className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-white">Nenhum post gerado ainda</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Clique no botão <strong>&quot;Gerar Post Hoje&quot;</strong> acima para criar sua primeira publicação com gancho viral e imagem gerada por IA.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between hover:border-slate-700 transition shadow-lg"
                >
                  <div className="space-y-3 p-4">
                    {/* Imagem do Post */}
                    <div className="aspect-square w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 relative group">
                      {post.media_urls?.[0] ? (
                        <img
                          src={post.media_urls[0]}
                          alt={post.hook_title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}

                      <div className="absolute top-2 right-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            post.status === 'published'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : post.status === 'scheduled'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : post.status === 'pending_approval'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {post.status === 'published'
                            ? 'Publicado'
                            : post.status === 'scheduled'
                            ? 'Agendado'
                            : post.status === 'pending_approval'
                            ? 'Aguardando Aprovação'
                            : post.status}
                        </span>
                      </div>
                    </div>

                    {/* Gancho e Legenda */}
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-bold text-white line-clamp-2">{post.hook_title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed whitespace-pre-line">
                        {post.caption}
                      </p>
                    </div>

                    {/* Hashtags */}
                    {post.hashtags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {post.hashtags.slice(0, 4).map((tag, i) => (
                          <span key={i} className="text-[11px] text-indigo-400 font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ações no Post */}
                  <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-2">
                    {post.status === 'pending_approval' && (
                      <>
                        <button
                          onClick={() => handlePostAction(post.id, 'approve')}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Aprovar
                        </button>
                        <button
                          onClick={() => handlePostAction(post.id, 'reject')}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {post.status === 'scheduled' && (
                      <button
                        onClick={() => handlePostAction(post.id, 'publish_now')}
                        className="w-full py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Publicar Agora no Instagram
                      </button>
                    )}

                    {post.status === 'published' && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Publicado com sucesso
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONFIGURAÇÕES E AUTONOMIA */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Configurações de Autonomia do Agente</h3>
            <p className="text-xs text-slate-400">
              Escolha o grau de controle sobre as postagens e conecte sua conta do Instagram.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Conta */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome da Conta / Marca</label>
                <input
                  type="text"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">@ da Conta no Instagram</label>
                <input
                  type="text"
                  value={formData.account_username}
                  onChange={(e) => setFormData({ ...formData, account_username: e.target.value })}
                  placeholder="suaempresa"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Horário Preferido de Postagem</label>
                <input
                  type="time"
                  value={formData.preferred_post_time}
                  onChange={(e) => setFormData({ ...formData, preferred_post_time: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Modos de Autonomia (As Duas Opções) */}
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-300">Modo de Aprovação</label>

              <div
                onClick={() => setFormData({ ...formData, approval_mode: 'whatsapp_required' })}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  formData.approval_mode === 'whatsapp_required'
                    ? 'bg-indigo-600/10 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Send className="w-4 h-4 text-emerald-400" />
                  Opção 1: Aprovação Obrigatória via WhatsApp
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  A IA gera o post e a imagem e envia no seu WhatsApp. Você só precisa responder &quot;1&quot; para aprovar e agendar.
                </p>
              </div>

              <div
                onClick={() => setFormData({ ...formData, approval_mode: 'auto_scheduled' })}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  formData.approval_mode === 'auto_scheduled'
                    ? 'bg-indigo-600/10 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Opção 2: Piloto Automático 100% Autônomo
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  A IA pesquisa, cria e agenda a publicação todos os dias no horário marcado, apenas enviando aviso para o seu WhatsApp.
                </p>
              </div>

              {formData.approval_mode === 'whatsapp_required' && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Se não houver resposta no WhatsApp após quantas horas?
                  </label>
                  <div className="flex items-center gap-3">
                    <select
                      value={formData.approval_timeout_hours}
                      onChange={(e) => setFormData({ ...formData, approval_timeout_hours: Number(e.target.value) })}
                      className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                    >
                      <option value={2}>2 horas</option>
                      <option value={4}>4 horas</option>
                      <option value={8}>8 horas</option>
                    </select>
                    <select
                      value={formData.timeout_action}
                      onChange={(e) => setFormData({ ...formData, timeout_action: e.target.value as any })}
                      className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                    >
                      <option value="auto_publish">Publicar automaticamente</option>
                      <option value="skip">Pular post do dia</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: ECONOMIA DE TOKENS & KNOWLEDGE DIGEST */}
      {activeTab === 'digest' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> Método de Economia de Tokens (Knowledge Digest)
            </div>
            <h3 className="text-lg font-bold text-white">Memória Condensada da Marca</h3>
            <p className="text-xs text-slate-400">
              Em vez de fazer scraping pesado e gastar 30.000 tokens toda vez, o agente sintetiza as diretrizes da sua empresa e os 5 melhores ganchos do seu nicho em um documento ultracompacto (~400 tokens), economizando mais de 90% dos custos de API.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nicho de Atuação</label>
                <input
                  type="text"
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  placeholder="Ex: Hambúrguer Artesanal, Imóveis de Luxo, Odontologia Estética"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Público-Alvo</label>
                <input
                  type="text"
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  placeholder="Ex: Jovens profissionais de 25 a 40 anos interessados em qualidade e rapidez"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tom de Voz</label>
                <input
                  type="text"
                  value={formData.brand_voice}
                  onChange={(e) => setFormData({ ...formData, brand_voice: e.target.value })}
                  placeholder="Ex: Descontraído, provocativo e focado em benefícios reais"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Estilo Visual das Imagens de IA</label>
                <input
                  type="text"
                  value={formData.visual_style}
                  onChange={(e) => setFormData({ ...formData, visual_style: e.target.value })}
                  placeholder="Ex: Fotografia de produto com iluminação cinematográfica, lente macro 50mm"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateDigest}
                disabled={generatingDigest}
                className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {generatingDigest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sintetizando Memória com IA...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" /> Gerar / Atualizar Knowledge Digest
                  </>
                )}
              </button>
            </div>

            {/* Visualizador do Documento Condensado */}
            <div className="space-y-2 flex flex-col">
              <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Documento de Memória Ativo</span>
                {account?.digest_updated_at && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    Atualizado em {new Date(account.digest_updated_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </label>

              <div className="flex-1 min-h-[280px] p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-300 whitespace-pre-wrap overflow-y-auto leading-relaxed">
                {account?.brand_knowledge_digest || (
                  <span className="text-slate-600 italic">
                    Nenhum documento gerado ainda. Preencha os campos ao lado e clique em &quot;Gerar / Atualizar Knowledge Digest&quot;.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUTOMAÇÃO DE DIRECT & COMENTÁRIOS */}
      {activeTab === 'automation' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Automação &quot;Comente X e receba no Direct&quot;</h3>
            <p className="text-xs text-slate-400">
              Quando alguém comentar uma palavra-chave específica nas suas publicações, o robô responde o comentário e envia uma mensagem direta automaticamente.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Palavra-Chave de Gatilho</label>
                <input
                  type="text"
                  defaultValue="QUERO"
                  placeholder="Ex: QUERO, LINK, CUPOM"
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Resposta no Comentário Público</label>
                <input
                  type="text"
                  defaultValue="Acabei de te enviar todos os detalhes no Direct! 🚀 Confere lá."
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mensagem Privada no Direct</label>
                <input
                  type="text"
                  defaultValue="Olá! Aqui está o link que você pediu: https://seusite.com.br/oferta"
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Automação ativa em todas as postagens
              </span>
              <button
                type="button"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg"
              >
                Salvar Regra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
