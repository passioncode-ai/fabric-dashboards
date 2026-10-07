// The estate watcher's decision logic (ADR-0018): what a pin file says, whether a clone may be
// watched, how two git tips compare, who may publish the skills, whether an apply may run.
// Pure functions only — the file system and the child processes arrive as parameters, so every
// rule here is unit-tested without touching git or the npm registry. Node-free: the renderer
// typechecks this file (AppStatus carries EstateStatus).
// #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision

/** A full or short commit hash as the pin files carry it; anything else is not a pin. */
const SHA = /^[0-9a-f]{7,64}$/i;

/** fabric-contract.lock.json pins the contract once, by full commit (contract versioning.md). */
export function pinFromLockJson(text: string): string | null {
  try {
    const j = JSON.parse(text) as { commit?: unknown };
    return typeof j.commit === 'string' && SHA.test(j.commit) ? j.commit : null;
  } catch {
    return null;
  }
}

/** fabric's vendored fixture records the copied commit as currentCommit. */
export function pinFromSourceJson(text: string): string | null {
  try {
    const j = JSON.parse(text) as { currentCommit?: unknown };
    return typeof j.currentCommit === 'string' && SHA.test(j.currentCommit) ? j.currentCommit : null;
  } catch {
    return null;
  }
}

/** SOURCE.txt records the copy as "main @<sha>". */
export function pinFromSourceTxt(text: string): string | null {
  const m = /main @([0-9a-f]{7,64})/i.exec(text);
  return m?.[1] ?? null;
}

/** The skills family on the public registry (ADR-0018 §3). */
export const SKILLS_PACKAGE = 'sshlg-skills';
/** The publisher the trust check expects, from `npm view sshlg-skills maintainers` (verified 2026-10-07). */
export const SKILLS_EXPECTED_OWNER = 'ssheleg';

/** What the contract watch may do with the clone, from the person's setting and the remote it names. */
export type ContractCloneState = 'unconfigured' | 'not-a-clone' | 'ready';

/** The contract's repository, as the contract-pin schema names it (contract-pin.schema.json `repository`). */
export const CONTRACT_REPOSITORY = 'passioncode-ai/fabric-agent-contract';

/** `owner/name` of a GitHub remote in its https, scp-like ssh or ssh:// spelling; null for anything else. */
export function githubRepository(url: string): string | null {
  const m = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null;
}

/** Only a directory whose origin IS the contract repository is ever probed (ADR-0018 §2) — a fork or
 *  any other remote whose URL merely contains the name is not (review 2026-10-07, finding 12). */
export function contractCloneState(o: { clonePath: string; remoteUrl: string | null }): ContractCloneState {
  if (!o.clonePath) return 'unconfigured';
  if (o.remoteUrl === null) return 'not-a-clone';
  return githubRepository(o.remoteUrl) === CONTRACT_REPOSITORY ? 'ready' : 'not-a-clone';
}

/** The remote tip from `git ls-remote origin main`: the sha of the refs/heads/main line. */
export function parseLsRemote(text: string): string | null {
  for (const line of text.split('\n')) {
    const m = /^([0-9a-f]{7,64})\s+refs\/heads\/main\s*$/i.exec(line.trim());
    if (m) return m[1]!;
  }
  return null;
}

/** The local tip from `git rev-parse main`: the first whitespace-separated token. */
export function parseRevParse(text: string): string | null {
  const token = text.trim().split(/\s+/)[0] ?? '';
  return SHA.test(token) ? token : null;
}

export type TipState = 'current' | 'behind' | 'unknown';

/** Two tips compared. A difference reads as behind: the only answer the watch applies is fetch,
 *  which is safe for an ahead or diverged local main too — never pull, reset or rebase. */
export function compareTips(local: string | null, remote: string | null): TipState {
  if (!local || !remote) return 'unknown';
  return local.toLowerCase() === remote.toLowerCase() ? 'current' : 'behind';
}

export type SiblingPinState = 'current' | 'behind' | 'unknown';

/** One consumer's pin as the check reports it: the commit it names and how that compares to the remote tip. */
export interface SiblingPin {
  key: string;
  pinned: string | null;
  state: SiblingPinState;
}

/** A pin names a commit in full or abbreviated to at least seven characters (contract versioning.md, G-11). */
export function samePin(pinned: string, tip: string): boolean {
  const a = pinned.toLowerCase();
  const b = tip.toLowerCase();
  return a.length >= 7 && (a === b || b.startsWith(a) || a.startsWith(b));
}

export function pinState(pinned: string | null, remoteTip: string | null): SiblingPinState {
  if (!pinned || !remoteTip) return 'unknown';
  return samePin(pinned, remoteTip) ? 'current' : 'behind';
}

