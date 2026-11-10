// FD-162: the app's copy of Project Observatory's organization map, kept in `organizations.json` beside the settings,
// so the MCP server reads what the app last read and a restart shows the organizations before Observatory answers again.
// #region organization-store — docs: docs/ux/scenarios.md#scn-094-show-only-one-organizations-agents
import fs from 'node:fs';
import path from 'node:path';
import { addRegistryProjects, addSurveyPage, EMPTY_ORGANIZATIONS, organizationOf, organizationOfInstance, ORGANIZATIONS_EVERY_MS, type InstanceContext, type Organization, type OrganizationsCache } from './organizations';

const MAX_PAGES = 20;

/** The map as last written; the empty map when there is none or it cannot be read. */
export function readOrganizations(file: string): OrganizationsCache {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<OrganizationsCache>;
    const byRepository = raw.byRepository && typeof raw.byRepository === 'object' ? raw.byRepository : {};
    const organizations = raw.organizations && typeof raw.organizations === 'object' ? raw.organizations : {};
    const record = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, string> : undefined);
    return {
      readAt: typeof raw.readAt === 'string' ? raw.readAt : null, byRepository, organizations, personal: typeof raw.personal === 'string' && raw.personal ? raw.personal : null,
      // FD-197: the instance context, as the app last read it.
      ...(Array.isArray(raw.platform) ? { platform: raw.platform.filter((x): x is string => typeof x === 'string') } : {}),
      ...(record(raw.byWorker) ? { byWorker: record(raw.byWorker) } : {}),
      ...(record(raw.byZone) ? { byZone: record(raw.byZone) } : {}),
    };
  } catch {
    return { ...EMPTY_ORGANIZATIONS };
  }
}

export interface OrganizationStoreOptions {
  file: string;
  /** Project Observatory's registry file, parsed; null when it is not on this Mac. Read first: it needs no token. */
  readRegistry?: () => unknown | null;
  /** One page of Observatory's survey, `detail: full`, after `cursor`; null when Observatory is not here. Read when
   *  the registry file is not on this Mac or not in the expected shape. */
  fetchPage: (cursor: string | null) => Promise<unknown | null>;
  log: (line: string) => void;
  onChange: () => void;
  now?: () => number;
}

/** The app's copy of the map: read again every 30 minutes; a failed read keeps the last full map. */
export class OrganizationStore {
  private cache: OrganizationsCache;
  private reading: Promise<void> | null = null;
  private told = '';

  constructor(private readonly o: OrganizationStoreOptions) {
    this.cache = readOrganizations(o.file);
  }

  get(): OrganizationsCache {
    return this.cache;
  }

  /** The organization of a repository, or (FD-197) of one installed instance, by the context it runs in, then its
   *  repository. */
  of(what: InstanceContext | string | null | undefined): Organization | null {
    return what && typeof what === 'object' ? organizationOfInstance(this.cache, what) : organizationOf(this.cache, what);
  }

  /** Whether the map is older than `everyMs` (or was never read). */
  due(everyMs = ORGANIZATIONS_EVERY_MS): boolean {
    const at = this.cache.readAt ? Date.parse(this.cache.readAt) : NaN;
    return !Number.isFinite(at) || (this.o.now ?? Date.now)() - at >= everyMs;
  }

  refresh(): Promise<void> {
    this.reading ??= this.read().finally(() => { this.reading = null; });
    return this.reading;
  }

  private async read(): Promise<void> {
    const next: OrganizationsCache = { readAt: null, byRepository: {}, organizations: {} };
    let file: unknown = null;
    try { file = this.o.readRegistry?.() ?? null; } catch (error) { this.tell(`organizations: the registry file could not be read (${(error as Error).message.slice(0, 200)})`); }
    if (file !== null && addRegistryProjects(next, file)) return this.keep(next);
    try {
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const answer = await this.o.fetchPage(cursor);
        if (answer === null) { this.tell('organizations: Project Observatory is not here; the last map is kept'); return; }
        cursor = addSurveyPage(next, answer);
        if (!cursor) break;
      }
    } catch (error) {
      this.tell(`organizations: the registry could not be read (${(error as Error).message.slice(0, 200)}); the last map is kept`);
      return;
    }
    return this.keep(next);
  }

  private keep(next: OrganizationsCache): void {
    next.readAt = new Date((this.o.now ?? Date.now)()).toISOString();
    const changed = JSON.stringify({ ...next, readAt: null }) !== JSON.stringify({ ...this.cache, readAt: null });
    this.cache = next;
    this.told = '';
    try {
      fs.mkdirSync(path.dirname(this.o.file), { recursive: true });
      const tmp = `${this.o.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(next), { mode: 0o600 });
      fs.renameSync(tmp, this.o.file);
    } catch (error) {
      this.tell(`organizations: the map could not be saved (${(error as Error).message.slice(0, 200)})`);
    }
    if (changed) this.o.onChange();
  }

  /** A reason is logged once until it changes or a read succeeds. */
  private tell(line: string): void {
    if (line === this.told) return;
    this.told = line;
    this.o.log(line);
  }
}

// #endregion organization-store
