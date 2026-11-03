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
  Share2,
  Copy,
  ExternalLink,
  Film,
  Layers,
  Flame,
  ArrowRight,
  UserCheck,
  Download,
  Play,
  TrendingUp,
  Target,
  Smartphone,
  ChevronDown,
  Trash2,
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
  instagram_business_id?: string;
  access_token?: string;
}

interface ReelBeat {
  time: string;
  visual: string;
  speech: string;
}

interface CarouselSlide {
  slide_number: number;
  title: string;
  content: string;
}

interface InstagramPost {
  id: string;
  post_type: 'single_image' | 'carousel' | 'reel_script';
  hook_title: string;
  caption: string;
  hashtags: string[];
  media_urls: string[];
  image_prompt?: string;
  visual_notes?: string;
  status: 'draft' | 'pending_approval' | 'scheduled' | 'publishing' | 'published' | 'rejected' | 'failed';
  scheduled_for?: string;
  created_at: string;
  metrics?: {
    likes?: number;
    comments?: number;
    reach?: number;
    saves?: number;
    hook_score?: number;
    reel_script?: {
      hook_3s: string;
      beat_sheet: ReelBeat[];
      on_screen_text: string[];
    };
    carousel_slides?: CarouselSlide[];
  };
}

interface WeeklyPlanItem {
  day: string;
  pillar: string;
  format: string;
  hook_title: string;
  key_message: string;
  cta: string;
}

interface ViralAnalysis {
  source_topic: string;
  hook_breakdown: {
    hook_type: string;
    why_it_worked: string;
    retention_factor: string;
    emotional_trigger: string;
  };
  new_script: {
    title: string;
    hook_3s: string;
    on_screen_text: string[];
    beat_sheet: ReelBeat[];
    caption: string;
    cta: string;
    virality_score: number;
  };
}

interface ProfileAudit {
  score: number;
  headline_evaluation: string;
  strengths: string[];
  improvements: string[];
  suggested_bio: string;
  suggested_name_field: string;
  cta_link_suggestion: string;
}

