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
  UserCheck,
  Compass,
  MessageCircle,
  Share2,
  Copy,
  ExternalLink,
  Film,
  Layers,
  ChevronRight,
  TrendingUp,
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

// Mascote 8-Bit fofo do ERBots (inspirado no avatar pixel do vídeo)
function RobotMascotIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="3" width="16" height="12" rx="2" />
      <rect x="7" y="6" width="3" height="3" fill="#1e1b4b" />
      <rect x="14" y="6" width="3" height="3" fill="#1e1b4b" />
      <rect x="9" y="11" width="6" height="2" fill="#1e1b4b" />
      <rect x="2" y="7" width="2" height="4" rx="1" />
      <rect x="20" y="7" width="2" height="4" rx="1" />
      <rect x="5" y="15" width="3" height="6" />
      <rect x="10" y="15" width="4" height="4" />
      <rect x="16" y="15" width="3" height="6" />
    </svg>
  );
}

// Ilustração artística da Rede de Descanso (Hammock) do vídeo
function HammockIllustration() {
  return (
    <div className="flex flex-col items-center justify-center py-3 text-amber-700/80">
      {/* 4 Pontos animados */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600/70 animate-pulse" />
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600/70 animate-pulse delay-100" />
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600/70 animate-pulse delay-200" />
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600/70 animate-pulse delay-300" />
      </div>

      <svg className="w-48 sm:w-56 h-16 sm:h-20" viewBox="0 0 240 80" fill="none">
        {/* Postes de madeira */}
        <rect x="36" y="10" width="8" height="65" rx="1.5" fill="#78350f" />
        <rect x="196" y="10" width="8" height="65" rx="1.5" fill="#78350f" />
        <line x1="32" y1="75" x2="208" y2="75" stroke="#475569" strokeWidth="2" strokeDasharray="3 3" opacity="0.4" />
        {/* Cordas de sustentação */}
        <path d="M44 24 Q70 42 85 48" stroke="#92400e" strokeWidth="2" fill="none" />
        <path d="M196 24 Q170 42 155 48" stroke="#92400e" strokeWidth="2" fill="none" />
        {/* Rede suspensa */}
        <path
          d="M85 48 Q120 70 155 48 Q120 62 85 48 Z"
          fill="url(#hammockGrad)"
          stroke="#d97706"
          strokeWidth="1.5"
        />
        <path d="M92 51 Q120 65 148 51" stroke="#fef08a" strokeWidth="1" strokeDasharray="2 2" fill="none" />
        <defs>
          <linearGradient id="hammockGrad" x1="85" y1="48" x2="155" y2="70" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ea580c" />
            <stop offset="0.5" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#dc2626" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-[11px] font-medium text-slate-400 text-center px-4">
        Relaxe. O agente de IA cuida de toda a rotina do seu Instagram enquanto você foca no seu negócio.
      </span>
    </div>
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

export default function InstagramAgentManager() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'comments' | 'plan' | 'digest' | 'automation' | 'settings'>('overview');
  const [savingSettings, setSavingSettings] = useState(false);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [topicHint, setTopicHint] = useState('');
  const [postFormat, setPostFormat] = useState<'single_image' | 'reel_script' | 'carousel'>('single_image');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Social Selling comments tool (ig-comment)
  const [competitorText, setCompetitorText] = useState('Minha rotina de criação em 3 passos simples: 1. Pesquisa de referências; 2. Roteiro sem enrolação; 3. Gravação em bloco.');
  const [generatingComments, setGeneratingComments] = useState(false);
  const [generatedComments, setGeneratedComments] = useState<string[]>([
    'Excelente estrutura! O passo da pesquisa de referências é onde 90% das pessoas erram por não analisar a retenção antes.',
    'Muito prático e direto ao ponto. Gravar em bloco me economizou pelo menos 6 horas por semana aqui na rotina.',
    'Visão cirúrgica. Consistência nesse processo supera qualquer truque passageiro do algoritmo.',
  ]);

  // Weekly Plan items (ig-plan)
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanItem[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    account_name: '',
    account_username: '',
    niche: '',
    target_audience: '',
    brand_voice: '',
    visual_style: '',
    wordsIUse: '',
    wordsINeverSay: '',
    offLimitsTopics: '',
    approval_mode: 'whatsapp_required' as 'whatsapp_required' | 'auto_scheduled',
    approval_timeout_hours: 4,
    timeout_action: 'auto_publish' as 'auto_publish' | 'skip',
    preferred_post_time: '18:00:00',
    auto_generate_daily: true,
  });

  const formatErrorMessage = (raw: any): string => {
    if (!raw) return 'Ocorreu um erro inesperado.';
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.error?.message) return parsed.error.message;
        if (parsed.error) return typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
      } catch {}
      return raw;
    }
    if (raw.message) return raw.message;
    if (raw.error) return typeof raw.error === 'string' ? raw.error : JSON.stringify(raw.error);
    return JSON.stringify(raw);
  };

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
            wordsIUse: '',
            wordsINeverSay: '',
            offLimitsTopics: '',
            approval_mode: data.account.approval_mode || 'whatsapp_required',
            approval_timeout_hours: data.account.approval_timeout_hours || 4,
            timeout_action: data.account.timeout_action || 'auto_publish',
            preferred_post_time: data.account.preferred_post_time || '18:00:00',
            auto_generate_daily: data.account.auto_generate_daily ?? true,
          });
        }
      }

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
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePilot = async (newMode: 'whatsapp_required' | 'auto_scheduled') => {
    const updatedForm = { ...formData, approval_mode: newMode };
    setFormData(updatedForm);
    try {
      const res = await authFetch('/api/tenant/instagram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedForm),
      });
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account);
        setFeedbackMsg({
          type: 'success',
          text:
            newMode === 'auto_scheduled'
              ? '🚀 Piloto Automático ATIVADO! O robô gerencia as postagens e tarefas de forma 100% autônoma.'
              : '📲 Modo Aprovação via WhatsApp ATIVADO! O robô enviará cada publicação para sua aprovação no WhatsApp.',
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao alternar modo de autonomia.' });
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
        setFeedbackMsg({ type: 'success', text: 'Configurações do perfil salvas com sucesso!' });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
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
      const res = await authFetch('/api/tenant/instagram/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: formData.niche,
          target_audience: formData.target_audience,
          brand_voice: formData.brand_voice,
          visual_style: formData.visual_style,
          wordsIUse: formData.wordsIUse,
          wordsINeverSay: formData.wordsINeverSay,
          offLimitsTopics: formData.offLimitsTopics,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAccount((prev) => (prev ? { ...prev, brand_knowledge_digest: data.digest, digest_updated_at: data.updated_at } : null));
        setFeedbackMsg({
          type: 'success',
          text: 'Guia de Voz e Knowledge Digest sintetizados com sucesso! Consumo de tokens reduzido em mais de 90%.',
        });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro de rede ao comunicar com a IA.' });
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
        body: JSON.stringify({ topicHint, format: postFormat }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [data.post, ...prev]);
        setTopicHint('');
        setFeedbackMsg({
          type: 'success',
          text: `Publicação gerada com sucesso pela IA! (Gancho: ${data.details?.hook_score || 92}/100)`,
        });
        setActiveTab('posts');
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao comunicar com a IA.' });
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleGenerateComments = async () => {
    if (!competitorText.trim()) return;
    try {
      setGeneratingComments(true);
      const res = await authFetch('/api/tenant/instagram/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorPostText: competitorText }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedComments(data.comments || []);
        setFeedbackMsg({ type: 'success', text: '3 comentários magnéticos gerados para você postar!' });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao gerar comentários de engajamento.' });
    } finally {
      setGeneratingComments(false);
    }
  };

  const handleGeneratePlan = async () => {
    try {
      setGeneratingPlan(true);
      const res = await authFetch('/api/tenant/instagram/plan', {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setWeeklyPlan(data.plan || []);
        setFeedbackMsg({ type: 'success', text: 'Plano semanal de 7 dias gerado com sucesso nos 4 pilares!' });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao gerar planejamento semanal.' });
    } finally {
      setGeneratingPlan(false);
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

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
        <p className="text-sm">Carregando Agente de Instagram...</p>
      </div>
    );
  }

  // TELA DE CONTRATAÇÃO DO MÓDULO (SE NÃO CONTRATADO)
  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-3 sm:p-6 overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" /> Módulo Adicional Comercial
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <span className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 text-white shadow-lg shrink-0">
                  <InstagramIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                </span>
                Agente Autônomo de Instagram com IA
              </h1>
              <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                Inspirado no <code>jakeschincariol/instagram-agent-skill</code>: Postar, Comentar, Responder e Planejar no Piloto Automático com Humanizador Anti-IA.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" /> 1. Postar (Reels, Carrossel & Artes IA)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Criação autônoma com fórmulas de ganchos virais e imagens comerciais em alta resolução.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 text-pink-400 font-semibold text-sm">
                  <MessageCircle className="w-4 h-4" /> 2. Comentar (Social Selling &quot;DE OUTRAS&quot;)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Gera comentários magnéticos em outros perfis do seu nicho para atrair seguidores qualificados.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <MessageSquare className="w-4 h-4" /> 3. Responder (Direct & Comentários)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Automação &quot;Comente X&quot; para disparar links no Direct e qualificar leads na hora.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <Zap className="w-4 h-4" /> 4. Piloto Automático + Economia 90% Tokens
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Memória condensada da sua marca (voice.md / Knowledge Digest) com baixíssimo custo.
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
                <span className="text-xs text-emerald-400 font-medium">Cancele quando quiser</span>
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

  const isPilotActive = formData.approval_mode === 'auto_scheduled';
  const cleanUsername = (formData.account_username || 'seu_perfil').replace(/^@+/, '');

  return (
    <div className="max-w-6xl mx-auto space-y-5 p-3 sm:p-6 overflow-x-hidden">
      {/* Banner de Feedback Limpo */}
      {feedbackMsg && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm flex items-start sm:items-center justify-between gap-3 border transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words leading-relaxed">{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CARD DO PERFIL E PILOTO AUTOMÁTICO (Fiel à captura exata do vídeo) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-pink-500/15 via-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Linha Superior: Perfil + As 4 Tarefas */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            {/* Bloco do Perfil do Instagram */}
            <div className="flex items-start sm:items-center gap-3.5">
              {/* Avatar com borda gradiente do Instagram */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-indigo-600 p-0.5 shrink-0 shadow-lg">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white font-extrabold text-lg sm:text-xl">
                  {cleanUsername.slice(0, 2).toUpperCase()}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                    @{cleanUsername}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Agente Ativo
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {formData.account_name || 'Sua Empresa'} • Nicho: <strong className="text-slate-200">{formData.niche || 'Geral'}</strong>
                </p>

                {/* Botões rápidos: Editar perfil e link externo */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition"
                  >
                    Editar perfil
                  </button>
                  <a
                    href={`https://instagram.com/${cleanUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Ver perfil
                  </a>
                </div>
              </div>
            </div>

            {/* Checklist Visual: TAREFAS (Exatamente como no vídeo) */}
            <div className="w-full lg:w-auto bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 sm:p-4">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2 text-center lg:text-left">
                TAREFAS QUE A IA EXECUTA
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Postar
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Comentar
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Responder
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Planejar
                </div>
              </div>
            </div>
          </div>

          {/* Mini-Grid de 3 Posts do Feed (Visual igual ao card do vídeo) */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
              <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Feed recente:</span>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500/40 to-rose-600/40 border border-pink-500/30 flex items-center justify-center text-[10px] text-pink-200 font-bold shadow-sm">
                Foto IA
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500/40 to-purple-600/40 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-sm relative">
                <RobotMascotIcon className="w-6 h-6 text-indigo-300" />
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500/40 to-orange-600/40 border border-amber-500/30 flex items-center justify-center text-[10px] text-amber-200 font-bold shadow-sm">
                Reels
              </div>
            </div>

            {/* Banner Central: "POR VOCÊ" */}
            <div className="px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 tracking-wider uppercase">
              POR VOCÊ
            </div>

            {/* O Grande Interruptor de Piloto Automático */}
            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <div className="text-left sm:text-right">
                <span className="block text-xs font-bold uppercase tracking-wider text-white">
                  PILOTO AUTOMÁTICO
                </span>
                <span className="text-[10px] text-slate-400">
                  {isPilotActive ? 'Trabalhando 24/7' : 'Requer aprovação WhatsApp'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleTogglePilot(isPilotActive ? 'whatsapp_required' : 'auto_scheduled')}
                className={`w-14 h-8 rounded-full transition-colors relative p-1 shrink-0 ${
                  isPilotActive
                    ? 'bg-gradient-to-r from-orange-600 via-pink-600 to-indigo-600 shadow-lg shadow-pink-600/20'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white transition-transform shadow-md ${
                    isPilotActive ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Ilustração da Rede de Descanso (Hammock) */}
          <HammockIllustration />
        </div>
      </div>

      {/* SUB-MENU TOTALMENTE RESPONSIVO NO CELULAR (Scroll Suave, Zero Quebras) */}
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1 px-0.5 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Painel
        </button>

        <button
          onClick={() => setActiveTab('posts')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'posts'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Postar ({posts.length})
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'comments'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> Social Selling (Outros Perfis)
        </button>

        <button
          onClick={() => setActiveTab('plan')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'plan'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-amber-400" /> Planejador Semanal
        </button>

        <button
          onClick={() => setActiveTab('digest')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'digest'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-300" /> Guia de Voz & Tokens
        </button>

        <button
          onClick={() => setActiveTab('automation')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'automation'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" /> Direct &quot;Comente X&quot;
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-slate-300" /> Horários & Perfil
        </button>
      </div>

      {/* ABA 1: PAINEL / VISÃO GERAL */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Total de Posts Criados</span>
              <p className="text-2xl font-extrabold text-white">{posts.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Aguardando Aprovação</span>
              <p className="text-2xl font-extrabold text-amber-400">
                {posts.filter((p) => p.status === 'pending_approval').length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Publicados / Agendados</span>
              <p className="text-2xl font-extrabold text-emerald-400">
                {posts.filter((p) => p.status === 'published' || p.status === 'scheduled').length}
              </p>
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Sparkles className="w-4 h-4 text-pink-400" /> Criar Conteúdo Rápido
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Gere agora um post com foto IA, roteiro de Reels ou carrossel educativo com retenção otimizada.
              </p>
              <button
                onClick={() => setActiveTab('posts')}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition"
              >
                Abrir Gerador de Posts
              </button>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <MessageCircle className="w-4 h-4 text-emerald-400" /> Social Selling (DE OUTRAS)
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cole o post de um concorrente ou referência e a IA gera 3 comentários magnéticos para atrair seguidores.
              </p>
              <button
                onClick={() => setActiveTab('comments')}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition"
              >
                Gerar Comentários para Outros Perfis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: POSTAR (Criação de Posts, Reels e Carrossel) */}
      {activeTab === 'posts' && (
        <div className="space-y-6">
          {/* Caixa de Criação */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Criador Autônomo de Conteúdo (ig-reel / ig-carousel / ig-caption)
              </h3>
              <p className="text-xs text-slate-400">
                Selecione o formato e informe um tema opcional. A IA usa o Guia de Voz da sua marca para gerar com tom 100% humano.
              </p>
            </div>

            {/* Escolha do Formato */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPostFormat('single_image')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${
                  postFormat === 'single_image'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-bold">Post com Foto IA</span>
                  <span className="text-[10px] text-slate-400">Foto realista comercial + legenda</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPostFormat('reel_script')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${
                  postFormat === 'reel_script'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Film className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-bold">Roteiro de Reels (ig-reel)</span>
                  <span className="text-[10px] text-slate-400">Gancho 3s + beat sheet + texto na tela</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPostFormat('carousel')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${
                  postFormat === 'carousel'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-bold">Carrossel (ig-carousel)</span>
                  <span className="text-[10px] text-slate-400">5 slides com gancho e valor</span>
                </div>
              </button>
            </div>

            {/* Input de Tema e Botão */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Tema opcional (ex: O segredo para vender mais sem dar desconto)..."
                value={topicHint}
                onChange={(e) => setTopicHint(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleGeneratePost}
                disabled={generatingPost}
                className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 disabled:opacity-50 rounded-lg shadow-md flex items-center justify-center gap-2 transition shrink-0"
              >
                {generatingPost ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Gerando com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Gerar Publicação
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Lista de Posts Gerados */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-300">Publicações e Fila de Conteúdo ({posts.length})</h4>

            {posts.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs sm:text-sm text-slate-400">
                  Nenhum post criado ainda. Use o gerador acima para criar o primeiro post de hoje!
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {posts.map((post) => {
                  const hookScore = post.metrics?.hook_score || 92;
                  let parsedDetails: any = null;
                  try {
                    if (post.visual_notes && post.visual_notes.startsWith('{')) {
                      parsedDetails = JSON.parse(post.visual_notes);
                    }
                  } catch {}

                  return (
                    <div
                      key={post.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between shadow-lg"
                    >
                      <div className="p-4 space-y-3">
                        {/* Cabeçalho do Card */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              {post.post_type === 'reel_script'
                                ? '🎬 Reels'
                                : post.post_type === 'carousel'
                                ? '📑 Carrossel'
                                : '📸 Foto'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                              Gancho: {hookScore}/100
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              post.status === 'published'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : post.status === 'scheduled'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : post.status === 'pending_approval'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {post.status === 'pending_approval'
                              ? 'Aguardando Aprovação'
                              : post.status === 'scheduled'
                              ? 'Agendado'
                              : post.status === 'published'
                              ? 'Publicado'
                              : post.status}
                          </span>
                        </div>

                        {/* Gancho */}
                        <h4 className="text-sm font-bold text-white leading-snug">
                          {post.hook_title}
                        </h4>

                        {/* Mídia / Capa */}
                        {post.media_urls?.[0] && (
                          <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                            <img
                              src={post.media_urls[0]}
                              alt={post.hook_title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Roteiro de Reels (se houver) */}
                        {parsedDetails?.reel_script && (
                          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
                            <span className="text-[11px] font-bold text-pink-400 flex items-center gap-1">
                              <Film className="w-3.5 h-3.5" /> Beat Sheet do Reels:
                            </span>
                            <div className="space-y-1.5 text-xs text-slate-300">
                              {parsedDetails.reel_script.beat_sheet?.map((b: any, idx: number) => (
                                <div key={idx} className="flex gap-2 text-[11px]">
                                  <strong className="text-indigo-400 shrink-0">{b.time}:</strong>
                                  <span>{b.speech}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Slides de Carrossel (se houver) */}
                        {parsedDetails?.carousel_slides && (
                          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
                            <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5" /> Slides do Carrossel ({parsedDetails.carousel_slides.length}):
                            </span>
                            <div className="space-y-1 text-xs text-slate-300">
                              {parsedDetails.carousel_slides.slice(0, 3).map((s: any, idx: number) => (
                                <div key={idx} className="text-[11px] flex gap-1.5">
                                  <span className="text-amber-400 font-bold">Slide {s.slide_number}:</span>
                                  <span className="text-slate-300 truncate">{s.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Legenda Humanizada */}
                        <div className="p-2.5 rounded-lg bg-slate-950 text-xs text-slate-300 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {post.caption}
                        </div>

                        {/* Hashtags */}
                        {post.hashtags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 text-[11px] text-indigo-400">
                            {post.hashtags.map((h, i) => (
                              <span key={i}>{h}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Ações no Post */}
                      <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-2">
                        <button
                          onClick={() => copyToClipboard(post.caption, post.id as any)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-lg flex items-center gap-1.5 transition"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar Legenda
                        </button>

                        {post.status === 'pending_approval' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePostAction(post.id, 'reject')}
                              className="px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition"
                            >
                              Rejeitar
                            </button>
                            <button
                              onClick={() => handlePostAction(post.id, 'approve')}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition"
                            >
                              Aprovar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: SOCIAL SELLING (Comentar em outros perfis - "DE OUTRAS") */}
      {activeTab === 'comments' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
                Habilidade ig-comment (Social Selling)
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Comentar em Outros Perfis do Nicho (&quot;DE OUTRAS&quot;)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                A estratégia mais rápida para crescer no Instagram: deixe comentários de alto valor nos posts de concorrentes e referências. As pessoas lêem o comentário e clicam no seu perfil!
              </p>
            </div>

            {/* Input do Post de Referência */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Texto ou tema do post que você quer comentar:
              </label>
              <textarea
                rows={3}
                value={competitorText}
                onChange={(e) => setCompetitorText(e.target.value)}
                placeholder="Cole o texto ou a ideia do post de outra pessoa..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={handleGenerateComments}
              disabled={generatingComments}
              className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg shadow-md flex items-center justify-center gap-2 transition"
            >
              {generatingComments ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Gerando Comentários Magnéticos...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" /> Gerar 3 Comentários Magnéticos
                </>
              )}
            </button>
          </div>

          {/* CARD VISUAL IDÊNTICO À CAPA DO VÍDEO ("DE OUTRAS") */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Prévia Visual no Instagram (Padrão do Vídeo)
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300 uppercase">
                DE OUTRAS
              </span>
            </div>

            {/* Mock Card do Instagram */}
            <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                  P
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">perfil_exemplo</span>
                  <span className="text-[10px] text-slate-400">Post de referência no nicho</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 italic line-clamp-2">
                &quot;{competitorText}&quot;
              </p>

              {/* Balão de Comentário com Mascote (Exatamente como no vídeo) */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded bg-emerald-600/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <RobotMascotIcon className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-emerald-200 font-medium">
                    {generatedComments[0] || 'Que conteúdo bom! 🔥'}
                  </p>
                </div>
              </div>

              {/* Ações mock do Instagram */}
              <div className="flex items-center justify-between pt-1 text-slate-400 text-xs border-t border-slate-800">
                <div className="flex items-center gap-3">
                  <span>❤️ 6.456</span>
                  <span>💬 135</span>
                  <span>↗️ 6.593</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">Comentário Gerado por IA</span>
              </div>
            </div>

            {/* As 3 Opções de Comentários Geradas */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                Escolha e Copie para Deixar no Post:
              </h4>
              <div className="grid gap-3">
                {generatedComments.map((comment, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <p className="text-xs text-slate-200 leading-relaxed flex-1">
                      &quot;{comment}&quot;
                    </p>
                    <button
                      onClick={() => copyToClipboard(comment, idx)}
                      className="w-full sm:w-auto px-3.5 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 shrink-0 transition"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: PLANEJADOR SEMANAL (ig-plan) */}
      {activeTab === 'plan' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                  Habilidade ig-plan (Planejamento Estratégico)
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Calendário Semanal nos 4 Pilares
                </h3>
                <p className="text-xs text-slate-400">
                  Distribuição inteligente: <strong>Autoridade</strong>, <strong>Conexão</strong>, <strong>Venda</strong> e <strong>Atração</strong>.
                </p>
              </div>

              <button
                onClick={handleGeneratePlan}
                disabled={generatingPlan}
                className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg shadow-md flex items-center justify-center gap-2 transition shrink-0"
              >
                {generatingPlan ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Gerando Plano Semanal...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" /> Gerar Planejamento da Semana
                  </>
                )}
              </button>
            </div>

            {/* Grade dos 7 Dias da Semana */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {(weeklyPlan.length > 0
                ? weeklyPlan
                : [
                    {
                      day: 'Segunda-feira',
                      pillar: 'Atração',
                      format: 'Reels',
                      hook_title: 'O erro que todo mundo comete ao começar',
                      key_message: 'Desmistificar o maior gargalo inicial do cliente.',
                      cta: 'Comente GUIA para receber o passo a passo.',
                    },
                    {
                      day: 'Terça-feira',
                      pillar: 'Autoridade',
                      format: 'Carrossel',
                      hook_title: '3 regras de ouro que mudaram nossos resultados',
                      key_message: 'Tutorial educativo com método comprovado.',
                      cta: 'Salve para não esquecer quando precisar.',
                    },
                    {
                      day: 'Quarta-feira',
                      pillar: 'Conexão',
                      format: 'Post com Foto',
                      hook_title: 'O bastidor que ninguém mostra nos stories',
                      key_message: 'História autêntica da jornada e aprendizado.',
                      cta: 'Você já passou por isso? Conta aqui.',
                    },
                    {
                      day: 'Quinta-feira',
                      pillar: 'Venda',
                      format: 'Reels',
                      hook_title: 'Como nossos clientes resolvem isso em 48h',
                      key_message: 'Apresentação da solução e prova social.',
                      cta: 'Comente QUERO para falar no WhatsApp.',
                    },
                    {
                      day: 'Sexta-feira',
                      pillar: 'Atração',
                      format: 'Carrossel',
                      hook_title: 'Checklist definitivo para fechar a semana',
                      key_message: 'Conteúdo altamente salvável e compartilhável.',
                      cta: 'Envie para quem precisa ver isso hoje.',
                    },
                    {
                      day: 'Sábado',
                      pillar: 'Conexão',
                      format: 'Post com Foto',
                      hook_title: 'Uma reflexão rápida para o seu fim de semana',
                      key_message: 'Mensagem leve e humanizada.',
                      cta: 'Ótimo descanso para você!',
                    },
                    {
                      day: 'Domingo',
                      pillar: 'Autoridade',
                      format: 'Reels',
                      hook_title: 'Prepare sua semana antes de ser engolido pela rotina',
                      key_message: 'Dica estratégica de alta relevância.',
                      cta: 'Deixe seu fogo 🔥 se está pronto.',
                    },
                  ]
              ).map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{item.day}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.pillar === 'Autoridade'
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : item.pillar === 'Venda'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : item.pillar === 'Conexão'
                            ? 'bg-pink-500/20 text-pink-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {item.pillar}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-medium">
                      Formato: <strong className="text-slate-200">{item.format}</strong>
                    </div>

                    <p className="text-xs text-white font-semibold leading-snug">
                      &quot;{item.hook_title}&quot;
                    </p>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {item.key_message}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-900 text-[10px] text-emerald-400 font-medium">
                    CTA: {item.cta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: GUIA DE VOZ & ECONOMIA DE TOKENS (voice.md / Knowledge Digest) */}
      {activeTab === 'digest' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
              voice.md + Knowledge Digest
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Tom de Voz Humano e Economia de 90%+ em Tokens
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              O agente sintetiza todo o DNA da marca, ganchos virais e palavras proibidas em um documento ultracompacto (~400 tokens). Isso garante postagens que soam como pessoas reais e reduz os custos de IA drasticamente.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Formulário de Tom de Voz */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nicho de Atuação
                </label>
                <input
                  type="text"
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  placeholder="Ex: Odontologia Estética, Barbearia, Software B2B"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Público-Alvo
                </label>
                <input
                  type="text"
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  placeholder="Ex: Donos de pequenas empresas, Mulheres 25-45 anos"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Palavras que a marca REALMENTE usa (Tom natural)
                </label>
                <input
                  type="text"
                  value={formData.wordsIUse}
                  onChange={(e) => setFormData({ ...formData, wordsIUse: e.target.value })}
                  placeholder="Ex: direto ao ponto, na prática, sem enrolação, bora"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 text-rose-300">
                  Palavras e Jargões PROIBIDOS (Filtro Anti-IA)
                </label>
                <input
                  type="text"
                  value={formData.wordsINeverSay}
                  onChange={(e) => setFormData({ ...formData, wordsINeverSay: e.target.value })}
                  placeholder="Ex: mergulhar conosco, no mundo dinâmico, desbloqueie seu potencial"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Diretrizes Visuais para Fotos de IA
                </label>
                <input
                  type="text"
                  value={formData.visual_style}
                  onChange={(e) => setFormData({ ...formData, visual_style: e.target.value })}
                  placeholder="Ex: Fotografia de produto com iluminação cinematográfica, lente 50mm f/1.8"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
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
                <span>Documento de Memória Ativo (~400 tokens)</span>
                {account?.digest_updated_at && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    Atualizado em {new Date(account.digest_updated_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </label>

              <div className="flex-1 min-h-[300px] p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-300 whitespace-pre-wrap overflow-y-auto leading-relaxed">
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

      {/* ABA 6: AUTOMAÇÃO DE DIRECT & COMENTÁRIOS */}
      {activeTab === 'automation' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Automação &quot;Comente X e receba no Direct&quot;
            </h3>
            <p className="text-xs text-slate-400">
              Quando alguém comentar a palavra-chave nas suas postagens, o agente responde na hora no comentário público e envia o link no Direct.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Palavra-Chave de Gatilho</label>
                <input
                  type="text"
                  defaultValue="QUERO"
                  placeholder="Ex: QUERO, LINK, GUIA"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Resposta no Comentário Público</label>
                <input
                  type="text"
                  defaultValue="Acabei de te enviar todos os detalhes no Direct! 🚀 Confere lá."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mensagem Privada no Direct</label>
                <input
                  type="text"
                  defaultValue="Olá! Aqui está o material exclusivo que você pediu: https://seusite.com.br/link"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-900">
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Automação ativa em todas as publicações
              </span>
              <button
                type="button"
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition"
              >
                Salvar Regra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 7: HORÁRIOS & CONFIGURAÇÕES */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white">Configurações de Horário e Perfil</h3>
            <p className="text-xs text-slate-400">
              Defina seu @ de usuário e os horários em que o agente deve operar no Instagram.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome da Marca / Perfil</label>
              <input
                type="text"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                placeholder="Ex: ERBots Atendimento Inteligente"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                @ da Conta no Instagram (sem necessidade de digitar @)
              </label>
              <input
                type="text"
                value={formData.account_username}
                onChange={(e) => setFormData({ ...formData, account_username: e.target.value })}
                placeholder="exemplo_loja"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Horário Preferencial de Postagem</label>
              <input
                type="time"
                value={formData.preferred_post_time}
                onChange={(e) => setFormData({ ...formData, preferred_post_time: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tempo Limite de Espera no WhatsApp</label>
              <select
                value={formData.approval_timeout_hours}
                onChange={(e) => setFormData({ ...formData, approval_timeout_hours: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
              >
                <option value={2}>2 horas</option>
                <option value={4}>4 horas (recomendado)</option>
                <option value={8}>8 horas</option>
                <option value={12}>12 horas</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
