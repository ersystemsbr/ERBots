import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://byshrvdanwgjdipogoxm.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Cliente público para uso no navegador (schema public com tabelas prefixadas xerb_*)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper para instanciar cliente com Service Role (apenas backend/API routes)
export function getServiceSupabase() {
  const serviceKeyEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKeyEnv) {
    console.error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY NÃO configurada: usando anon key como fallback. ' +
        'Configure a variável na Vercel ANTES de aplicar o hardening de RLS (database/security_hardening.sql).'
    );
  }
  const serviceKey = serviceKeyEnv || supabaseAnonKey;
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
