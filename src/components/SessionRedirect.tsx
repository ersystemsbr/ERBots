'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Bot } from 'lucide-react';

export default function SessionRedirect() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let active = true;

    // Checa imediatamente se o usuário já tem token no localStorage do celular/navegador
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data?.session) {
        setRedirecting(true);
        router.replace('/dashboard');
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        setRedirecting(true);
        router.replace('/dashboard');
      }
    });

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [router]);

  if (!redirecting) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-slate-200 gap-3">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse">
        <Bot className="w-7 h-7 text-slate-950 font-bold" />
      </div>
      <p className="text-sm font-semibold text-white">Entrando no seu painel...</p>
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mt-1" />
    </div>
  );
}
