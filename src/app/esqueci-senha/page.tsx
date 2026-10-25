'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bot, Mail, ArrowLeft, CheckCircle2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : 'https://www.erbots.com.br';
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/redefinir-senha`,
      });

      if (error) {
        throw new Error(error.message);
      }

      setSent(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível enviar o link de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center space-x-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bot className="w-7 h-7 text-slate-950 font-bold" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">
            ER<span className="text-emerald-400">Bots</span>
          </span>
        </Link>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">Recuperar Senha</h2>
        <p className="mt-1 text-sm text-slate-400">
          Enviaremos um link seguro para você cadastrar uma nova senha.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 sm:px-10 shadow-2xl rounded-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Verifique seu e-mail!</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Se existir uma conta vinculada a <strong className="text-slate-200">{email}</strong>, você receberá um link de redefinição em instantes (confira também a caixa de Spam).
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:underline pt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    E-mail Cadastrado
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'Enviando link...' : 'Enviar Link de Recuperação'}
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-400">
                <Link href="/login" className="inline-flex items-center gap-1 text-emerald-400 font-semibold hover:underline">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Lembrei minha senha, voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
