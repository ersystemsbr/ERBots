import { getServiceSupabase } from './supabase';

export const DEFAULT_ADMIN_EMAILS = [
  'er.systems.br@gmail.com',
  'seozefood@gmail.com',
];

export function isDefaultAdmin(email?: string | null): boolean {
  if (!email) return false;
  return DEFAULT_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Verifica se um determinado e-mail pertence a um Super Admin do ERBots
 */
export async function isSuperAdminEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();

  // 1. Checa lista estática padrão
  if (DEFAULT_ADMIN_EMAILS.includes(cleanEmail)) {
    return true;
  }

  // 2. Checa configuração dinâmica na tabela xerb_system_config
  try {
    const supabase = getServiceSupabase();
    const { data } = await supabase
      .from('xerb_system_config')
      .select('value')
      .eq('key', 'super_admin_emails')
      .maybeSingle();

    if (data?.value) {
      const configuredEmails = data.value
        .split(',')
        .map((e: string) => e.trim().toLowerCase());
      if (configuredEmails.includes(cleanEmail)) {
        return true;
      }
    }
  } catch (err) {
    console.warn('[Admin Auth] Erro ao verificar super_admin_emails em xerb_system_config:', err);
  }

  return false;
}
