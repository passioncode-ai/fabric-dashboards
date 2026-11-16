// FD-273 (the operator, 2026-11-15, board d660cc30: «навести на агента, и вот всплывающим показано, где он находится,
// какая организация … в разворачиваемой информации сверху … туда всю эту мету тоже добавить»): an agent's whereabouts
// in words, read from what the app already holds (its descriptor, the placement record's reasons, its organization, its
// well-known answer). One reading feeds the sidebar row's tooltip (short) and the details card (full). Who it serves, how
// its dashboard is entered, how it keeps data apart and the space it runs in are the service's own declaration (contract
// DEC-0173, extensions/instance-facts/0.1, SCR-36), read by the contract's reference reading and never guessed: a service
// that declares none shows none.
// #region agent-facts — docs: docs/ux/scenarios.md#scn-117-see-where-an-agent-runs
import { instanceFacts } from '@passioncode-ai/fabric-service-host/instance-facts';
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

/** `declared`: the service's own word (DEC-0173), shown as such; never verified. */
export interface Fact { label: string; value: Words; declared?: true }

/** DEC-0173, SCR-36: the facts an instance declares, in the contract's words; none when it declares none. */
export function declaredFacts(s: Pick<ServiceSnapshot, 'descriptor' | 'wellKnown' | 'organization'>): Fact[] {
  const view = instanceFacts(s.descriptor, s.wellKnown);
  if (!view.declared) return [];
  const f = view.facts;
  const out: Fact[] = [];
  const remote = s.descriptor?.placement === 'remote';
  const peer = Boolean((s.descriptor as { peer?: unknown } | null | undefined)?.peer);
  const org = s.organization && !s.organization.personal ? s.organization.label : null;
  if (f.audience === 'operator') out.push({ label: 'facts.audience', value: { code: 'facts.audience.operator', params: {} }, declared: true });
  if (f.audience === 'public') out.push({ label: 'facts.audience', value: { code: 'facts.audience.public', params: {} }, declared: true });
  if (f.audience === 'organization') {
    // Beside peer: its organization's people and anyone granted (a personal context names no organization); on a remote
    // instance without peer: an organization's people with their own keys.
    const value: Words = peer || !remote
      ? (org ? { code: 'facts.audience.organization', params: { org } } : { code: 'facts.audience.granted', params: {} })
      : (org ? { code: 'facts.audience.ownKeys', params: { org } } : { code: 'facts.audience.ownKeysAny', params: {} });
    out.push({ label: 'facts.audience', value, declared: true });
  }
  const entry = { 'host-signin': 'facts.entry.login', 'own-signin': 'facts.entry.own', none: 'facts.entry.open' } as const;
  if (f.entry) out.push({ label: 'facts.entry', value: { code: entry[f.entry], params: {} }, declared: true });
  if (f.mode) out.push({ label: 'facts.tenancy', value: { code: `facts.tenancy.${f.mode}`, params: {} }, declared: true });
  if (f.kind) out.push({ label: 'facts.space', value: { code: f.kind === 'user' && remote ? 'facts.space.userRemote' : `facts.space.${f.kind}`, params: {} }, declared: true });
  if (f.account) out.push({ label: 'facts.account', value: { code: 'facts.text', params: { value: f.account } }, declared: true });
  return out;
}

/** The details card's facts, in reading order; a fact the agent does not declare is left out. `copies` are the other
 *  instances of the same product (another place, another organization). */
export function agentFacts(s: ServiceSnapshot, copies: readonly ServiceSnapshot[] = []): Fact[] {
  const out: Fact[] = [{ label: 'facts.where', value: whereWords(whereOf(s)) }];
  const org = organizationWords(s);
  if (org) out.push({ label: 'health.organization', value: org });
  out.push(...declaredFacts(s));
  const repo = repositoryKey(s.descriptor?.source?.repository);
  if (repo) out.push({ label: 'facts.repository', value: { code: 'facts.text', params: { value: repo } } });
  // The version is in the card's line of facts above this list (version, build, pid, port, uptime), not here again.
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
