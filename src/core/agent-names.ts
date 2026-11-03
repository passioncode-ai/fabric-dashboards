// #region agent-names — docs: docs/adr/0026-agent-names-in-their-repositories.md#decision
// FD-135 (SCN-090): the name a person gave an agent lives in the agent's own GitHub repository, so every
// Mac that shows the agent shows the same name. One file on the default branch, `.fabric/names.json`
// (`fabric-names/1`), maps a service key (id.instance) to its name. The app reads it for every
// repository at once (one GraphQL call) and writes it through the contents API: a commit on the
// default branch, never a working tree touched. `gh` holds the sign-in; this app never sees a token.
import type { Runner } from '@passioncode-ai/fabric-service-host';
import fs from 'node:fs';
import path from 'node:path';
import { repoId } from './repofind';

export const NAMES_PATH = '.fabric/names.json';
export const NAMES_SCHEMA = 'fabric-names/1';
/** As long as a descriptor's own `name` may be (service.md: at most 80 characters). */
export const NAME_MAX = 80;
const KEY = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

/** The app's cadence (AGENTS.md ## Lifecycle): the first read after start, the tick that looks for what is due (a stat of
 *  the cache, no spawn), and how old a repository's names may get before they are read again. */
export const NAMES_FIRST_MS = 20_000;
export const NAMES_TICK_MS = 5_000;
export const NAMES_EVERY_MS = 30 * 60_000;

export interface GithubRepo { owner: string; repo: string }
/** `owner/repo` as GitHub writes it; the cache and the lookups use it lower case. */
export const slugOf = (r: GithubRepo) => `${r.owner}/${r.repo}`.toLowerCase();

/** The GitHub repository a descriptor names in `source.repository`; null for any other host or none. */
export function githubRepoOf(repository: string | undefined | null): GithubRepo | null {
  const id = repoId(repository);
  if (!id) return null;
  const [host, owner, repo, ...rest] = id.split('/');
  if (host !== 'github.com' || rest.length || !owner || !repo || !OWNER.test(owner) || !REPO.test(repo)) return null;
  return { owner, repo };
}

/** A name a person typed: spaces folded, no control characters; null when nothing is left or it is too long. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim();
  return s && [...s].length <= NAME_MAX ? s : null;
}

/** The names a file holds. Anything it does not understand is left out, never guessed; another schema is no names. */
export function parseNamesFile(text: string): Record<string, string> {
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { return {}; }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return {};
  const o = doc as Record<string, unknown>;
  if (o.schema !== NAMES_SCHEMA || !o.names || typeof o.names !== 'object' || Array.isArray(o.names)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(o.names as Record<string, unknown>).slice(0, 1000)) {
    const name = cleanName(value);
    if (KEY.test(key) && name) out[key] = name;
  }
  return out;
}

/** The file as it is written: keys sorted, two spaces, a final newline, so a diff shows one line per change. */
export function namesFileText(names: Record<string, string>): string {
  const sorted = Object.fromEntries(Object.keys(names).sort().map((k) => [k, names[k]!]));
  return `${JSON.stringify({ schema: NAMES_SCHEMA, names: sorted }, null, 2)}\n`;
}

// --- reading ---------------------------------------------------------------------------

/** Per repository: its names (an empty map when it has no file), or why it could not be read. */
export type NamesRead = Map<string, { names: Record<string, string> } | { error: string }>;

const CHUNK = 40;

/** The names of every repository, one GraphQL call per CHUNK of them. A repository GitHub does not show this
 *  sign-in (gone, private to another account) reads as an error for it alone; a failed call fails its chunk. */
