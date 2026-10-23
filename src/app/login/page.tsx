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

      // Localiza o tenant vinculado ao usuário (por user_id ou e-mail)
      if (data.user?.id) {
        const userEmail = data.user.email?.toLowerCase().trim();
        let { data: tenant } = await supabase
          .from('xerb_tenants')
          .select('*')
          .or(`user_id.eq.${data.user.id},email.eq.${userEmail}`)
          .maybeSingle();

        // Se o tenant existe mas ainda não tinha o user_id preenchido, atualiza
        if (tenant && (!tenant.user_id || tenant.user_id !== data.user.id)) {
          await supabase
            .from('xerb_tenants')
            .update({ user_id: data.user.id, updated_at: new Date().toISOString() })
            .eq('id', tenant.id);
        }

        // Se o usuário veio de outro sistema (ex: GastroSys) e ainda não tem tenant no ERBots
        if (!tenant && userEmail) {
          const compName = data.user.user_metadata?.company_name || data.user.user_metadata?.full_name || 'Minha Empresa';
          const isSuper = ['er.systems.br@gmail.com', 'seozefood@gmail.com'].includes(userEmail);
          const slug = `${compName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;

          const { data: newTenant } = await supabase
            .from('xerb_tenants')
            .insert({
              user_id: data.user.id,
              name: compName,
              slug,
              segment: 'Geral',
              email: userEmail,
              plan: isSuper ? 'business' : 'trial',
              subscription_status: isSuper ? 'active' : 'trialing',
              trial_ends_at: new Date(Date.now() + (isSuper ? 365 : 7) * 24 * 60 * 60 * 1000).toISOString(),
              is_super_admin: isSuper,
            })
            .select()
            .single();

          if (newTenant) {
            tenant = newTenant;
            // Cria robô padrão
            await supabase.from('xerb_bot_settings').insert({
              tenant_id: newTenant.id,
              bot_name: `Atendente da ${compName}`,
              tone: 'friendly',
              gemini_model: 'gemini-2.5-flash',
              system_prompt: `Você é o atendente virtual inteligente da empresa ${compName}.`,
              is_active: true,
              human_handoff_enabled: true,
            });
          }
        }

        if (tenant?.id) {
          localStorage.setItem('erbots_active_tenant_id', tenant.id);
        }
      }

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
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Sua Senha
              </label>
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
        </div>
      </div>
    </div>
  );
}
