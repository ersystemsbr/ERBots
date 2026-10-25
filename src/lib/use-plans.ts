'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_ADDONS,
  PLANS,
  type CommercialAddons,
  type PlanDefinition,
  type PlanId,
} from './plans';

type PlansMap = Record<PlanId, PlanDefinition>;

let cached: { at: number; plans: PlansMap; addons: CommercialAddons } | null = null;

/**
 * Hook cliente: devolve planos + ofertas comerciais (desconto anual e pacote extra) configurados no admin.
 */
export function useCommercialCatalog(): { plans: PlansMap; addons: CommercialAddons } {
  const [state, setState] = useState<{ plans: PlansMap; addons: CommercialAddons }>({
    plans: cached?.plans || PLANS,
    addons: cached?.addons || DEFAULT_ADDONS,
  });

  useEffect(() => {
    let alive = true;
    if (cached && Date.now() - cached.at < 30_000) return;
    fetch('/api/plans')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.plans) {
          const next = {
            plans: d.plans as PlansMap,
            addons: (d.addons as CommercialAddons) || DEFAULT_ADDONS,
          };
          cached = { at: Date.now(), ...next };
          setState(next);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export function usePlans(): PlansMap {
  return useCommercialCatalog().plans;
}