export async function fetchNames(run: Runner, gh: string, repos: GithubRepo[], timeoutMs = 20_000): Promise<NamesRead> {
  const out: NamesRead = new Map();
  const unique = [...new Map(repos.map((r) => [slugOf(r), r])).values()];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const part = unique.slice(i, i + CHUNK);
    const vars = part.flatMap((_, j) => [`$o${j}:String!`, `$n${j}:String!`]).join(',');
    const body = part.map((_, j) => `r${j}:repository(owner:$o${j},name:$n${j}){object(expression:"HEAD:${NAMES_PATH}"){... on Blob{text}}}`).join(' ');
    const args = ['api', 'graphql', '-f', `query=query(${vars}){${body}}`];
    part.forEach((r, j) => args.push('-f', `o${j}=${r.owner}`, '-f', `n${j}=${r.repo}`));
    const res = await run(gh, args, timeoutMs);
    type Answer = Record<string, { object: { text?: string } | null } | null>;
    let data: Answer | null = null;
    try { data = (JSON.parse(res.stdout) as { data?: Answer | null }).data ?? null; } catch { data = null; }
    part.forEach((r, j) => {
      const slug = slugOf(r);
      if (!data) { out.set(slug, { error: ghFailure(res) }); return; }
      const repo: Answer[string] | undefined = data[`r${j}`];
      if (!repo) out.set(slug, { error: `GitHub does not show ${r.owner}/${r.repo} to this sign-in` });
      else out.set(slug, { names: typeof repo.object?.text === 'string' ? parseNamesFile(repo.object.text) : {} });
    });
  }
  return out;
}

/** The sentence of a failed `gh` call: GitHub's own message when it sent one, else gh's last line. */
export function ghFailure(r: { code: number | null; stdout: string; stderr: string }): string {
  try {
    const m = (JSON.parse(r.stdout) as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim().slice(0, 300);
  } catch { /* not JSON */ }
  const last = `${r.stderr}\n${r.stdout}`.trim().split('\n').pop()?.replace(/^gh:\s*/, '').trim();
  return last ? last.slice(0, 300) : `gh exit ${r.code}`;
}

// --- writing ---------------------------------------------------------------------------

export type RenameResult = { ok: true; names: Record<string, string>; commit: string | null } | { ok: false; error: string };

/** Gives `key` the name `name` in the repository (null: removes it, so the agent's own name shows again). The
 *  file's sha is read first and sent back, so a change made meanwhile on another Mac is never overwritten: GitHub
 *  refuses, and the change is made once more on the new file. No change, no commit. */
export async function putName(run: Runner, gh: string, r: GithubRepo, key: string, name: string | null, timeoutMs = 20_000): Promise<RenameResult> {
  if (!KEY.test(key)) return { ok: false, error: `not a service key: ${key}` };
  const clean = name === null ? null : cleanName(name);
  if (name !== null && !clean) return { ok: false, error: `a name is 1 to ${NAME_MAX} characters` };
  const url = `repos/${r.owner}/${r.repo}/contents/${NAMES_PATH}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const got = await run(gh, ['api', url], timeoutMs);
    let sha: string | null = null;
    let names: Record<string, string> = {};
    if (got.code === 0) {
      try {
        const file = JSON.parse(got.stdout) as { sha?: unknown; content?: unknown };
        if (typeof file.sha !== 'string' || typeof file.content !== 'string') return { ok: false, error: `${NAMES_PATH} in ${r.owner}/${r.repo} is not a file` };
        sha = file.sha;
        names = parseNamesFile(Buffer.from(file.content, 'base64').toString('utf8'));
      } catch {
        return { ok: false, error: `GitHub's answer about ${NAMES_PATH} could not be read` };
      }
    } else if (!/\b404\b|Not Found/.test(`${got.stdout}${got.stderr}`)) {
      return { ok: false, error: ghFailure(got) };
    }
    const next = { ...names };
    if (clean) next[key] = clean; else delete next[key];
    if (names[key] === next[key]) return { ok: true, names, commit: null };
    const message = clean ? `chore(fabric): show ${key} as "${clean}" in Fabric Dashboards [skip ci]` : `chore(fabric): show ${key} under its own name again [skip ci]`;
    const wrote = !Object.keys(next).length && sha
      ? await run(gh, ['api', '-X', 'DELETE', url, '-f', `message=${message}`, '-f', `sha=${sha}`], timeoutMs)
      : await run(gh, ['api', '-X', 'PUT', url, '-f', `message=${message}`, '-f', `content=${Buffer.from(namesFileText(next)).toString('base64')}`, ...(sha ? ['-f', `sha=${sha}`] : [])], timeoutMs);
    if (wrote.code === 0) {
      let commit: string | null = null;
      try { commit = (JSON.parse(wrote.stdout) as { commit?: { sha?: string } }).commit?.sha ?? null; } catch { /* no body */ }
      return { ok: true, names: next, commit };
    }
    // 409: the file changed since it was read (another Mac); read it again once. Anything else is the answer.
    if (attempt === 0 && /\b409\b|but expected|does not match/.test(`${wrote.stdout}${wrote.stderr}`)) continue;
    return { ok: false, error: ghFailure(wrote) };
  }
  return { ok: false, error: `${NAMES_PATH} in ${r.owner}/${r.repo} kept changing; try again` };
}