/** A release version: plain x.y.z. A prerelease is never installed by itself. */
const RELEASE = /^\d+\.\d+\.\d+$/;

/** The latest version from `npm view sshlg-skills version`: the first line that is a release version. */
export function parseRegistryVersion(text: string): string | null {
  for (const line of text.split('\n')) {
    const v = line.trim();
    if (RELEASE.test(v)) return v;
  }
  return null;
}

/** A maintainer or publisher entry, in the registry's `name <email>` or `{ name }` form, reduced to its name. */
function personName(entry: unknown): string | null {
  if (typeof entry === 'string') return /^([^\s<]+)/.exec(entry.trim())?.[1] ?? null;
  if (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string') return (entry as { name: string }).name;
  return null;
}

/**
 * The publisher trust check (ADR-0018 §3, review finding 3), over the JSON of
 * `npm view sshlg-skills@<version> version maintainers _npmUser --json`: the version is the one
 * checked and a plain release, EVERY maintainer is on the allowlist, and so is the account that
 * published that version. One extra maintainer is enough to stop the automatic install — the person
 * can still update by hand.
 */
export function publisherTrusted(json: string, version: string, owners: readonly string[] = [SKILLS_EXPECTED_OWNER]): boolean {
  let data: unknown;
  try { data = JSON.parse(json); } catch { return false; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const d = data as { version?: unknown; maintainers?: unknown; _npmUser?: unknown };
  if (d.version !== version || !RELEASE.test(version)) return false;
  const maintainers = Array.isArray(d.maintainers) ? d.maintainers : d.maintainers === undefined ? [] : [d.maintainers];
  const names = maintainers.map(personName);
  const publisher = personName(d._npmUser);
  return names.length > 0 && names.every((n) => n !== null && owners.includes(n)) && publisher !== null && owners.includes(publisher);
}

/** The installed-version record this app keeps in userData (`estate-skills.json`, LC-12). */
export interface SkillsRecord {
  installed: string | null;
  updatedAt: string | null;
}

/** Absent, damaged or foreign file: the state every reader must land on, so the UI can say the
 *  updates are tracked from the first run or apply. */
export function parseSkillsRecord(text: string | null): SkillsRecord {
  if (!text) return { installed: null, updatedAt: null };
  try {
    const j = JSON.parse(text) as { installed?: unknown; updatedAt?: unknown };
    return {
      installed: typeof j.installed === 'string' ? j.installed : null,
      updatedAt: typeof j.updatedAt === 'string' ? j.updatedAt : null,
    };
  } catch {
    return { installed: null, updatedAt: null };
  }
}

export function serializeSkillsRecord(record: SkillsRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

/** Whether the skills apply may run now: the person's switch, then the trust check, then a real update. */
export type SkillsApplyDecision = { apply: true } | { apply: false; why: 'opted-out' | 'untrusted' | 'nothing-to-do' };

export function decideSkillsApply(o: { autoSkills: boolean; trusted: boolean; updateAvailable: boolean }): SkillsApplyDecision {
  if (!o.autoSkills) return { apply: false, why: 'opted-out' };
  if (!o.updateAvailable) return { apply: false, why: 'nothing-to-do' };
  if (!o.trusted) return { apply: false, why: 'untrusted' };
  return { apply: true };
}

/** The only mutation the contract watch ever applies to the clone (ADR-0018 §2). */
export function shouldFetchContract(state: TipState): boolean {
  return state === 'behind';
}

/** What the renderer shows for AppStatus.estate (ADR-0018 §4). */
export interface EstateStatus {
  checkedAt: string | null;
  contract: {
    /** `current`: the clone knows the remote's main (`refs/remotes/origin/main` equals it); `behind`: it does
     *  not, even after the fetch; `missing`: the named folder does not exist. */
    state: 'unconfigured' | 'missing' | 'not-a-clone' | 'unknown' | 'current' | 'behind';
    remoteTip: string | null;
    /** What the clone has fetched: `refs/remotes/origin/main`. */
    knownTip?: string | null;
    /** The clone's own `main`, reported, never moved: a pull is the person's choice. */
    localTip: string | null;
    /** Whether the behind-clone fetch ran and how it ended (null: nothing to fetch). */
    fetched: 'yes' | 'failed' | null;
  };
  pins: SiblingPin[];
  skills: {
    /** `error`: the registry could not be asked — never shown as the harmless "not tracked yet". */
    state: 'unknown' | 'error' | 'current' | 'update-available' | 'updating';
    installed: string | null;
    latest: string | null;
  };
}

export function initialEstateStatus(): EstateStatus {
  return {
    checkedAt: null,
    contract: { state: 'unconfigured', remoteTip: null, knownTip: null, localTip: null, fetched: null },
    pins: [],
    skills: { state: 'unknown', installed: null, latest: null },
  };
}
// #endregion estate-update
