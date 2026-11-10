// FD-162: the organization each agent belongs to, from Project Observatory's project registry (its estate survey with
// `detail: full`: every project's repositories and its organization, decided by the operator's rules). An agent is
// matched by its descriptor's `source.repository`; one Observatory does not know is not attributed, never guessed.
// The app keeps the map in `organizations.json` beside the settings (src/core/organization-store.ts).
// #region organizations — docs: docs/ux/scenarios.md#scn-094-show-only-one-organizations-agents

/** `personal`: the operator's own organization (Observatory's `default: true`, the context Switchboard and the Studio call
 *  `personal`); the filter's "Mine" (FD-195). */
export interface Organization { name: string; label: string; personal?: boolean }

export interface OrganizationsCache {
  readAt: string | null;
  /** `owner/name` (lower case) of every repository Observatory knows -> its project's organization name. */
  byRepository: Record<string, string>;
  /** Organization name -> its label as the operator named it (`acme` -> `Acme`). */
  organizations: Record<string, string>;
  /** FD-195: the operator's own organization, the one Observatory's config marks `default: true`; null when not known. */
  personal?: string | null;
  /** FD-197: the organizations whose products are the platform (Observatory's config `platform: true`, else the one that
   *  owns this app's repository); an instance of one runs for the organization of the context it runs in. */
  platform?: string[];
  /** FD-197: a Cloudflare Worker's name -> the organization of the one account Observatory lists it in (accounts matched
   *  by `match.cloudflare_accounts`); a name listed in two accounts is left out, never guessed. */
  byWorker?: Record<string, string>;
  /** FD-197: a Cloudflare zone (`example.com`) -> the organization of its account. */
  byZone?: Record<string, string>;
}

export const EMPTY_ORGANIZATIONS: OrganizationsCache = { readAt: null, byRepository: {}, organizations: {} };

/** How often the map is read again, and how long after the app starts it is first read. */
export const ORGANIZATIONS_EVERY_MS = 30 * 60_000;
export const ORGANIZATIONS_FIRST_MS = 25_000;

/** `owner/name` of a repository URL (`https://github.com/owner/name(.git)`, `git@host:owner/name.git`) or of
 *  `owner/name` itself, in lower case; null for anything else. */
export function repositoryKey(repository: string | undefined | null): string | null {
  if (!repository) return null;
  const m = /([A-Za-z0-9][\w.-]*)\/([\w.-]+?)(?:\.git)?\/?$/.exec(repository.trim());
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null;
}

/** One page of the survey (`projects[]` with `repositories[].nameWithOwner` and `organization {name, label}`), added
 *  to the map; the page's `nextCursor`, or null at the end. A project with no organization adds nothing. */
export function addSurveyPage(into: OrganizationsCache, page: unknown): string | null {
  const doc = (page && typeof page === 'object' ? page : {}) as { projects?: unknown; nextCursor?: unknown };
  for (const p of Array.isArray(doc.projects) ? doc.projects : []) {
    const project = (p && typeof p === 'object' ? p : {}) as { organization?: { name?: unknown; label?: unknown }; repositories?: unknown };
    const name = typeof project.organization?.name === 'string' ? project.organization.name : null;
    if (!name) continue;
    into.organizations[name] = typeof project.organization?.label === 'string' && project.organization.label ? project.organization.label : name;
    for (const r of Array.isArray(project.repositories) ? project.repositories : []) {
      const key = repositoryKey((r as { nameWithOwner?: unknown })?.nameWithOwner as string | undefined);
      if (key && !(key in into.byRepository)) into.byRepository[key] = name;
    }
  }
  return typeof doc.nextCursor === 'string' && doc.nextCursor ? doc.nextCursor : null;
}

/** FD-162: Project Observatory's own registry file (`registry/projects.json`, schema 2), read on this Mac without a
 *  token: each project's `organization` and its `membership_rules`, whose `owner/name: why` rules name its repositories
 *  (a rule for a local folder names none); `organization_labels` (from Observatory's `config/organizations.json`, added
 *  by the reader) names them as the operator did. Whether it was the expected shape. */
export function addRegistryProjects(into: OrganizationsCache, doc: unknown): boolean {
  const d = (doc && typeof doc === 'object' ? doc : {}) as { schema_version?: unknown; projects?: unknown; organization_labels?: Record<string, unknown>; organization_personal?: unknown; organization_platform?: unknown; cloudflare_accounts?: unknown };
  if (d.schema_version !== 2 || !Array.isArray(d.projects)) return false;
  // FD-195: the organization Observatory's config marks `default: true` (added by the reader beside the labels).
  if (typeof d.organization_personal === 'string' && d.organization_personal) into.personal = d.organization_personal;
  // FD-197: the platform's organizations and the Cloudflare accounts' (added by the reader beside the labels).
  if (Array.isArray(d.organization_platform)) into.platform = d.organization_platform.filter((x): x is string => typeof x === 'string' && x !== '');
  if (d.cloudflare_accounts !== undefined) addCloudflareAccounts(into, d.cloudflare_accounts);
  const labelOf = (name: string) => (typeof d.organization_labels?.[name] === 'string' && d.organization_labels[name] ? d.organization_labels[name] as string : name);
  // FD-197: every organization the operator configured is known by name, so an instance named after one finds it.
  for (const name of Object.keys(d.organization_labels ?? {})) into.organizations[name] ??= labelOf(name);
  for (const p of d.projects) {
    const project = (p && typeof p === 'object' ? p : {}) as { organization?: unknown; membership_rules?: unknown };
    if (typeof project.organization !== 'string' || !project.organization) continue;
    into.organizations[project.organization] ??= labelOf(project.organization);
    for (const rule of Array.isArray(project.membership_rules) ? project.membership_rules : []) {
      const m = typeof rule === 'string' ? /^([A-Za-z0-9][\w.-]*\/[\w.-]+): /.exec(rule) : null;
      const key = m ? repositoryKey(m[1]) : null;
      if (key && !(key in into.byRepository)) into.byRepository[key] = project.organization;
    }
  }
  return true;
}

