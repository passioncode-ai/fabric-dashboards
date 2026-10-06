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

/** Only a directory whose origin is the contract repository is ever probed (ADR-0018 §2). */
export function contractCloneState(o: { clonePath: string; remoteUrl: string | null }): ContractCloneState {
  if (!o.clonePath) return 'unconfigured';
  if (o.remoteUrl === null) return 'not-a-clone';
  return o.remoteUrl.includes('fabric-agent-contract') ? 'ready' : 'not-a-clone';
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

export function pinState(pinned: string | null, remoteTip: string | null): SiblingPinState {
  if (!pinned || !remoteTip) return 'unknown';
  return pinned.toLowerCase() === remoteTip.toLowerCase() ? 'current' : 'behind';
}

/** The latest version from `npm view sshlg-skills version`: the first line that looks like a version. */
export function parseRegistryVersion(text: string): string | null {
  for (const line of text.split('\n')) {
    const v = line.trim();
    if (/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(v)) return v;
  }
  return null;
}

/** The publisher trust check: the maintainers listing must name the expected owner. The registry
 *  prints one `name <email>` per line; a JSON array (another npm view shape) is read too. */
export function maintainersTrusted(text: string, owner: string = SKILLS_EXPECTED_OWNER): boolean {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    try {
      const list = JSON.parse(trimmed) as unknown;
      return Array.isArray(list) && list.some((m) => typeof m === 'string' && (m.trim() === owner || m.trim().startsWith(`${owner} <`)));
    } catch {
      return false;
    }
  }
  return trimmed.split('\n').some((line) => {
    const m = /^([^\s<]+)(?:\s*<[^>]*>)?\s*$/.exec(line.trim());
    return m?.[1] === owner;
  });
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
    state: 'unconfigured' | 'not-a-clone' | 'unknown' | 'current' | 'behind';
    remoteTip: string | null;
    localTip: string | null;
    /** Whether the behind-clone fetch ran and how it ended (null: nothing to fetch). */
    fetched: 'yes' | 'failed' | null;
  };
  pins: SiblingPin[];
  skills: {
    state: 'unknown' | 'current' | 'update-available' | 'updating';
    installed: string | null;
    latest: string | null;
  };
}

export function initialEstateStatus(): EstateStatus {
  return {
    checkedAt: null,
    contract: { state: 'unconfigured', remoteTip: null, localTip: null, fetched: null },
    pins: [],
    skills: { state: 'unknown', installed: null, latest: null },
  };
}
// #endregion estate-update
