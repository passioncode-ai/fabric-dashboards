// FD-273 (the operator, 2026-11-15, board d660cc30: «навести на агента, и вот всплывающим показано, где он находится,
// какая организация … в разворачиваемой информации сверху … туда всю эту мету тоже добавить»): an agent's whereabouts
// in words, read from what the app already holds (its descriptor, the placement record's reasons, its organization, its
// well-known answer). One reading feeds the sidebar row's tooltip (short) and the details card (full); the fields no
// descriptor declares yet (who has access, data isolation, the space it runs in) are asked of fabric-agent-contract and
// are not guessed here.
// #region agent-facts — docs: docs/ux/scenarios.md#scn-117-see-where-an-agent-runs
import { placedElsewhere } from '@passioncode-ai/fabric-service-host/state';
import { installedByWords } from './installed-by';
import { repositoryKey } from './organizations';
import type { ServiceSnapshot } from './types';

/** Words for one line: a dictionary key and its parameters, translated by the page. */
export interface Words { code: string; params: Record<string, string> }

/** Where an agent runs: on this computer, on another machine the placement record names, or online at an origin. */
export type Where =
  | { kind: 'here' }
  | { kind: 'machine'; machine: string; forward: boolean }
  | { kind: 'cloud'; provider: string | null; host: string };

/** Hosting providers known by the host their services answer under; anything else is named by its host alone. */
const PROVIDERS: readonly [RegExp, string][] = [
  [/\.workers\.dev$/, 'Cloudflare'],
  [/\.pages\.dev$/, 'Cloudflare'],
  [/\.herokuapp\.com$/, 'Heroku'],
  [/\.fly\.dev$/, 'Fly.io'],
  [/\.vercel\.app$/, 'Vercel'],
  [/\.netlify\.app$/, 'Netlify'],
  [/\.onrender\.com$/, 'Render'],
  [/\.up\.railway\.app$/, 'Railway'],
  [/\.run\.app$/, 'Google Cloud Run'],
  [/\.ondigitalocean\.app$/, 'DigitalOcean'],
  [/\.azurewebsites\.net$/, 'Azure'],
  [/\.amazonaws\.com$/, 'AWS'],
];

/** The provider a host belongs to, by its suffix; null when the host is not one of theirs (a custom domain). */
export function cloudProvider(host: string): string | null {
  const h = host.toLowerCase();
  for (const [re, name] of PROVIDERS) if (re.test(h)) return name;
  return null;
}

function hostOf(origin: string | undefined): string {
  if (!origin) return '';
  try { return new URL(origin).host; } catch { return origin; }
}

export function whereOf(s: Pick<ServiceSnapshot, 'descriptor' | 'reasons'>): Where {
  if (s.descriptor?.placement === 'remote') {
    const host = hostOf(s.descriptor.origin);
    return { kind: 'cloud', provider: cloudProvider(host), host };
  }
  const machine = placedElsewhere(s.reasons);
  if (machine === null) return { kind: 'here' };
  const forward = s.reasons.some((r) => r.code === 'reason.reached.elsewhere' || (r.code === 'reason.elsewhere' && r.params?.forward !== undefined));
  return { kind: 'machine', machine, forward };
}

export function whereWords(w: Where): Words {
  if (w.kind === 'here') return { code: 'place.local', params: {} };
  if (w.kind === 'machine') return { code: 'where.machine', params: w.forward ? { machine: w.machine, forward: 'yes' } : { machine: w.machine } };
  return w.provider ? { code: 'where.cloud', params: { provider: w.provider, host: w.host } } : { code: 'where.host', params: { host: w.host } };
}

/** The organization line: its label, yours when it is the personal one, or not attributed; null when no map was read. */
export function organizationWords(s: Pick<ServiceSnapshot, 'organization'>): Words | null {
  if (s.organization === undefined) return null;
  if (!s.organization) return { code: 'orgs.none', params: {} };
  return s.organization.personal ? { code: 'facts.orgPersonal', params: { name: s.organization.label } } : { code: 'facts.text', params: { value: s.organization.label } };
}

export interface Fact { label: string; value: Words }

/** The details card's facts, in reading order; a fact the agent does not declare is left out. `copies` are the other
 *  instances of the same product (another place, another organization). */
export function agentFacts(s: ServiceSnapshot, copies: readonly ServiceSnapshot[] = []): Fact[] {
  const out: Fact[] = [{ label: 'facts.where', value: whereWords(whereOf(s)) }];
  const org = organizationWords(s);
  if (org) out.push({ label: 'health.organization', value: org });
  const dash = s.wellKnown?.surfaces.dashboard;
  if (dash) out.push({ label: 'facts.entry', value: { code: dash.login ? 'facts.entry.login' : 'facts.entry.open', params: {} } });
  const repo = repositoryKey(s.descriptor?.source?.repository);
  if (repo) out.push({ label: 'facts.repository', value: { code: 'facts.text', params: { value: repo } } });
  if (s.wellKnown) out.push({ label: 'health.version', value: { code: 'facts.text', params: { value: s.wellKnown.service.version } } });
  const by = installedByWords(s.descriptor);
  if (by) out.push({ label: 'health.installedBy', value: by });
  if (s.descriptor?.installedAt && !Number.isNaN(Date.parse(s.descriptor.installedAt))) {
    out.push({ label: 'facts.installedAt', value: { code: 'facts.date', params: { at: s.descriptor.installedAt } } });
  }
  const others = copies.filter((c) => c.key !== s.key);
  if (others.length > 0) {
    out.push({ label: 'facts.copies', value: { code: 'facts.copies.n', params: { n: String(others.length) } } });
  }
  return out;
}

/** The tooltip's lines after the name and state: where each copy runs, then the organization. */
export function agentHint(s: ServiceSnapshot, members: readonly ServiceSnapshot[] = [s]): Words[] {
  const seen = new Set<string>();
  const lines: Words[] = [];
  for (const m of members.length > 0 ? members : [s]) {
    const w = whereWords(whereOf(m));
    const id = `${w.code}|${JSON.stringify(w.params)}`;
    if (!seen.has(id)) { seen.add(id); lines.push(w); }
  }
  const org = organizationWords(s);
  if (org && s.organization) lines.push(org);
  return lines;
}
// #endregion agent-facts
