'use client';

import { useEffect, useState } from 'react';
import { PLANS, type PlanDefinition, type PlanId } from './plans';

type PlansMap = Record<PlanId, PlanDefinition>;

let cached: { at: number; plans: PlansMap } | null = null;

/**
 * Hook cliente: devolve os planos efetivos (preços editados no admin).
 * Começa com o padrão de plans.ts para renderizar instantaneamente e atualiza via /api/plans.
 */
export function usePlans(): PlansMap {
  const [plans, setPlans] = useState<PlansMap>(cached?.plans || PLANS);

  useEffect(() => {
    let alive = true;
    if (cached && Date.now() - cached.at < 30_000) return;
    fetch('/api/plans')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.plans) {
          cached = { at: Date.now(), plans: d.plans };
          setPlans(d.plans);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return plans;
}