/** FD-197: Observatory's Cloudflare inventory (`registry/cloudflare-account.json`): each account's `organization` (its
 *  config's `match.cloudflare_accounts`) given to the Workers and zones listed in it. An account with no organization,
 *  or a Worker name listed in two accounts, gives nothing. */
export function addCloudflareAccounts(into: OrganizationsCache, doc: unknown): void {
  const d = (doc && typeof doc === 'object' ? doc : {}) as { accounts?: unknown; resources?: unknown };
  const orgOf = new Map<string, string>();
  for (const a of Array.isArray(d.accounts) ? d.accounts : []) {
    const acc = (a && typeof a === 'object' ? a : {}) as { id?: unknown; organization?: unknown };
    if (typeof acc.id === 'string' && typeof acc.organization === 'string' && acc.organization) orgOf.set(acc.id, acc.organization);
  }
  const workers = new Map<string, Set<string>>();
  const zones: Record<string, string> = {};
  for (const r of Array.isArray(d.resources) ? d.resources : []) {
    const res = (r && typeof r === 'object' ? r : {}) as { kind?: unknown; name?: unknown; account_ref?: unknown };
    if (typeof res.name !== 'string' || typeof res.account_ref !== 'string') continue;
    const name = res.name.toLowerCase();
    if (res.kind === 'worker') workers.set(name, (workers.get(name) ?? new Set()).add(res.account_ref));
    const org = orgOf.get(res.account_ref);
    if (res.kind === 'zone' && org) zones[name] = org;
  }
  const byWorker: Record<string, string> = {};
  for (const [name, accounts] of workers) {
    const [only] = accounts;
    const org = accounts.size === 1 && only ? orgOf.get(only) : undefined;
    if (org) byWorker[name] = org;
  }
  into.byWorker = byWorker;
  into.byZone = zones;
}

const named = (cache: OrganizationsCache, name: string): Organization =>
  ({ name, label: cache.organizations[name] ?? name, ...(cache.personal && cache.personal === name ? { personal: true } : {}) });

/** The organization of a repository, or null when the map does not know it. */
export function organizationOf(cache: OrganizationsCache, repository: string | undefined | null): Organization | null {
  const key = repositoryKey(repository);
  const name = key ? cache.byRepository[key] : undefined;
  return name ? named(cache, name) : null;
}

/** FD-197: the owner of this app's own repository (package.json `repository`, held by a test): the platform's
 *  publisher, whose organization is the platform's when Observatory's config marks none `platform: true`. */
export const OWN_REPOSITORY_OWNER = 'passioncode-ai';

/** What FD-197 reads of an installed service to place it in the context it runs in. */
export interface InstanceContext {
  /** `id.instance`. */
  key: string;
  repository?: string | null;
  placement?: string | null;
  origin?: string | null;
}

// FD-197 (studio-agent's DEC-0052, board thread `6e6a922d`): an instance belongs to the organization of the context it
// runs in, before the owner of its repository. In order: an instance named after an organization (`.acme`) is that
// organization's; an online one whose host is a Worker or a zone of a Cloudflare account Observatory attributes is that
// account's organization's; an instance of a platform product (Observatory, Fabric Inbox: infrastructure each
// organization runs a copy of) on this Mac runs in this space, so it is this space's own organization's. Anything else
// keeps its repository's organization (FD-162); nothing is guessed.
/** The organization of one installed instance, or null when nothing names it. */
export function organizationOfInstance(cache: OrganizationsCache, s: InstanceContext): Organization | null {
  const instance = s.key.includes('.') ? s.key.slice(s.key.indexOf('.') + 1).toLowerCase() : '';
  if (instance && instance in cache.organizations) return named(cache, instance);
  const host = s.placement === 'remote' && s.origin ? hostOf(s.origin) : null;
  if (host) {
    const worker = host.endsWith('.workers.dev') ? cache.byWorker?.[host.slice(0, host.indexOf('.'))] : undefined;
    if (worker) return named(cache, worker);
    const zones = cache.byZone ?? {};
    const zone = Object.keys(zones).filter((z) => host === z || host.endsWith(`.${z}`)).sort((a, b) => b.length - a.length)[0];
    const owner = zone ? zones[zone] : undefined;
    if (owner) return named(cache, owner);
  }
  const own = organizationOf(cache, s.repository);
  if (own && s.placement !== 'remote' && cache.personal && cache.platform?.includes(own.name)) return named(cache, cache.personal);
  return own;
}

