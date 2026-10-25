import { getServiceSupabase } from '../supabase';
import {
  applyPlanOverrides,
  sanitizePlanOverrides,
  sanitizeAddonsConfig,
  DEFAULT_ADDONS,
  PLANS,
  type CommercialAddons,
  type PlanDefinition,
  type PlanId,
  type PlanOverrides,
} from '../plans';

/**
 * Configuração de planos e ofertas comerciais editável pelo admin (preço, limites, desconto anual e pacote extra).
 * Persistida em xerb_system_config (chaves `plans_config` e `billing_addons_config`).
 * Se a leitura falhar, usa o padrão de plans.ts (falha aberta, nunca derruba o atendimento).
 */
export const PLANS_CONFIG_KEY = 'plans_config';
export const ADDONS_CONFIG_KEY = 'billing_addons_config';

const CACHE_TTL_MS = 30_000;
let cache: { at: number; overrides: PlanOverrides } | null = null;
let addonsCache: { at: number; addons: CommercialAddons } | null = null;

export async function getPlanOverrides(force = false): Promise<PlanOverrides> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.overrides;
  try {
    const db = getServiceSupabase();
    const { data, error } = await db
      .from('xerb_system_config')
      .select('value')
      .eq('key', PLANS_CONFIG_KEY)
      .maybeSingle();
    if (error) throw error;
    const overrides = data?.value ? sanitizePlanOverrides(JSON.parse(data.value)) : {};
    cache = { at: Date.now(), overrides };
    return overrides;
  } catch (err) {
    console.warn('[Plans] Falha ao ler plans_config, usando padrão:', (err as any)?.message || err);
    return cache?.overrides || {};
  }
}

/** Tabela de planos efetiva (padrão + overrides do admin). */
export async function getPlansConfig(force = false): Promise<Record<PlanId, PlanDefinition>> {
  return applyPlanOverrides(await getPlanOverrides(force));
}

export async function savePlanOverrides(input: unknown): Promise<PlanOverrides> {
  const overrides = sanitizePlanOverrides(input);
  const db = getServiceSupabase();
  const { error } = await db.from('xerb_system_config').upsert(
    {
      key: PLANS_CONFIG_KEY,
      value: JSON.stringify(overrides),
      description: 'Preços, limites e textos dos planos (editado pelo painel admin)',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) throw error;
  cache = { at: Date.now(), overrides };
  return overrides;
}

export async function getAddonsConfig(force = false): Promise<CommercialAddons> {
  if (!force && addonsCache && Date.now() - addonsCache.at < CACHE_TTL_MS) return addonsCache.addons;
  try {
    const db = getServiceSupabase();
    const { data, error } = await db
      .from('xerb_system_config')
      .select('value')
      .eq('key', ADDONS_CONFIG_KEY)
      .maybeSingle();
    if (error) throw error;
    const addons = data?.value ? sanitizeAddonsConfig(JSON.parse(data.value)) : { ...DEFAULT_ADDONS };
    addonsCache = { at: Date.now(), addons };
    return addons;
  } catch (err) {
    console.warn('[Plans] Falha ao ler billing_addons_config, usando padrão:', (err as any)?.message || err);
    return addonsCache?.addons || { ...DEFAULT_ADDONS };
  }
}

export async function saveAddonsConfig(input: unknown): Promise<CommercialAddons> {
  const addons = sanitizeAddonsConfig(input);
  const db = getServiceSupabase();
  const { error } = await db.from('xerb_system_config').upsert(
    {
      key: ADDONS_CONFIG_KEY,
      value: JSON.stringify(addons),
      description: 'Desconto anual e pacote avulso de respostas IA (editado pelo painel admin)',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) throw error;
  addonsCache = { at: Date.now(), addons };
  return addons;
}

export { PLANS, DEFAULT_ADDONS };
