'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, CheckCircle2, ArrowRight, Building2, User, Phone, Mail, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CadastroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [segment, setSegment] = useState<string>('Clínicas & Saúde');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [website, setWebsite] = useState<string>(''); // Honeypot anti-bot
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!acceptedTerms) {
      setErrorMsg('Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar sua conta.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          ownerName,
          segment,
          phone,
          email,
          password,
          website,
          acceptedTerms,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar conta');
      }

      // Faz login automático na sessão do Supabase no navegador
      try {
        await supabase.auth.signInWithPassword({
          email,
          password,
        });
      } catch (authErr) {
        console.warn('Auto sign-in aviso:', authErr);
      }

      if (data.tenant?.id) {
        localStorage.setItem('erbots_active_tenant_id', data.tenant.id);
      }

      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500 selection:text-slate-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center space-x-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bot className="w-7 h-7 text-slate-950 font-bold" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">
            ER<span className="text-emerald-400">Bots</span>
          </span>
        </Link>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Comece seu Teste Grátis de 7 Dias
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Crie seu atendente de WhatsApp com IA já pré-treinado para o seu segmento. Sem cartão de crédito.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 sm:px-10 shadow-2xl rounded-2xl">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot oculto para bloquear robôs de spam */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  Nome da Empresa / Negócio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Imobiliária Silva"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  Seu Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Segmento de Atuação (pré-treina sua IA)
                </label>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="Clínicas & Saúde">Clínicas, Consultórios &amp; Saúde</option>
                  <option value="Imobiliárias & Corretores">Imobiliárias &amp; Corretores</option>
                  <option value="Barbearias & Estética">Barbearias, Salões &amp; Estética</option>
                  <option value="Comércio & Lojas">Comércio, Lojas &amp; Varejo</option>
                  <option value="Escritórios & Serviços">Escritórios, Advocacia &amp; Contábil</option>
                  <option value="Pet Shop & Veterinária">Pet Shop &amp; Clínicas Veterinárias</option>
                  <option value="Outro">Outro Ramo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  WhatsApp Comercial (com DDD)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 11999998888"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                E-mail para Login *
              </label>
              <input
                type="email"
                required
                placeholder="seuemail@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Senha de Acesso * (mínimo 8 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 leading-relaxed">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span>
                  Li e concordo com os{' '}
                  <Link href="/termos" target="_blank" className="text-emerald-400 font-semibold hover:underline">
                    Termos de Uso
                  </Link>{' '}
                  e com a{' '}
                  <Link href="/privacidade" target="_blank" className="text-emerald-400 font-semibold hover:underline">
                    Política de Privacidade (LGPD)
                  </Link>
                  .
                </span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
              >
                {loading ? 'Criando seu ambiente...' : 'Criar Conta e Iniciar Teste Grátis'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Benefícios */}
          <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 7 dias 100% grátis
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Sem compromisso
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Setup em 2 minutos
            </span>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Já tem uma conta cadastrada?{' '}
            <Link href="/login" className="text-emerald-400 font-bold hover:underline">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
