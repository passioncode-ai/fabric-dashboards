// #region spend-read — docs: docs/adr/0013-spend-from-the-agents.md#decision
// What every agent spent, read on demand from each service's own usage report (contract
// DEC-0021). Main process only: the token never reaches the renderer, which gets the sums. Read
// only while someone looks at Spend or an agent asks — nothing runs when the window is hidden
// (lifecycle LC-08).
import { summarizeUsage, type SpendSum, type SpendSummary, type UsageReport } from '@passioncode-ai/fabric-service-host/usage';
import type { Descriptor, WellKnown } from './types';

export type SpendEntry =
  | { key: string; kind: 'report'; summary: SpendSummary }
  | { key: string; kind: 'none' } // the service declares no usage surface, or has not answered yet
  | { key: string; kind: 'error'; error: string };

export interface SpendDeps {
  token: (tokenFile: string) => string;
  fetchUsage: (d: Descriptor, usagePath: string, token: string) => Promise<UsageReport>;
  now: () => number;
}

/** One read per service that declares `surfaces.usage`, all at once; a failure is that service's entry, never the whole answer. */
export async function readSpend(services: readonly { key: string; descriptor: Descriptor | null; wellKnown: WellKnown | null }[], deps: SpendDeps): Promise<SpendEntry[]> {
  return Promise.all(services.map(async (s): Promise<SpendEntry> => {
    const d = s.descriptor;
    const usagePath = s.wellKnown?.surfaces.usage?.path;
    if (!d || !usagePath) return { key: s.key, kind: 'none' };
    if (!usagePath.startsWith('/') || usagePath.startsWith('//')) return { key: s.key, kind: 'error', error: `the usage path ${JSON.stringify(usagePath)} is not a path on the service origin` };
    try {
      const report = await deps.fetchUsage(d, usagePath, deps.token(d.auth.tokenFile));
      return { key: s.key, kind: 'report', summary: summarizeUsage(report, deps.now()) };
    } catch (error) {
      return { key: s.key, kind: 'error', error: (error as Error).message };
    }
  }));
}
export type SpendWindow = 'today' | 'week' | 'month';

/**
 * The sum across agents for one window. Unknown is never $0: a window whose calls are all
 * unpriced is null; an unpriced agent or an unreadable one makes the sum a lower bound
 * (`partial`); only a window with no calls at all is $0.
 */
export function sumSpend(entries: readonly SpendEntry[], window: SpendWindow): SpendSum {
  const out: SpendSum = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: null, partial: entries.some((e) => e.kind === 'error') };
  for (const e of entries) {
    if (e.kind !== 'report') continue;
    const x = e.summary[window];
    out.calls += x.calls;
    out.inputTokens += x.inputTokens;
    out.outputTokens += x.outputTokens;
    if (x.costUsd !== null) out.costUsd = (out.costUsd ?? 0) + x.costUsd;
    if (x.partial || x.costUsd === null) out.partial = true;
  }
  if (out.calls === 0) out.costUsd = 0; // nothing was called: nothing was spent
  return out;
}
// #endregion spend-read
