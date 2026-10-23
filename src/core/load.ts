// #region load-read — docs: docs/ux/scenarios.md#scn-076-see-how-busy-an-agent-is
// FD-93: how busy one agent is, read on demand from its own load report (contract DEC-0104, `service-load/1`). Main
// process only: the token never reaches the renderer, which gets the sums. Read only while someone looks at the agent's
// Load tab or an agent asks (MCP `load`); nothing runs when the window is hidden (lifecycle LC-08).
import { loadOf, summarizeLoad, type LoadDeclaration, type LoadReport, type LoadSummary } from '@passioncode-ai/fabric-service-host/load';
import type { Descriptor, Reason, WellKnown } from './types';

export type LoadEntry =
  | { key: string; kind: 'report'; declaration: LoadDeclaration; summary: LoadSummary }
  | { key: string; kind: 'none' } // the service declares no load extension, or has not answered yet
  | { key: string; kind: 'invalid'; errors: string[] } // FAC-SEM-133: declared wrongly; not read, and reported
  | { key: string; kind: 'error'; declaration: LoadDeclaration | null; error: string; reason: Reason }; // `error` English (agents); `reason` for the window

export interface LoadDeps {
  token: (tokenFile: string) => string | Promise<string>;
  fetchLoad: (d: Descriptor, loadPath: string, token: string) => Promise<LoadReport>;
  now: () => number;
}

/** One service's load. The token goes only to a document that is this service's own (S-1): a foreign answer, or a
 *  well-known document of another service, is never read. A failure is an entry with its reason, never a throw. */
export async function readLoad(s: { key: string; state?: string; descriptor: Descriptor | null; wellKnown: WellKnown | null }, deps: LoadDeps): Promise<LoadEntry> {
  const d = s.descriptor;
  const own = Boolean(d && s.wellKnown && s.wellKnown.service.id === d.id && s.wellKnown.service.instance === d.instance && s.state !== 'foreign');
  if (!d || !own) return { key: s.key, kind: 'none' };
  const view = loadOf(s.wellKnown);
  if (view.reported) return { key: s.key, kind: 'invalid', errors: view.errors };
  if (!view.declaration) return { key: s.key, kind: 'none' };
  try {
    const report = await deps.fetchLoad(d, view.declaration.path, await deps.token(d.auth.tokenFile));
    return { key: s.key, kind: 'report', declaration: view.declaration, summary: summarizeLoad(report, deps.now()) };
  } catch (error) {
    const reason = (error as { reason?: Reason }).reason ?? { code: 'load.err.unreachable', params: { error: String((error as Error).message).slice(0, 200) } };
    return { key: s.key, kind: 'error', declaration: view.declaration, error: (error as Error).message, reason };
  }
}
// #endregion load-read