function hostOf(origin: string): string | null {
  try { return new URL(origin).hostname.toLowerCase() || null; } catch { return null; }
}

// FD-195 (SCN-094 steps 7 to 9): the filter's three kinds besides organization names: "Mine" (the personal
// organization's agents), "Other organizations" (every attributed agent that is not mine) and "Shared between
// organizations" (an agent whose product runs here in two organizations or more, as one copy each). A name and a kind
// combine as a union.
export const ORG_MINE = '@mine';
export const ORG_OTHERS = '@others';
export const ORG_SHARED = '@shared';
export const ORG_KINDS: readonly string[] = [ORG_MINE, ORG_OTHERS, ORG_SHARED];

/** The product of a service key (`example-agent.acme` -> `example-agent`). */
const productOf = (key: string) => key.slice(0, key.indexOf('.') < 0 ? key.length : key.indexOf('.'));

/** FD-195: the products that run here in two organizations or more (an agent not attributed counts for none). */
export function sharedProducts(services: readonly { key: string; organization?: Organization | null }[]): Set<string> {
  const orgs = new Map<string, Set<string>>();
  for (const s of services) {
    if (!s.organization) continue;
    const p = productOf(s.key);
    orgs.set(p, (orgs.get(p) ?? new Set()).add(s.organization.name));
  }
  return new Set([...orgs].filter(([, set]) => set.size >= 2).map(([p]) => p));
}
export const isShared = (shared: ReadonlySet<string>, key: string): boolean => shared.has(productOf(key));

/** The agents an organization filter keeps: every one when nothing is chosen; `''` stands for "Not attributed"; the
 *  kinds of FD-195 keep mine, the other organizations' and the shared ones. */
export function keepsOrganization(chosen: readonly string[], organization: Organization | null | undefined, shared = false): boolean {
  if (chosen.length === 0 || chosen.includes(organization?.name ?? '')) return true;
  if (chosen.includes(ORG_MINE) && organization?.personal) return true;
  if (chosen.includes(ORG_OTHERS) && organization && !organization.personal) return true;
  return chosen.includes(ORG_SHARED) && shared;
}
/** The services an organization filter keeps, and the one open on the page whatever the filter (it never vanishes
 *  under the person's eyes). */
export function filterServices<S extends { key: string; organization?: Organization | null }>(services: readonly S[], chosen: readonly string[], keep?: string | null): S[] {
  if (chosen.length === 0) return [...services];
  const shared = chosen.includes(ORG_SHARED) ? sharedProducts(services) : new Set<string>();
  return services.filter((s) => s.key === keep || keepsOrganization(chosen, s.organization, isShared(shared, s.key)));
}

/** FD-195: how many agents each kind of the filter keeps; `mine` is null when the personal organization is not known. */
export function kindCounts(services: readonly { key: string; organization?: Organization | null }[]): { mine: number | null; others: number; shared: number } {
  const shared = sharedProducts(services);
  const personal = services.some((s) => s.organization?.personal);
  return {
    mine: personal ? services.filter((s) => s.organization?.personal).length : null,
    others: services.filter((s) => s.organization && !s.organization.personal).length,
    shared: services.filter((s) => isShared(shared, s.key)).length,
  };
}

/** The organizations among the services, with how many agents each has, by label; `''` (not attributed) last. Empty
 *  when no service carries an organization at all (no map was read). */
export function organizationCounts(services: readonly { organization?: Organization | null }[]): { name: string; label: string | null; count: number; personal?: boolean }[] {
  if (!services.some((s) => s.organization !== undefined)) return [];
  const by = new Map<string, { name: string; label: string | null; count: number; personal?: boolean }>();
  for (const s of services) {
    const name = s.organization?.name ?? '';
    const row = by.get(name) ?? { name, label: s.organization?.label ?? null, count: 0, ...(s.organization?.personal ? { personal: true } : {}) };
    row.count += 1;
    by.set(name, row);
  }
  return [...by.values()].sort((a, b) => (a.name === '' ? 1 : b.name === '' ? -1 : (a.label ?? a.name).localeCompare(b.label ?? b.name)));
}
/**
 * FD-161 (SCN-094): one section's rows split by organization, in the order `organizationCounts` names them ("Not
 * attributed" last), each group keeping the rows' own order (the sort the person chose). Null when the rows are of one
 * organization, or no organization is known: then there is nothing to split and no heading is drawn.
 */
export function groupByOrganization<P extends { primary: { organization?: Organization | null } }>(rows: readonly P[]): { name: string; label: string | null; rows: P[] }[] | null {
  const order = organizationCounts(rows.map((r) => r.primary));
  if (order.length < 2) return null;
  return order.map((o) => ({ name: o.name, label: o.label, rows: rows.filter((r) => (r.primary.organization?.name ?? '') === o.name) }));
}
// #endregion organizations