export default function InstagramAgentManager() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);

  // 3 Motores Principais + 1 Gaveta de Estratégia
  const [activeTab, setActiveTab] = useState<'create' | 'viral' | 'plan' | 'settings'>('create');

  // Estados de Geração
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatingViral, setGeneratingViral] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [auditingProfile, setAuditingProfile] = useState(false);
  const [generatingComments, setGeneratingComments] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Inputs
  const [topicHint, setTopicHint] = useState('');
  const [postFormat, setPostFormat] = useState<'single_image' | 'reel_script' | 'carousel'>('single_image');
  const [viralReferenceInput, setViralReferenceInput] = useState('');
  const [viralResult, setViralResult] = useState<ViralAnalysis | null>(null);
  const [currentBioInput, setCurrentBioInput] = useState('');
  const [auditResult, setAuditResult] = useState<ProfileAudit | null>(null);
  const [competitorText, setCompetitorText] = useState('');
  const [generatedComments, setGeneratedComments] = useState<string[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanItem[]>([]);

  // Notificações e Cópia
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Conexão Meta Graph API
  const [metaBusinessId, setMetaBusinessId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const [isMetaConnected, setIsMetaConnected] = useState(false);

  // Configuração
  const [formData, setFormData] = useState({
    account_name: '',
    account_username: '',
    niche: 'Comércio & Serviços',
    target_audience: 'Clientes locais e interessados em novidades e ofertas',
    brand_voice: 'Profissional, acolhedor e focado em benefícios práticos',
    visual_style: 'Fotografia realista, iluminação de estúdio limpa, cores vivas e estética profissional',
    approval_mode: 'whatsapp_required' as 'whatsapp_required' | 'auto_scheduled',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/tenant/instagram/settings');
      if (res.ok) {
        const data = await res.json();
        setHasAccess(data.hasAccess !== false);
        if (data.account) {
          setAccount(data.account);
          if (data.account.instagram_business_id && data.account.access_token) {
            setIsMetaConnected(true);
            setMetaBusinessId(data.account.instagram_business_id);
          }
          setFormData({
            account_name: data.account.account_name || '',
            account_username: data.account.account_username || '',
            niche: data.account.niche || 'Comércio & Serviços',
            target_audience: data.account.target_audience || '',
            brand_voice: data.account.brand_voice || '',
            visual_style: data.account.visual_style || '',
            approval_mode: data.account.approval_mode || 'whatsapp_required',
          });
        }
      }

      const postsRes = await authFetch('/api/tenant/instagram/posts');
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        const list = postsData.posts || [];
        setPosts(list);
        if (list.length > 0 && !selectedPost) {
          setSelectedPost(list[0]);
        }
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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleGeneratePost = async () => {
    try {
      setGeneratingPost(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/instagram/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicHint, format: postFormat }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [data.post, ...prev]);
        setSelectedPost(data.post);
        setTopicHint('');
        setFeedbackMsg({
          type: 'success',
          text: `Publicação gerada com sucesso pela IA! Gancho com nota ${data.details?.hook_score || 94}/100.`,
        });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: err.error || 'Falha ao gerar post com a IA.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão ao gerar o post.' });
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleGenerateViral = async () => {
    if (!viralReferenceInput.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe um tema, gancho ou link de referência viral.' });
      return;
    }
    try {
      setGeneratingViral(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/instagram/viral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viralReference: viralReferenceInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setViralResult(data.analysis);
        setFeedbackMsg({ type: 'success', text: 'Raio-X concluído! Roteiro viral inédito gerado.' });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: err.error || 'Erro ao analisar referência viral.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao conectar à IA para dissecação viral.' });
    } finally {
      setGeneratingViral(false);
    }
  };

  const handleGeneratePlan = async () => {
    try {
      setGeneratingPlan(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/instagram/plan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setWeeklyPlan(data.plan || []);
        setFeedbackMsg({ type: 'success', text: 'Grade de 7 dias criada nos 4 pilares estratégicos!' });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: err.error || 'Erro ao gerar planejamento semanal.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao gerar planejamento semanal.' });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleAuditProfile = async () => {
    try {
      setAuditingProfile(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/instagram/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentBio: currentBioInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditResult(data.audit);
        setFeedbackMsg({ type: 'success', text: `Diagnóstico pronto! Nota do perfil: ${data.audit.score}/100.` });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: err.error || 'Erro ao auditar perfil.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao conectar com a IA.' });
    } finally {
      setAuditingProfile(false);
    }
  };

  const handleGenerateComments = async () => {
    if (!competitorText.trim()) return;
    try {
      setGeneratingComments(true);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/instagram/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorPostText: competitorText }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedComments(data.comments || []);
        setFeedbackMsg({ type: 'success', text: '3 opções de comentários magnéticos geradas!' });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: err.error || 'Erro ao gerar comentários.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão.' });
    } finally {
      setGeneratingComments(false);
    }
  };

  const handlePublishPost = async (postId: string) => {
    try {
      setPublishingId(postId);
      setFeedbackMsg(null);
      const res = await authFetch('/api/tenant/instagram/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', postId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Publicação enviada com sucesso para o Instagram!' });
        loadData();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Falha ao publicar via Meta API.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao publicar na Meta.' });
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Deseja excluir este post gerado?')) return;
    try {
      const res = await authFetch(`/api/tenant/instagram/posts?id=${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        if (selectedPost?.id === postId) {
          setSelectedPost(null);
        }
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao remover post.' });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await authFetch('/api/tenant/instagram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Configurações de marca salvas com sucesso!' });
        loadData();
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: err.error || 'Erro ao salvar configurações.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaBusinessId.trim() || !metaAccessToken.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe o Instagram Business ID e o Access Token.' });
      return;
    }
    try {
      setIsConnectingMeta(true);
      const res = await authFetch('/api/tenant/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagramBusinessId: metaBusinessId, accessToken: metaAccessToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsMetaConnected(true);
        setAccount(data.account);
        setFeedbackMsg({
          type: 'success',
          text: `Meta Graph API conectada com sucesso (@${data.username || metaBusinessId})! Publicação direta liberada.`,
        });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: err.error || 'Erro ao autenticar com a Meta.' });
      }
    } finally {
      setIsConnectingMeta(false);
    }
  };

  const handleDisconnectMeta = async () => {
    try {
      setIsConnectingMeta(true);
      await authFetch('/api/tenant/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      setIsMetaConnected(false);
      setMetaAccessToken('');
      setFeedbackMsg({ type: 'success', text: 'Conexão com a Meta removida com sucesso.' });
    } finally {
      setIsConnectingMeta(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Feedback Global */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-medium border animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cabeçalho Executivo com Indicadores */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/20 shrink-0">
              <InstagramIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
                Agente Autônomo de Instagram
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30">
                  Motor de Atração &amp; Conteúdo
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Crie posts magnéticos com IA, disseque conteúdos virais e atraia clientes para o seu WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${isMetaConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
            />
            <span>{isMetaConnected ? 'Meta API Ativa' : 'Modo Copiloto (Pronto para Uso)'}</span>
          </div>
        </div>
      </div>

      {/* Cards de Métricas e Ciclo de Atração */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Publicações Criadas</span>
            <div className="text-2xl font-extrabold text-white mt-1">{posts.length} posts</div>
            <span className="text-[11px] text-emerald-400 mt-0.5 block">Prontas para copiar ou publicar</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Ciclo de Conversão</span>
            <div className="text-2xl font-extrabold text-white mt-1">Instagram ➔ Zap</div>
            <span className="text-[11px] text-sky-400 mt-0.5 block">CTAs automáticos para o ERBots</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Qualidade de Gancho</span>
            <div className="text-2xl font-extrabold text-white mt-1">94% Score</div>
            <span className="text-[11px] text-purple-400 mt-0.5 block">Filtro anti-clichês de IA ativo</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navegação por Abas (Estilo Executivo Painel Master) */}
      <div className="flex border-b border-slate-800 space-x-6 sm:space-x-8 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setActiveTab('create')}
          className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
            activeTab === 'create'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Fábrica de Posts &amp; Imagens</span>
        </button>

        <button
          onClick={() => setActiveTab('viral')}
          className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
            activeTab === 'viral'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          <span>Laboratório Viral (/ig-viral)</span>
        </button>

        <button
          onClick={() => setActiveTab('plan')}
          className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
            activeTab === 'plan'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Planejador Semanal</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
            activeTab === 'settings'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Estratégia &amp; Conexão</span>
        </button>
      </div>

      {/* =========================================================================
          ABA 1: FÁBRICA DE POSTS & IMAGENS COM IA
      ========================================================================== */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Lado Esquerdo: Formulário de Criação Rápida */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Criar Publicação Magnética
                </h3>
                <span className="text-[11px] text-slate-400">Gemini 3.8 + Imagen 3</span>
              </div>

              {/* Seletor de Formato */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Formato do Conteúdo</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPostFormat('single_image')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition text-center ${
                      postFormat === 'single_image'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-xs">Post com Foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostFormat('reel_script')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition text-center ${
                      postFormat === 'reel_script'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <Film className="w-4 h-4" />
                    <span className="text-xs">Roteiro Reels</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostFormat('carousel')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition text-center ${
                      postFormat === 'carousel'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span className="text-xs">Carrossel</span>
                  </button>
                </div>
              </div>

              {/* Campo de Tema / Ideia */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Tema ou Oferta do Post (Opcional)</label>
                  <span className="text-[11px] text-slate-500">Em branco = IA escolhe o melhor</span>
                </div>
                <textarea
                  rows={3}
                  value={topicHint}
                  onChange={(e) => setTopicHint(e.target.value)}
                  placeholder="Ex: Quebrando o mito sobre preços, promoção especial de quinta-feira, ou dica prática para clientes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>

              {/* Botão de Disparo */}
              <button
                type="button"
                onClick={handleGeneratePost}
                disabled={generatingPost}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${generatingPost ? 'animate-spin' : ''}`} />
                <span>{generatingPost ? 'Criando Arte & Legenda Magnética...' : 'Gerar Publicação com 1 Clique'}</span>
              </button>
            </div>

            {/* Lista Rápida dos Últimos Posts Gerados */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
              <span className="text-xs font-bold text-slate-300 block">Histórico de Publicações ({posts.length})</span>
              <div className="max-h-[340px] overflow-y-auto space-y-2 [scrollbar-width:thin]">
                {posts.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">Nenhum post gerado ainda. Clique no botão acima!</p>
                ) : (
                  posts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPost(p)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                        selectedPost?.id === p.id
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                          {p.post_type === 'reel_script' && <Film className="w-4 h-4 text-rose-400" />}
                          {p.post_type === 'carousel' && <Layers className="w-4 h-4 text-sky-400" />}
                          {p.post_type === 'single_image' && <ImageIcon className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{p.hook_title}</p>
                          <span className="text-[10px] text-slate-500">
                            {new Date(p.created_at).toLocaleDateString('pt-BR')} • {p.post_type}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePost(p.id);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                        title="Excluir post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Lado Direito: Simulador de Feed do Instagram em Tempo Real */}
          <div className="lg:col-span-7">
            {selectedPost ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-white">Preview em Tempo Real (Estilo Instagram)</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    Gancho: {selectedPost.metrics?.hook_score || 94}/100
                  </span>
                </div>

                {/* Card de Visualização do Instagram */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden max-w-md mx-auto shadow-xl">
                  {/* Cabeçalho do Perfil no Mockup */}
                  <div className="p-3 border-b border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-amber-400 flex items-center justify-center p-0.5">
                        <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center font-bold text-xs text-white">
                          {account?.account_name?.slice(0, 1) || 'E'}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">
                          @{account?.account_username || 'sua_empresa'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">{account?.niche || 'Negócio Local'}</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">•••</span>
                  </div>

                  {/* Imagem ou Roteiro Visual */}
                  {selectedPost.media_urls?.[0] ? (
                    <div className="relative aspect-square w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                      <img
                        src={selectedPost.media_urls[0]}
                        alt={selectedPost.hook_title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-slate-900/60 p-4 flex flex-col justify-center items-center text-center gap-2 border-y border-slate-800">
                      <Film className="w-8 h-8 text-rose-400" />
                      <span className="text-xs font-bold text-white">{selectedPost.hook_title}</span>
                      <span className="text-[11px] text-slate-400">Roteiro de vídeo para gravação rápida</span>
                    </div>
                  )}

                  {/* Detalhes do Roteiro de Reels (se houver) */}
                  {selectedPost.post_type === 'reel_script' && selectedPost.metrics?.reel_script && (
                    <div className="p-4 bg-slate-900/90 border-t border-slate-800 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Roteiro de Gravação (Beat Sheet)</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-rose-200">
                        <strong>Gancho dos 3s:</strong> &quot;{selectedPost.metrics.reel_script.hook_3s}&quot;
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-300">
                        {selectedPost.metrics.reel_script.beat_sheet.map((b, i) => (
                          <div key={i} className="p-2 rounded-lg bg-slate-950/60 border border-slate-850 flex gap-2">
                            <span className="font-mono text-emerald-400 shrink-0">{b.time}</span>
                            <div>
                              <p className="text-slate-400 text-[11px]">{b.visual}</p>
                              <p className="font-semibold text-white">&quot;{b.speech}&quot;</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Slides do Carrossel (se houver) */}
                  {selectedPost.post_type === 'carousel' && selectedPost.metrics?.carousel_slides && (
                    <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-sky-400 block">Slides Educativos do Carrossel</span>
                      <div className="grid grid-cols-1 gap-2">
                        {selectedPost.metrics.carousel_slides.map((s) => (
                          <div key={s.slide_number} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                            <span className="font-bold text-emerald-400">Slide {s.slide_number}: {s.title}</span>
                            <p className="text-slate-300 text-[11px] mt-0.5">{s.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Legenda do Post */}
                  <div className="p-4 space-y-2 border-t border-slate-850">
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                      <strong className="text-white mr-1.5">@{account?.account_username || 'sua_empresa'}</strong>
                      {selectedPost.caption}
                    </p>
                    <p className="text-[11px] text-sky-400 font-mono">
                      {selectedPost.hashtags?.join(' ')}
                    </p>
                  </div>
                </div>

                {/* Ações Rápidas do Post: Copiar, Baixar e Publicar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `${selectedPost.caption}\n\n${selectedPost.hashtags?.join(' ')}`,
                        `caption-${selectedPost.id}`
                      )
                    }
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
                  >
                    {copiedKey === `caption-${selectedPost.id}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Legenda Copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Legenda</span>
                      </>
                    )}
                  </button>

                  {selectedPost.media_urls?.[0] ? (
                    <a
                      href={selectedPost.media_urls[0]}
                      download={`erbots_post_${selectedPost.id}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar Imagem</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedPost.metrics?.reel_script || {}, null, 2), `script-${selectedPost.id}`)}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Roteiro</span>
                    </button>
                  )}

                  {isMetaConnected ? (
                    <button
                      onClick={() => handlePublishPost(selectedPost.id)}
                      disabled={publishingId === selectedPost.id}
                      className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{publishingId === selectedPost.id ? 'Publicando...' : 'Publicar no Insta'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="py-2.5 px-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <span>Ligar Meta API ⚙️</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white">Nenhum post selecionado</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Gere uma nova publicação na coluna ao lado para visualizar a prévia do post, baixar a arte e copiar a legenda.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 2: LABORATÓRIO VIRAL (/ig-viral)
      ========================================================================== */}
      {activeTab === 'viral' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  Laboratório Viral — Engenharia Reversa de Conteúdo
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Cole um tema, gancho ou vídeo concorrente que viralizou. A IA fará o Raio-X completo e entregará um roteiro inédito para você gravar.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 self-start sm:self-auto">
                Skill /ig-viral
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Tema ou Ideia do Vídeo Viral de Referência</label>
              <textarea
                rows={3}
                value={viralReferenceInput}
                onChange={(e) => setViralReferenceInput(e.target.value)}
                placeholder="Ex: Vídeo de um concorrente falando 'Pare de comer pão francês se você quer emagrecer', que bateu 500k visualizações..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition resize-none"
              />
            </div>

            <button
              onClick={handleGenerateViral}
              disabled={generatingViral}
              className="py-3 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 text-slate-950 transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <Flame className={`w-4 h-4 ${generatingViral ? 'animate-spin' : ''}`} />
              <span>{generatingViral ? 'Dissecando Gancho & Criando Roteiro...' : 'Fazer Raio-X & Criar Roteiro Viral'}</span>
            </button>
          </div>

          {/* Resultado do Raio-X e Roteiro Inédito */}
          {viralResult && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Raio-X do Gancho */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                  <Target className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">Raio-X: Por que o vídeo viralizou?</h4>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-amber-300 block mb-1">🎯 Tipo de Gancho</span>
                    <p className="text-slate-300">{viralResult.hook_breakdown.hook_type}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-emerald-300 block mb-1">🧠 Psicologia do Algoritmo</span>
                    <p className="text-slate-300 leading-relaxed">{viralResult.hook_breakdown.why_it_worked}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-sky-300 block mb-1">⏱️ Fator de Retenção</span>
                    <p className="text-slate-300 leading-relaxed">{viralResult.hook_breakdown.retention_factor}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-purple-300 block mb-1">🔥 Gatilho Emocional</span>
                    <p className="text-slate-300">{viralResult.hook_breakdown.emotional_trigger}</p>
                  </div>
                </div>
              </div>

              {/* Roteiro Inédito Adaptado */}
              <div className="lg:col-span-7 bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-white">Roteiro Inédito para sua Empresa</h4>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Score: {viralResult.new_script.virality_score}/100
                  </span>
                </div>

                {/* Gancho dos 3 Segundos */}
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Gancho dos Primeiros 3 Segundos (Fale olhando para a câmera):
                  </span>
                  <p className="text-sm font-extrabold text-white">
                    &quot;{viralResult.new_script.hook_3s}&quot;
                  </p>
                </div>

                {/* Cronometragem do Vídeo (Beat Sheet) */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 block">Passo a Passo de Gravação (Cronômetro):</span>
                  <div className="space-y-2 text-xs">
                    {viralResult.new_script.beat_sheet.map((beat, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                        <span className="font-mono text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 shrink-0">
                          {beat.time}
                        </span>
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-slate-400"><strong>Visual:</strong> {beat.visual}</p>
                          <p className="text-slate-200"><strong>Falar:</strong> &quot;{beat.speech}&quot;</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA e Legenda */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <span className="font-bold text-white block">Legenda Recomendada:</span>
                  <p className="text-slate-300 whitespace-pre-wrap">{viralResult.new_script.caption}</p>
                </div>

                {/* Botão de Cópia */}
                <button
                  onClick={() =>
                    copyToClipboard(
                      `ROTEIRO VIRAL:\n${viralResult.new_script.title}\n\nGANCHO 3s:\n${viralResult.new_script.hook_3s}\n\nCRONOGRAMA:\n${viralResult.new_script.beat_sheet
                        .map((b) => `[${b.time}] ${b.speech} (Câmera: ${b.visual})`)
                        .join('\n')}\n\nLEGENDA:\n${viralResult.new_script.caption}`,
                      'viral-script'
                    )
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  {copiedKey === 'viral-script' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Roteiro Copiado para a Área de Transferência!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Roteiro Completo para Gravação</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 3: PLANEJADOR SEMANAL DE CONTEÚDO
      ========================================================================== */}
      {activeTab === 'plan' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Planejador Semanal de Conteúdo (4 Pilares)
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Distribui 7 dias de publicações equilibrando Autoridade, Conexão, Venda e Atração de novos seguidores.
              </p>
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={generatingPlan}
              className="py-2.5 px-5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${generatingPlan ? 'animate-spin' : ''}`} />
              <span>{generatingPlan ? 'Montando Grade da Semana...' : 'Gerar Nova Grade Semanal'}</span>
            </button>
          </div>

          {/* Grade de 7 Dias */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(weeklyPlan.length > 0 ? weeklyPlan : getDefaultWeeklyPlan()).map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-lg hover:border-slate-700 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{item.day}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPillarBadge(item.pillar)}`}
                    >
                      {item.pillar}
                    </span>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-400 block">{item.format}</span>

                  <h5 className="text-xs font-bold text-slate-100 leading-snug line-clamp-2">
                    &quot;{item.hook_title}&quot;
                  </h5>

                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                    {item.key_message}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-emerald-400 font-semibold block truncate">
                    CTA: {item.cta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 4: ESTRATÉGIA, PERFIL & CONEXÃO
      ========================================================================== */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna 1: Auditoria de Perfil & Social Selling */}
          <div className="lg:col-span-6 space-y-6">
            {/* Auditoria de Perfil (/ig-profile) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  Auditoria de Perfil &amp; Bio (/ig-profile)
                </h4>
                <span className="text-[10px] text-slate-400">Transforme visitantes em clientes</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Sua Bio Atual do Instagram</label>
                <textarea
                  rows={3}
                  value={currentBioInput}
                  onChange={(e) => setCurrentBioInput(e.target.value)}
                  placeholder="Cole aqui a bio do seu perfil atual para a IA avaliar e otimizar..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>

              <button
                onClick={handleAuditProfile}
                disabled={auditingProfile}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${auditingProfile ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{auditingProfile ? 'Analisando perfil...' : 'Auditar Bio e Calcular Nota'}</span>
              </button>

              {auditResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Pontuação da Bio</span>
                    <span className="font-extrabold text-emerald-400 text-base">{auditResult.score}/100</span>
                  </div>
                  <p className="text-slate-400">{auditResult.headline_evaluation}</p>

                  <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                    <span className="font-bold text-emerald-300 block mb-1">Bio Recomendada (Pronta para colar):</span>
                    <p className="text-slate-200 whitespace-pre-wrap">{auditResult.suggested_bio}</p>
                    <button
                      onClick={() => copyToClipboard(auditResult.suggested_bio, 'suggested-bio')}
                      className="mt-2 text-[11px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === 'suggested-bio' ? 'Copiada!' : 'Copiar Bio Sugerida'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Social Selling: Gerador de Comentários */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                  Social Selling: Comentários Magnéticos
                </h4>
                <span className="text-[10px] text-slate-400">Atraia tráfego de outros perfis</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Texto do Post do Concorrente</label>
                <textarea
                  rows={2}
                  value={competitorText}
                  onChange={(e) => setCompetitorText(e.target.value)}
                  placeholder="Cole aqui o conteúdo de um post do nicho para gerar comentários de autoridade..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition resize-none"
                />
              </div>

              <button
                onClick={handleGenerateComments}
                disabled={generatingComments}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{generatingComments ? 'Gerando opções...' : 'Gerar 3 Comentários Magnéticos'}</span>
              </button>

              {generatedComments.length > 0 && (
                <div className="space-y-2 pt-1">
                  {generatedComments.map((com, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-2 text-xs">
                      <p className="text-slate-300 leading-relaxed">&quot;{com}&quot;</p>
                      <button
                        onClick={() => copyToClipboard(com, `com-${idx}`)}
                        className="p-1.5 hover:text-emerald-400 transition shrink-0"
                        title="Copiar comentário"
                      >
                        {copiedKey === `com-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coluna 2: Configurações de Marca & Meta API */}
          <div className="lg:col-span-6 space-y-6">
            {/* Tom de Voz e DNA */}
            <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                Voz da Marca &amp; Nicho
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nome da Empresa</label>
                  <input
                    type="text"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">@ do Instagram</label>
                  <input
                    type="text"
                    value={formData.account_username}
                    onChange={(e) => setFormData({ ...formData, account_username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Nicho de Atuação</label>
                <input
                  type="text"
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Público-Alvo</label>
                <input
                  type="text"
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Tom de Voz</label>
                <input
                  type="text"
                  value={formData.brand_voice}
                  onChange={(e) => setFormData({ ...formData, brand_voice: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition"
              >
                Salvar Diretrizes de Marca
              </button>
            </form>

            {/* Conexão Meta Graph API (Opcional) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  Publicação Direta (Meta Graph API)
                </h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isMetaConnected
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isMetaConnected ? 'Conectado' : 'Opcional'}
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Permite enviar a foto e a legenda direto para o feed com 1 clique. Caso prefira o modo Copiloto, basta copiar a legenda e baixar a foto gerada.
              </p>

              {isMetaConnected ? (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Conta vinculada (@{account?.account_username || 'oficial'})</span>
                  </div>
                  <button
                    onClick={handleDisconnectMeta}
                    disabled={isConnectingMeta}
                    className="px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold transition"
                  >
                    Desconectar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleConnectMeta} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Instagram Business Account ID</label>
                    <input
                      type="text"
                      value={metaBusinessId}
                      onChange={(e) => setMetaBusinessId(e.target.value)}
                      placeholder="Ex: 17841405309211..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Meta User Access Token (Long-Lived)</label>
                    <input
                      type="password"
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      placeholder="EAABwz..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isConnectingMeta}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  >
                    {isConnectingMeta ? 'Validando...' : 'Conectar Conta da Meta'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getPillarBadge(pillar: string): string {
  switch (pillar) {
    case 'Autoridade':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case 'Conexão':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'Venda':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'Atração':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

function getDefaultWeeklyPlan(): WeeklyPlanItem[] {
  return [
    {
      day: 'Segunda-feira',
      pillar: 'Atração',
      format: 'Reels Curto',
      hook_title: 'O erro número 1 que quase todo mundo comete ao começar',
      key_message: 'Desmentir um mito comum do nicho nos primeiros 3 segundos.',
      cta: 'Comente ERRO para receber o passo a passo no WhatsApp.',
    },
    {
      day: 'Terça-feira',
      pillar: 'Autoridade',
      format: 'Carrossel Educativo',
      hook_title: '3 passos práticos para aplicar ainda hoje no seu dia',
      key_message: 'Tutorial rápido slide a slide entregando valor prático.',
      cta: 'Salve este post para consultar mais tarde.',
    },
    {
      day: 'Quarta-feira',
      pillar: 'Conexão',
      format: 'Post com Foto',
      hook_title: 'Os bastidores do que ninguém te conta no dia a dia',
      key_message: 'História real humanizada de superação da equipe.',
      cta: 'Você já passou por isso? Me conte nos comentários.',
    },
    {
      day: 'Quinta-feira',
      pillar: 'Venda',
      format: 'Reels de Oferta',
      hook_title: 'Como nossos clientes alcançam essa meta sem estresse',
      key_message: 'Demonstração do serviço e prova social forte.',
      cta: 'Comente QUERO ou clique no link da bio para ser atendido agora.',
    },
    {
      day: 'Sexta-feira',
      pillar: 'Atração',
      format: 'Carrossel Viral',
      hook_title: 'Lista de ferramentas essenciais que você precisa conhecer',
      key_message: 'Conteúdo altamente compartilhável que gera novos seguidores.',
      cta: 'Mande este post para alguém que precisa ver isso.',
    },
    {
      day: 'Sábado',
      pillar: 'Conexão',
      format: 'Post com Foto',
      hook_title: 'O que aprendi esta semana trabalhando no nosso negócio',
      key_message: 'Reflexão leve e autêntica de fim de semana.',
      cta: 'Bom fim de semana a todos!',
    },
    {
      day: 'Domingo',
      pillar: 'Autoridade',
      format: 'Reels Estratégico',
      hook_title: 'Planeje sua semana antes de começar na correria',
      key_message: 'Dica estratégica para organizar os próximos 7 dias.',
      cta: 'Pronto para a nova semana? Deixe seu fogo 🔥.',
    },
  ];
}
