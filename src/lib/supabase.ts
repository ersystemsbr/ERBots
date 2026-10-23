import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://byshrvdanwgjdipogoxm.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Cliente público para uso no navegador com schema 'erbots' por padrão
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'erbots',
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper para instanciar cliente com Service Role (apenas backend/API routes)
export function getServiceSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  return createClient(supabaseUrl, serviceKey, {
    db: {
      schema: 'erbots',
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
