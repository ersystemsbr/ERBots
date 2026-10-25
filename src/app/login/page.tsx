'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, ArrowRight, Mail, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
      }

      // O vínculo/criação do tenant é feito no servidor (/api/tenant/bootstrap) ao abrir o dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao realizar login.');
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
          Acesse seu Painel
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Entre com seu e-mail e senha para gerenciar seu robô.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 sm:px-10 shadow-2xl rounded-2xl">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                Seu E-mail
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Sua Senha
                </label>
                <Link
                  href="/esqueci-senha"
                  className="text-xs font-semibold text-emerald-400 hover:underline"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Entrar no Sistema'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Ainda não tem conta?{' '}
            <Link href="/cadastro" className="text-emerald-400 font-bold hover:underline">
              Testar Grátis por 7 Dias
            </Link>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-4 text-[11px] text-slate-500">
            <Link href="/termos" className="hover:text-slate-300 transition">
              Termos de Uso
            </Link>
            <span>•</span>
            <Link href="/privacidade" className="hover:text-slate-300 transition">
              Privacidade (LGPD)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
