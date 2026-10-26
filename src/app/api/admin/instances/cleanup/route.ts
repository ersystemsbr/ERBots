import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getEvolutionConfig, deleteEvolutionInstance } from '@/lib/evolution';
import { logSystemEvent } from '@/lib/monitoring';

export const maxDuration = 30;

/**
 * Limpa instâncias órfãs, de teste ou desconectadas da Evolution API,
 * liberando memória e conexões no servidor Linux.
 *
 * Regras estritas de segurança:
 * 1. Instâncias com status 'open' NUNCA são deletadas automaticamente.
 * 2. Instâncias do GastroSys ('gastrosys_*') NUNCA são tocadas automaticamente.
 * 3. Instâncias ativas cadastradas em xerb_instances NUNCA são tocadas.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));
    const explicitTarget = typeof body.instanceName === 'string' ? body.instanceName.trim() : null;

    const { apiUrl, apiKey } = await getEvolutionConfig();
    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Evolution API não configurada.' }, { status: 500 });
    }

    const res = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Falha ao consultar Evolution API.' }, { status: 502 });
    }

    const instances: any[] = await res.json().catch(() => []);
    if (!Array.isArray(instances)) {
      return NextResponse.json({ error: 'Formato inválido retornado pela Evolution API.' }, { status: 502 });
    }

    const supabase = getServiceSupabase();
    const { data: dbInstances } = await supabase
      .from('xerb_instances')
      .select('instance_name, status');

    const registeredNames = new Set((dbInstances || []).map((r) => r.instance_name));

    const toDelete: string[] = [];

    if (explicitTarget) {
      // Se solicitou deletar uma instância específica
      const found = instances.find((i) => (i.name || i.instance?.instanceName) === explicitTarget);
      if (found) {
        toDelete.push(explicitTarget);
      }
    } else {
      // Limpeza automática de zumbis e testes
      for (const item of instances) {
        const name = String(item.name || item.instance?.instanceName || '').trim();
        const state = String(item.connectionStatus || item.instance?.state || '').toLowerCase();

        if (!name) continue;

        // Regra de segurança: nunca remove instâncias ativas/conectadas
        if (state === 'open') continue;

        // Regra de segurança: nunca remove instâncias do GastroSys no modo automático
        if (name.startsWith('gastrosys_')) continue;

        // Limpa instâncias de teste explícitas (ex: test_inst_1, test_inst_2)
        if (name.startsWith('test_') || name.startsWith('teste_')) {
          toDelete.push(name);
          continue;
        }

        // Limpa instâncias erbots_* desconectadas que não pertencem a nenhum tenant ativo
        if (name.startsWith('erbots_') && !registeredNames.has(name)) {
          toDelete.push(name);
        }
      }
    }

    const deleted: string[] = [];
    const failed: string[] = [];

    for (const instName of toDelete) {
      const ok = await deleteEvolutionInstance(instName);
      if (ok) {
        deleted.push(instName);
      } else {
        failed.push(instName);
      }
    }

    if (deleted.length > 0) {
      await logSystemEvent({
        level: 'info',
        source: 'admin.instances.cleanup',
        message: `Limpeza de instâncias zumbis: ${deleted.length} removida(s) (${deleted.join(', ')})`,
        metadata: { deleted, failed, totalFound: instances.length },
      });
    }

    return NextResponse.json({
      success: true,
      deletedCount: deleted.length,
      deleted,
      failed,
      remainingCount: instances.length - deleted.length,
    });
  } catch (err: any) {
    console.error('[Admin Instances Cleanup] Erro:', err);
    return NextResponse.json({ error: 'Erro interno ao limpar instâncias.' }, { status: 500 });
  }
}
