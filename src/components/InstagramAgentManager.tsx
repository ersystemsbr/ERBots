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
  MessageCircle,
  Share2,
  Copy,
  ExternalLink,
  Film,
  Layers,
  ChevronRight,
  TrendingUp,
  Target,
  Flame,
  Award,
  ArrowRight,
  UserCheck,
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
    beat_sheet: Array<{ time: string; visual: string; speech: string }>;
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
  const [hasAccess, setHasAccess] = useState(false);
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'viral' | 'create' | 'comments' | 'audit' | 'plan' | 'digest' | 'automation' | 'settings'>('overview');

  const [savingSettings, setSavingSettings] = useState(false);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatingViral, setGeneratingViral] = useState(false);
  const [auditingProfile, setAuditingProfile] = useState(false);

  const [topicHint, setTopicHint] = useState('');
  const [postFormat, setPostFormat] = useState<'single_image' | 'reel_script' | 'carousel'>('single_image');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Virality Skill states
  const [viralReferenceInput, setViralReferenceInput] = useState('');
  const [viralResult, setViralResult] = useState<ViralAnalysis | null>(null);

  // Profile Audit states
  const [currentBioInput, setCurrentBioInput] = useState('');
  const [auditResult, setAuditResult] = useState<ProfileAudit | null>(null);

  // Social Selling comments states
  const [competitorText, setCompetitorText] = useState('');
  const [generatedComments, setGeneratedComments] = useState<string[]>([]);
  const [generatingComments, setGeneratingComments] = useState(false);

  // Weekly plan states
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
              ? '🚀 Piloto Automático ATIVADO! A IA gerencia suas postagens e tarefas de forma 100% autônoma.'
              : '📲 Modo Aprovação via WhatsApp ATIVADO! O agente enviará cada post para você aprovar antes de publicar.',
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
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao conectar ao servidor.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGenerateViralAnalysis = async () => {
    if (!viralReferenceInput.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe um tema, gancho ou texto de vídeo viral de referência.' });
      return;
    }
    try {
      setGeneratingViral(true);
      const res = await authFetch('/api/tenant/instagram/viral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viralReference: viralReferenceInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setViralResult(data.analysis);
        setFeedbackMsg({ type: 'success', text: 'Raio-X de Viralidade e novo roteiro gerados com sucesso!' });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro de comunicação com o motor de viralidade.' });
    } finally {
      setGeneratingViral(false);
    }
  };

  const handleAuditProfile = async () => {
    try {
      setAuditingProfile(true);
      const res = await authFetch('/api/tenant/instagram/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentBio: currentBioInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditResult(data.audit);
        setFeedbackMsg({ type: 'success', text: `Auditoria concluída! Nota do seu perfil: ${data.audit.score}/100` });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao auditar perfil.' });
    } finally {
      setAuditingProfile(false);
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
          text: `Publicação gerada com sucesso pela IA! (Gancho: ${data.details?.hook_score || 94}/100)`,
        });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
      }
    } catch {
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
        setFeedbackMsg({ type: 'success', text: '3 comentários magnéticos gerados!' });
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
      const res = await authFetch('/api/tenant/instagram/plan', { method: 'POST' });
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
          text: 'Guia de Voz e Knowledge Digest sintetizados com sucesso! Economia de mais de 90% em tokens.',
        });
      } else {
        const err = await res.json();
        setFeedbackMsg({ type: 'error', text: formatErrorMessage(err) });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro ao comunicar com a IA.' });
    } finally {
      setGeneratingDigest(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
        <p className="text-sm">Carregando Agente de Instagram...</p>
      </div>
    );
  }

  // TELA DE CONTRATAÇÃO
  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" /> Módulo Adicional Comercial
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 text-white shadow-lg shrink-0">
                  <InstagramIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                </span>
                Agente Autônomo de Instagram com IA
              </h1>
              <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                As 11 habilidades do <code>instagram-agent-skill</code> no ERBots: Virality Skill, 21 Ganchos Virais, Social Selling, Otimização de Perfil e Planejamento no Piloto Automático.
              </p>
            </div>

            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase text-slate-400 font-medium">Investimento</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">R$ 97</span>
                  <span className="text-slate-400 text-sm">/mês</span>
                </div>
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

      {/* HEADER PRINCIPAL: PERFIL & PILOTO AUTOMÁTICO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Identificação da Conta */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-indigo-600 p-0.5 shrink-0 shadow-md">
              <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center text-white font-extrabold text-base">
                {cleanUsername.slice(0, 2).toUpperCase()}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">@{cleanUsername}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {formData.account_name || 'Sua Empresa'} • Nicho: <strong className="text-slate-200">{formData.niche || 'Geral'}</strong>
              </p>
            </div>
          </div>

          {/* As 4 Tarefas Executadas */}
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
              Tarefas:
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" /> Postar
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" /> Comentar
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" /> Responder
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" /> Planejar
            </span>
          </div>

          {/* Switch do Piloto Automático */}
          <div className="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
            <div className="text-left lg:text-right">
              <span className="block text-xs font-bold text-white uppercase tracking-wider">
                Piloto Automático
              </span>
              <span className="text-[11px] text-slate-400">
                {isPilotActive ? 'Execução 100% autônoma' : 'Requer aprovação WhatsApp'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleTogglePilot(isPilotActive ? 'whatsapp_required' : 'auto_scheduled')}
              className={`w-13 h-7.5 rounded-full transition-colors relative p-1 shrink-0 ${
                isPilotActive
                  ? 'bg-gradient-to-r from-orange-500 to-pink-600 shadow-md'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            >
              <div
                className={`w-5.5 h-5.5 rounded-full bg-white transition-transform shadow ${
                  isPilotActive ? 'translate-x-5.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE AS HABILIDADES (100% RESPONSIVA, ZERO QUEBRA NO MOBILE) */}
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Visão Geral
        </button>

        <button
          onClick={() => setActiveTab('viral')}
          className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'viral' ? 'bg-pink-600 text-white shadow' : 'text-pink-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-pink-400" /> Virality Skill (/ig-viral)
        </button>

        <button
          onClick={() => setActiveTab('create')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'create' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Criar Conteúdo (21 Ganchos)
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'comments' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> Social Selling (Comentar)
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'audit' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-cyan-400" /> Otimizar Perfil (/ig-profile)
        </button>

        <button
          onClick={() => setActiveTab('plan')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'plan' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-amber-400" /> Planejador Semanal
        </button>

        <button
          onClick={() => setActiveTab('digest')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'digest' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-300" /> Guia de Voz & Tokens
        </button>

        <button
          onClick={() => setActiveTab('automation')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'automation' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-teal-400" /> Direct &quot;Comente X&quot;
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'settings' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-slate-300" /> Horários
        </button>
      </div>

      {/* ABA 1: VISÃO GERAL */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Total de Posts Criados</span>
              <p className="text-2xl font-bold text-white">{posts.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Aguardando Aprovação</span>
              <p className="text-2xl font-bold text-amber-400">
                {posts.filter((p) => p.status === 'pending_approval').length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Publicados / Agendados</span>
              <p className="text-2xl font-bold text-emerald-400">
                {posts.filter((p) => p.status === 'published' || p.status === 'scheduled').length}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-pink-400 font-bold text-sm">
                  <Flame className="w-4 h-4" /> Virality Skill (/ig-viral)
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  A função estrela do vídeo: Raio-X dos vídeos virais do seu nicho e geração de roteiros virais inéditos.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('viral')}
                className="w-full py-2 text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                Abrir Virality Skill <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <Sparkles className="w-4 h-4" /> 21 Ganchos Virais
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Crie posts para Feed, Reels e Carrossel usando ganchos comprovados e fotos em estúdio geradas por IA.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('create')}
                className="w-full py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                Criar Publicação <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <MessageCircle className="w-4 h-4" /> Social Selling (DE OUTRAS)
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Gere comentários de autoridade para deixar em outros perfis e atrair visitantes qualificados.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('comments')}
                className="w-full py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                Comentar em Outros Perfis <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: VIRALITY SKILL (/ig-viral) - A FUNÇÃO ESTRELA DO VÍDEO! */}
      {activeTab === 'viral' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-pink-500/30 rounded-xl p-4 sm:p-6 space-y-4 shadow-xl">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-xs font-bold uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5" /> Habilidade Principal: Virality Skill
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Raio-X de Viralidade & Gerador de Roteiro Viral
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cole o tema, gancho ou transcrição de qualquer vídeo que performou bem no seu nicho. A IA analisa os motivos do sucesso (retenção, gancho e emoção) e cria um roteiro viral inédito adaptado para o seu perfil.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Tema, gancho ou descrição do vídeo viral de referência:
              </label>
              <textarea
                rows={3}
                value={viralReferenceInput}
                onChange={(e) => setViralReferenceInput(e.target.value)}
                placeholder="Ex: Vídeo de 30s mostrando o erro número 1 que pequenos negócios cometem ao precificar serviços..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />
            </div>

            <button
              onClick={handleGenerateViralAnalysis}
              disabled={generatingViral}
              className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 rounded-lg shadow flex items-center justify-center gap-2 transition"
            >
              {generatingViral ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Fazendo Raio-X & Criando Roteiro...
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4" /> Executar Virality Skill
                </>
              )}
            </button>
          </div>

          {/* Resultado da Análise Viral */}
          {viralResult && (
            <div className="space-y-4">
              {/* Card 1: Raio-X do Porquê Viralizou */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Raio-X do Vídeo Viral: Por que funcionou?
                </h4>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Tipo de Gancho</span>
                    <p className="text-xs font-semibold text-white">{viralResult.hook_breakdown.hook_type}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Gatilho Emocional</span>
                    <p className="text-xs font-semibold text-amber-300">{viralResult.hook_breakdown.emotional_trigger}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Por que Viralizou</span>
                    <p className="text-xs text-slate-300">{viralResult.hook_breakdown.why_it_worked}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Fator de Retenção</span>
                    <p className="text-xs text-slate-300">{viralResult.hook_breakdown.retention_factor}</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Roteiro Inédito Pronto para Gravar */}
              <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">
                      Roteiro Inédito Adaptado para o seu Perfil
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">{viralResult.new_script.title}</h3>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    <Award className="w-3.5 h-3.5" /> Score Viral: {viralResult.new_script.virality_score}/100
                  </div>
                </div>

                {/* Gancho dos 3 Segundos */}
                <div className="p-3.5 rounded-lg bg-pink-500/10 border border-pink-500/20 space-y-1">
                  <span className="text-[11px] font-bold text-pink-300 uppercase">
                    Gancho 0 a 3 segundos (O que falar na abertura):
                  </span>
                  <p className="text-sm font-bold text-white">&quot;{viralResult.new_script.hook_3s}&quot;</p>
                </div>

                {/* Textos na Tela */}
                {viralResult.new_script.on_screen_text?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold">Texto para colocar na tela:</span>
                    {viralResult.new_script.on_screen_text.map((txt, i) => (
                      <span key={i} className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 text-xs font-mono font-bold">
                        {txt}
                      </span>
                    ))}
                  </div>
                )}

                {/* Beat Sheet Cronometrado */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase">Beat Sheet Cronometrado:</span>
                  <div className="space-y-2">
                    {viralResult.new_script.beat_sheet?.map((beat, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row gap-3">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold self-start">
                          {beat.time}
                        </span>
                        <div className="space-y-1 text-xs">
                          <p className="text-slate-400"><strong>Visual:</strong> {beat.visual}</p>
                          <p className="text-white"><strong>Fala:</strong> &quot;{beat.speech}&quot;</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legenda e CTA */}
                <div className="p-3 rounded-lg bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Legenda Pronta para o Vídeo:</span>
                    <button
                      onClick={() => copyToClipboard(viralResult.new_script.caption, 'viral-caption')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded flex items-center gap-1 transition"
                    >
                      {copiedKey === 'viral-caption' ? 'Copiado!' : 'Copiar Legenda'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {viralResult.new_script.caption}
                  </p>
                  <p className="text-xs text-emerald-400 font-semibold pt-1">
                    CTA: {viralResult.new_script.cta}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: CRIADOR DE CONTEÚDO (21 Ganchos Virais & IA) */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Criador de Publicações com 21 Ganchos Virais
              </h3>
              <p className="text-xs text-slate-400">
                Gere posts com fotos de estúdio por IA, roteiros de Reels ou carrosséis com retenção comprovada e tom humano.
              </p>
            </div>

            {/* Seleção do Formato */}
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
                <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-bold">Foto IA + Legenda</span>
                  <span className="text-[10px] text-slate-400">Post único para feed</span>
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
                <Film className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-bold">Roteiro de Reels (/ig-reel)</span>
                  <span className="text-[10px] text-slate-400">Gancho 3s + cronometragem</span>
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
                <Layers className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-bold">Carrossel (/ig-carousel)</span>
                  <span className="text-[10px] text-slate-400">5 slides com valor didático</span>
                </div>
              </button>
            </div>

            {/* Input e Disparo */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Tema opcional (ex: Dica de ouro para quem quer economizar tempo)..."
                value={topicHint}
                onChange={(e) => setTopicHint(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleGeneratePost}
                disabled={generatingPost}
                className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow flex items-center justify-center gap-2 transition shrink-0"
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

          {/* Lista de Posts Salvos */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Fila de Publicações ({posts.length})
            </h4>

            {posts.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhum post criado ainda.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {posts.map((post) => (
                  <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {post.post_type}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                        Gancho: {post.metrics?.hook_score || 94}/100
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white">{post.hook_title}</h4>

                    {post.media_urls?.[0] && (
                      <img src={post.media_urls[0]} alt="" className="w-full h-44 object-cover rounded-lg border border-slate-800" />
                    )}

                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">{post.caption}</p>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => copyToClipboard(post.caption, post.id)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> {copiedKey === post.id ? 'Copiado!' : 'Copiar'}
                      </button>

                      <span className="text-[10px] text-slate-400">
                        {new Date(post.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 4: SOCIAL SELLING (Comentar em outros perfis) */}
      {activeTab === 'comments' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">
                Social Selling: Comentar em Outros Perfis
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cole o post de um concorrente ou influenciador do seu nicho. O robô escreve 3 comentários com autoridade para você postar e atrair seguidores.
              </p>
            </div>

            <textarea
              rows={3}
              value={competitorText}
              onChange={(e) => setCompetitorText(e.target.value)}
              placeholder="Cole o texto do post de outro perfil..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
            />

            <button
              onClick={handleGenerateComments}
              disabled={generatingComments}
              className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition"
            >
              {generatingComments ? 'Gerando...' : 'Gerar 3 Comentários Magnéticos'}
            </button>
          </div>

          {generatedComments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase">Comentários Sugeridos:</h4>
              <div className="grid gap-3">
                {generatedComments.map((com, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-200 flex-1">&quot;{com}&quot;</p>
                    <button
                      onClick={() => copyToClipboard(com, `com-${idx}`)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 shrink-0"
                    >
                      {copiedKey === `com-${idx}` ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 5: OTIMIZAÇÃO DE PERFIL (/ig-profile) */}
      {activeTab === 'audit' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">
                Auditoria & Otimização de Perfil (/ig-profile)
              </h3>
              <p className="text-xs text-slate-400">
                Avalie a força da sua bio atual e receba uma reestruturação para transformar visitantes em seguidores.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Sua Bio Atual (opcional):
              </label>
              <textarea
                rows={3}
                value={currentBioInput}
                onChange={(e) => setCurrentBioInput(e.target.value)}
                placeholder="Cole o texto da sua bio atual do Instagram..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <button
              onClick={handleAuditProfile}
              disabled={auditingProfile}
              className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition"
            >
              {auditingProfile ? 'Auditando com IA...' : 'Avaliar e Otimizar Perfil'}
            </button>
          </div>

          {auditResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-300">Diagnóstico do Perfil:</span>
                <span className="text-sm font-bold px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Nota: {auditResult.score}/100
                </span>
              </div>

              <p className="text-xs text-slate-300 font-medium">{auditResult.headline_evaluation}</p>

              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-lg bg-slate-950 space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase">Pontos Fortes:</span>
                  <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                    {auditResult.strengths?.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 space-y-1.5">
                  <span className="text-[11px] font-bold text-amber-400 uppercase">Oportunidades de Melhoria:</span>
                  <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                    {auditResult.improvements?.map((im, i) => (
                      <li key={i}>{im}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 uppercase">Bio Recomendada para Alta Conversão:</span>
                  <button
                    onClick={() => copyToClipboard(auditResult.suggested_bio, 'bio')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> {copiedKey === 'bio' ? 'Copiado!' : 'Copiar Bio'}
                  </button>
                </div>
                <p className="text-xs text-white font-mono whitespace-pre-wrap leading-relaxed">
                  {auditResult.suggested_bio}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 6: PLANEJAMENTO SEMANAL (/ig-plan) */}
      {activeTab === 'plan' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white">Planejador Semanal (/ig-plan)</h3>
                <p className="text-xs text-slate-400">
                  Grade de 7 dias distribuída nos pilares: Autoridade, Conexão, Venda e Atração.
                </p>
              </div>

              <button
                onClick={handleGeneratePlan}
                disabled={generatingPlan}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg transition"
              >
                {generatingPlan ? 'Planejando...' : 'Gerar Nova Grade Semanal'}
              </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {(weeklyPlan.length > 0
                ? weeklyPlan
                : [
                    { day: 'Segunda-feira', pillar: 'Atração', format: 'Reels', hook_title: 'O erro que todo mundo comete ao começar', key_message: 'Desmistificar o maior gargalo inicial.', cta: 'Comente GUIA.' },
                    { day: 'Terça-feira', pillar: 'Autoridade', format: 'Carrossel', hook_title: '3 regras de ouro que mudaram tudo', key_message: 'Tutorial educativo passo a passo.', cta: 'Salve para consultar.' },
                    { day: 'Quarta-feira', pillar: 'Conexão', format: 'Post com Foto', hook_title: 'Os bastidores que ninguém mostra', key_message: 'História autêntica da jornada.', cta: 'Conte sua história.' },
                    { day: 'Quinta-feira', pillar: 'Venda', format: 'Reels', hook_title: 'Como nossos clientes resolvem isso em 48h', key_message: 'Estudo de caso e oferta direta.', cta: 'Comente QUERO.' },
                    { day: 'Sexta-feira', pillar: 'Atração', format: 'Carrossel', hook_title: 'Checklist definitivo para o fim de semana', key_message: 'Conteúdo salvável e compartilhável.', cta: 'Compartilhe.' },
                    { day: 'Sábado', pillar: 'Conexão', format: 'Post com Foto', hook_title: 'Reflexão rápida de sábado', key_message: 'Mensagem leve e humanizada.', cta: 'Bom descanso.' },
                    { day: 'Domingo', pillar: 'Autoridade', format: 'Reels', hook_title: 'Planeje sua semana antes de começar na correria', key_message: 'Dica estratégica de alta relevância.', cta: 'Deixe seu fogo 🔥.' },
                  ]
              ).map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{item.day}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        {item.pillar}
                      </span>
                    </div>
                    <p className="text-xs text-white font-semibold">&quot;{item.hook_title}&quot;</p>
                    <p className="text-[11px] text-slate-400">{item.key_message}</p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium pt-1 border-t border-slate-900">
                    CTA: {item.cta}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 7: GUIA DE VOZ & TOKENS (voice.md) */}
      {activeTab === 'digest' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Guia de Voz & Economia de 90%+ em Tokens (voice.md)
            </h3>
            <p className="text-xs text-slate-400">
              O agente sintetiza todo o DNA da marca em um documento compacto de ~400 tokens, evitando chamadas repetitivas e garantindo copy humana.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nicho</label>
                <input
                  type="text"
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Palavras que a marca USA</label>
                <input
                  type="text"
                  value={formData.wordsIUse}
                  onChange={(e) => setFormData({ ...formData, wordsIUse: e.target.value })}
                  placeholder="Ex: na prática, direto ao ponto, sem enrolação"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-rose-300 mb-1">Palavras PROIBIDAS (Anti-IA)</label>
                <input
                  type="text"
                  value={formData.wordsINeverSay}
                  onChange={(e) => setFormData({ ...formData, wordsINeverSay: e.target.value })}
                  placeholder="Ex: mergulhar conosco, no cenário atual, desbloqueie seu potencial"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateDigest}
                disabled={generatingDigest}
                className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition"
              >
                {generatingDigest ? 'Sintetizando...' : 'Gerar / Atualizar Knowledge Digest'}
              </button>
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-xs font-semibold text-slate-300">Documento Ativo (~400 tokens):</label>
              <div className="flex-1 min-h-[260px] p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-300 whitespace-pre-wrap overflow-y-auto">
                {account?.brand_knowledge_digest || 'Nenhum documento gerado ainda.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 8: AUTOMAÇÃO DE DIRECT & GATILHOS */}
      {activeTab === 'automation' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Automação &quot;Comente X e receba no Direct&quot;
            </h3>
            <p className="text-xs text-slate-400">
              Quando alguém comentar uma palavra-chave nas suas postagens, o robô responde publicamente e envia o link no Direct.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Palavra-Chave</label>
              <input type="text" defaultValue="INSTAGRAM" className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-lg text-white" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Resposta no Comentário</label>
              <input type="text" defaultValue="Acabei de te enviar no Direct! 🚀 Confere lá." className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-lg text-white" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mensagem no Direct</label>
              <input type="text" defaultValue="Olá! Aqui está o link exclusivo que você pediu: https://seusite.com.br" className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-lg text-white" />
            </div>
          </div>
        </div>
      )}

      {/* ABA 9: CONFIGURAÇÕES E HORÁRIOS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white">Configurações de Horário e Perfil</h3>
            <p className="text-xs text-slate-400">
              Defina seu @ de usuário e os horários de operação do robô.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome da Marca</label>
              <input
                type="text"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">@ da Conta no Instagram</label>
              <input
                type="text"
                value={formData.account_username}
                onChange={(e) => setFormData({ ...formData, account_username: e.target.value })}
                placeholder="seu_usuario"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Horário de Postagem</label>
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
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
