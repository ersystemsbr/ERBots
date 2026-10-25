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
    throw new Error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY ausente no servidor. Configure a variável de ambiente para operar as rotas de backend com segurança.'
    );
  }
  return createClient(supabaseUrl, serviceKeyEnv, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