// --- the cache on this Mac ---------------------------------------------------------------

/** What was last read from each repository, kept in the app's data folder so a start, a Mac offline or the MCP
 *  server (which reads it, ADR-0026) shows the names at once. GitHub stays the truth: the cache is replaced by
 *  each read. */
export interface NamesCache { repos: Record<string, { names: Record<string, string>; readAt: string }> }

export function readNamesCache(file: string): NamesCache {
  try {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as { repos?: unknown };
    const repos: NamesCache['repos'] = {};
    if (doc.repos && typeof doc.repos === 'object') {
      for (const [slug, v] of Object.entries(doc.repos as Record<string, { names?: unknown; readAt?: unknown }>)) {
        if (!v || typeof v !== 'object' || typeof v.readAt !== 'string') continue;
        repos[slug] = { names: parseNamesFile(JSON.stringify({ schema: NAMES_SCHEMA, names: v.names })), readAt: v.readAt };
      }
    }
    return { repos };
  } catch {
    return { repos: {} };
  }
}

/** Written whole through a temporary file, so a reader never sees half of it. */
export function writeNamesCache(file: string, cache: NamesCache): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(cache, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** The name the repository `repository` gives `key`, or null. Only the repository the descriptor itself names
 *  counts: another repository cannot rename an agent that is not its own. */
export function customNameOf(cache: NamesCache, key: string, repository: string | undefined | null): string | null {
  const r = githubRepoOf(repository);
  return r ? cache.repos[slugOf(r)]?.names[key] ?? null : null;
}
/** `gh` on the given search path, or null. */
export function findGh(dirs: string[], platform: NodeJS.Platform = process.platform): string | null {
  for (const dir of dirs) {
    const file = path.join(dir, platform === 'win32' ? 'gh.exe' : 'gh');
    try { fs.accessSync(file, fs.constants.X_OK); if (fs.statSync(file).isFile()) return file; } catch { /* not here */ }
  }
  return null;
}

// --- the store the app keeps ---------------------------------------------------------------

export interface AgentNameStoreOptions {
  /** The cache file (the app's data folder, `agent-names.json`). */
  file: string;
  run: Runner;
  /** Where `gh` is, looked for on the login shell's PATH; null when it is not installed. */
  gh: () => Promise<string | null>;
  now?: () => number;
  log?: (line: string) => void;
  /** Some agent's shown name changed (a read, a rename, or the cache written by the MCP server). */
  onChange?: () => void;
}

/** Why a rename cannot be saved, before anything is asked of GitHub. */
export type RenameRefusal = 'no-repository' | 'not-github' | 'no-gh';

/** FD-135: the names, as last read from GitHub; a read of every agent's repository at once, and a rename that
 *  commits to one. One read at a time; a rename always goes through (its own sha check guards the file). */
export class AgentNameStore {
  private cache: NamesCache;
  private stamp = '';
  private reading: Promise<void> | null = null;
  /** When a repository was last asked about and could not be read: it is not asked again before its turn. */
  private readonly triedAt = new Map<string, number>();
  private readonly now: () => number;

  constructor(private readonly o: AgentNameStoreOptions) {
    this.now = o.now ?? Date.now;
    this.cache = readNamesCache(o.file);
    this.stamp = this.fileStamp();
  }

  /** The name the agent's repository gives `key`, or null (the agent's own name shows). */
  name(key: string, repository: string | undefined | null): string | null {
    return customNameOf(this.cache, key, repository);
  }

  /** The repositories that were never read, or not for `maxAgeMs`: the ones a refresh would ask about. */
  stale(repos: GithubRepo[], maxAgeMs: number): GithubRepo[] {
    const now = this.now();
    return repos.filter((r) => {
      const read = Date.parse(this.cache.repos[slugOf(r)]?.readAt ?? '');
      const at = Math.max(Number.isFinite(read) ? read : -Infinity, this.triedAt.get(slugOf(r)) ?? -Infinity);
      return now - at >= maxAgeMs;
    });
  }

  /** Reads the names of `repos` from GitHub. A repository that could not be read keeps what was read before. */
  refresh(repos: GithubRepo[]): Promise<void> {
    if (this.reading) return this.reading;
    this.reading = (async () => {
      if (!repos.length) return;
      for (const r of repos) this.triedAt.set(slugOf(r), this.now());
      const gh = await this.o.gh();
      if (!gh) { this.o.log?.('agent_names gh not found; names are not read'); return; }
      const read = await fetchNames(this.o.run, gh, repos);
      this.reloadIfChanged(); // the MCP server may have written meanwhile
      const at = new Date(this.now()).toISOString();
      let changed = false;
      const failed: string[] = [];
      for (const [slug, r] of read) {
        if ('error' in r) { failed.push(`${slug}: ${r.error}`); continue; }
        if (JSON.stringify(this.cache.repos[slug]?.names ?? {}) !== JSON.stringify(r.names)) changed = true;
        this.cache.repos[slug] = { names: r.names, readAt: at };
      }
      this.save();
      this.o.log?.(`agent_names read=${read.size - failed.length} failed=${failed.length}${failed.length ? ` (${failed.slice(0, 3).join('; ')})` : ''}`);
      if (changed) this.o.onChange?.();
    })().finally(() => { this.reading = null; });
    return this.reading;
  }

  /** Commits the name to the agent's repository (null: its own name again), then shows it at once. */
  async rename(key: string, repository: string | undefined | null, name: string | null): Promise<RenameResult | { ok: false; refused: RenameRefusal; error: string }> {
    if (!repository) return { ok: false, refused: 'no-repository', error: 'the agent names no repository (source.repository)' };
    const r = githubRepoOf(repository);
    if (!r) return { ok: false, refused: 'not-github', error: `${repository} is not a GitHub repository` };
    const gh = await this.o.gh();
    if (!gh) return { ok: false, refused: 'no-gh', error: 'the GitHub CLI (gh) is not installed' };
    const res = await putName(this.o.run, gh, r, key, name);
    this.o.log?.(`agent_rename ${key} ${res.ok ? `ok commit=${res.commit ?? 'none'}` : `failed: ${res.error}`}`);
    if (!res.ok) return res;
    this.reloadIfChanged();
    this.cache.repos[slugOf(r)] = { names: res.names, readAt: new Date(this.now()).toISOString() };
    this.save();
    this.o.onChange?.();
    return res;
  }

  /** Reads the cache again when another process (the MCP server's `rename`) wrote it; true when it did. */
  reloadIfChanged(): boolean {
    const stamp = this.fileStamp();
    if (stamp === this.stamp) return false;
    const before = JSON.stringify(this.cache.repos);
    this.cache = readNamesCache(this.o.file);
    this.stamp = stamp;
    const changed = JSON.stringify(this.cache.repos) !== before;
    if (changed) this.o.onChange?.();
    return changed;
  }

  private save(): void {
    try {
      writeNamesCache(this.o.file, this.cache);
      this.stamp = this.fileStamp();
    } catch (error) {
      this.o.log?.(`agent_names cache not written: ${(error as Error).message}`);
    }
  }

  private fileStamp(): string {
    try { const st = fs.statSync(this.o.file); return `${st.mtimeMs}:${st.size}`; } catch { return ''; }
  }
}
// #endregion agent-names
