// FD-162: the organization each agent belongs to, from Project Observatory's project registry (its estate survey with
// `detail: full`: every project's repositories and its organization, decided by the operator's rules). An agent is
// matched by its descriptor's `source.repository`; one Observatory does not know is not attributed, never guessed.
// The app keeps the map in `organizations.json` beside the settings (src/core/organization-store.ts).
// #region organizations — docs: docs/ux/scenarios.md#scn-094-show-only-one-organizations-agents

export interface Organization { name: string; label: string }

export interface OrganizationsCache {
  readAt: string | null;
  /** `owner/name` (lower case) of every repository Observatory knows -> its project's organization name. */
  byRepository: Record<string, string>;
  /** Organization name -> its label as the operator named it (`acme` -> `Acme`). */
  organizations: Record<string, string>;
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
  const d = (doc && typeof doc === 'object' ? doc : {}) as { schema_version?: unknown; projects?: unknown; organization_labels?: Record<string, unknown> };
  if (d.schema_version !== 2 || !Array.isArray(d.projects)) return false;
  const labelOf = (name: string) => (typeof d.organization_labels?.[name] === 'string' && d.organization_labels[name] ? d.organization_labels[name] as string : name);
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

/** The organization of a repository, or null when the map does not know it. */
export function organizationOf(cache: OrganizationsCache, repository: string | undefined | null): Organization | null {
  const key = repositoryKey(repository);
  const name = key ? cache.byRepository[key] : undefined;
  return name ? { name, label: cache.organizations[name] ?? name } : null;
}

/** The agents an organization filter keeps: every one when nothing is chosen; `''` stands for "Not attributed". */
export function keepsOrganization(chosen: readonly string[], organization: Organization | null | undefined): boolean {
  return chosen.length === 0 || chosen.includes(organization?.name ?? '');
}
/** The services an organization filter keeps, and the one open on the page whatever the filter (it never vanishes
 *  under the person's eyes). */
export function filterServices<S extends { key: string; organization?: Organization | null }>(services: readonly S[], chosen: readonly string[], keep?: string | null): S[] {
  return chosen.length === 0 ? [...services] : services.filter((s) => s.key === keep || keepsOrganization(chosen, s.organization));
}

/** The organizations among the services, with how many agents each has, by label; `''` (not attributed) last. Empty
 *  when no service carries an organization at all (no map was read). */
export function organizationCounts(services: readonly { organization?: Organization | null }[]): { name: string; label: string | null; count: number }[] {
  if (!services.some((s) => s.organization !== undefined)) return [];
  const by = new Map<string, { name: string; label: string | null; count: number }>();
  for (const s of services) {
    const name = s.organization?.name ?? '';
    const row = by.get(name) ?? { name, label: s.organization?.label ?? null, count: 0 };
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
