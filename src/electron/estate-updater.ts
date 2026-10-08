// The estate updater (FD-30, ADR-0018): watches the Fabric Agent Contract clone named in Settings
// and the operator's skill family, from inside the main process — short-lived git/npm tool
// processes, the same lifecycle class as the Updater's codesign/plutil spawns (no port, no
// launchd job). Cadence is LC-16's: the first check 90 s after start, then every 6 h, one retry
// within the hour after a failure; nothing runs while the switch is off, and nothing starts after
// stop(). Every run is logged in the organization's event style with the codes estate_check /
// estate_update.
// #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commandEnv, runOwned, type OwnedResult } from '../core/children';
import { atomicWrite } from '../core/fsutil';
import * as estate from '../core/estate-update';
import { readLoginPath, searchDirs } from '../core/runtimes';
import { CHECK_EVERY_MS, FIRST_CHECK_MS } from '../core/version';
import type { Settings } from '../core/types';

/** Probes are short; the skills apply reconciles the family and gets the long bound. */
const PROBE_TIMEOUT_MS = 30_000;
const APPLY_TIMEOUT_MS = 10 * 60_000;
/** LC-16: one retry within the hour after a failure, then back to the 6-hour rhythm. */
const RETRY_AFTER_FAILURE_MS = 45 * 60_000;
/** After the person changes the estate settings: soon enough to see the answer, late enough to batch a burst of edits. */
const CHECK_SOON_MS = 5_000;
const SKILLS_RECORD_FILE = 'estate-skills.json';

export type EstateState = estate.EstateStatus;
export type Run = (command: string, args: string[], timeoutMs: number) => Promise<OwnedResult>;

/**
 * The environment every estate child runs with (review finding 1, FD-33). An app opened from Finder
 * has launchd's PATH (`/usr/bin:/bin:/usr/sbin:/sbin`), where `npm`, `npx`, `node` and `claude` are
 * not — so `npm view` failed with `spawn npm ENOENT` on every check in the field. The console solved
 * this with the login shell's PATH (review R-1); the estate runs use the same folders. Git never asks a
 * question nobody can answer: no terminal prompt, no password dialog.
 */
export function estateEnv(dirs: readonly string[], base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...commandEnv(base), PATH: dirs.join(':'), GIT_TERMINAL_PROMPT: '0' };
}

/** `~/…` as the person typed it, resolved against their home. Anything else is returned unchanged. */
export function expandHome(dir: string, home = os.homedir()): string {
  return dir === '~' ? home : dir.startsWith('~/') ? path.join(home, dir.slice(2)) : dir;
}

export interface SiblingPinFile {
  key: string;
  file: string;
  parse: (text: string) => string | null;
}

/**
 * The consumer pins beside the clone, read and reported, never rewritten (ADR-0018 §2). Every
 * checkout in the clone's parent folder that carries the canonical `fabric-contract.lock.json` is
 * one (review finding 15: three names were hard-coded and ten locks went unwatched), plus the two
 * vendored-fixture pins that predate the lock file. Lives beside the runner because resolving paths
 * needs node:path, which the renderer-side typecheck of src/core must not pull in.
 */
export function siblingPinFiles(cloneDir: string, list: (dir: string) => string[] = listDirs): SiblingPinFile[] {
  const parent = path.dirname(path.resolve(cloneDir));
  const self = path.basename(path.resolve(cloneDir));
  const locks = list(parent)
    .filter((name) => name !== self && !name.startsWith('.'))
    .sort()
    .map((name) => ({ key: name, file: path.join(parent, name, 'fabric-contract.lock.json'), parse: estate.pinFromLockJson }));
  const fixtures: SiblingPinFile[] = [
    { key: 'fabric', file: path.join(parent, 'fabric', 'apps', 'desktop', 'test', 'fixtures', 'fabric-agent-contract', 'SOURCE.json'), parse: estate.pinFromSourceJson },
    { key: 'fabric-dashboards', file: path.join(parent, 'fabric-dashboards', 'test', 'fixtures', 'contract', 'SOURCE.txt'), parse: estate.pinFromSourceTxt },
  ];
  return [...locks, ...fixtures];
}

function listDirs(dir: string): string[] {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
}

/** Every sibling pin read. A lock that does not exist is not a consumer and is left out; a fixture pin
 *  that cannot be read stays as `unknown`, never a failure of the check. */
export function readSiblingPins(read: (file: string) => string | null, cloneDir: string, remoteTip: string | null, list?: (dir: string) => string[]): estate.SiblingPin[] {
  const seen = new Set<string>();
  return siblingPinFiles(cloneDir, list).flatMap(({ key, file, parse }) => {
    // A checkout with a lock file is pinned by it; its vendored-fixture copy is not a second pin.
    if (seen.has(key)) return [];
    const text = read(file);
    if (text === null && file.endsWith('fabric-contract.lock.json')) return [];
    seen.add(key);
    const pinned = text === null ? null : parse(text);
    return [{ key, pinned, state: estate.pinState(pinned, remoteTip) }];
  });
}

export interface EstateUpdaterOptions {
  /** The person's settings; read fresh at every check so a toggle applies at once. */
  settings: () => Settings;
  /** main.log (LC-12), timestamped by the caller. */
  log: (message: string) => void;
  /** A status push, so the Settings page sees the new state. */
  onChange: () => void;
  /** userData: where the installed-skills record lives. */
  dataDir: string;
  /** Child processes through the owned-children runner (LC-02); argv arrays, never a shell. */
  run?: Run;
  /** The folders a child's PATH is made of (the login shell's, as the console uses). Read once. */
  searchPath?: () => Promise<string[]>;
  /** Injectable readers for the pure decision logic (tests). */
  readFile?: (file: string) => string | null;
  isDir?: (dir: string) => boolean;
  listDirs?: (dir: string) => string[];
  /**
   * FD-34: whether the sshlg-skills family is installed on this Mac (its launcher keeps
   * `~/.sshlg-skills`). Without it, and without a record this app wrote, the registry is never
   * asked: a public install that does not use the family makes no request about it.
   */
  familyInstalled?: () => boolean;
}

export class EstateUpdater {
  state: EstateState = estate.initialEstateStatus();
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;
  private retry: NodeJS.Timeout | null = null;
  private soon: NodeJS.Timeout | null = null;
  private retried = false;
  private checking = false;
  /** Set by stop(): no check, retry or child process starts after it (review finding 11). */
  private stopped = false;
  private dirs: Promise<string[]> | null = null;
  private readonly run: Run;
  private readonly readFile: (file: string) => string | null;
  private readonly isDir: (dir: string) => boolean;
  private readonly familyInstalled: () => boolean;

  constructor(private readonly o: EstateUpdaterOptions) {
    const searchPath = o.searchPath ?? (() => readLoginPath().then((p) => searchDirs(p)));
    this.run = o.run ?? (async (command, args, timeoutMs) => {
      this.dirs ??= searchPath();
      return runOwned(command, args, { timeoutMs, env: estateEnv(await this.dirs) });
    });
    this.readFile = o.readFile ?? ((file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } });
    this.isDir = o.isDir ?? ((dir) => { try { return fs.statSync(dir).isDirectory(); } catch { return false; } });
    this.familyInstalled = o.familyInstalled ?? (() => this.isDir(path.join(os.homedir(), estate.SKILLS_HOME_DIR)));
  }

  private event(name: string, outcome: string, detail = ''): void {
    this.o.log(`${name} ${outcome}${detail ? ` ${detail}` : ''}`);
  }

  /** Called in whenReady next to updater.start(): the LC-16 cadence, only when the switch is on. */
  start(): void {
    this.stopped = false;
    if (!this.o.settings().estate.enabled) return;
    this.arm();
  }

  /** Called in will-quit: nothing is started or retried past this point. */
  stop(): void {
    this.stopped = true;
    this.disarm();
  }

  /** The person turned the switch mid-run: timers start and stop cleanly. */
  switched(on: boolean): void {
    if (this.stopped) return;
    if (on && !this.timer && !this.first) this.arm();
    if (!on) this.disarm();
  }

  /** The person changed what is watched (the clone, the skills switch): check again shortly, so the
   *  status line is not wrong for up to six hours (review finding 7). */
  checkSoon(): void {
    if (this.stopped || !this.o.settings().estate.enabled || this.soon) return;
    this.soon = setTimeout(() => { this.soon = null; this.tick(); }, CHECK_SOON_MS);
    this.soon.unref();
  }

  private arm(): void {
    this.first = setTimeout(() => { this.first = null; this.tick(); }, FIRST_CHECK_MS);
    this.first.unref();
    this.timer = setInterval(() => this.tick(), CHECK_EVERY_MS);
    this.timer.unref();
  }

  private disarm(): void {
    for (const t of [this.first, this.retry, this.soon]) if (t) clearTimeout(t);
    if (this.timer) clearInterval(this.timer);
    this.first = this.timer = this.retry = this.soon = null;
  }

  private tick(): void {
    if (this.checking || this.stopped) return; // one check at a time; the interval simply skips an overrun
    void this.check();
  }

  /** A child process, unless the updater stopped meanwhile: then nothing starts (review finding 11). */
  private async child(command: string, args: string[], timeoutMs: number): Promise<OwnedResult> {
    if (this.stopped) return { code: null, output: 'the app is quitting', timedOut: false, started: false, signal: null };
    return this.run(command, args, timeoutMs);
  }

  private async check(): Promise<void> {
    if (this.stopped || !this.o.settings().estate.enabled) return; // nothing runs while the switch is off
    this.checking = true;
    const failures: string[] = [];
    try {
      const s = this.o.settings().estate;
      const contract = await this.checkContract(expandHome(s.contractClone), failures);
      const skills = await this.checkSkills(s.autoSkills, failures);
      this.state = {
        checkedAt: new Date().toISOString(),
        contract: contract.part,
        pins: contract.pins,
        skills,
      };
      const detail = [
        `contract=${contract.part.state}${contract.part.fetched ? ` fetched=${contract.part.fetched}` : ''}`,
        `skills=${skills.state}${skills.latest ? ` latest=${skills.latest}` : ''}`,
      ].join(' ');
      if (failures.length) this.event('estate_check', 'failed', `${this.clip(failures.join('; '))} ${detail}`);
      else {
        this.retried = false; // a clean check earns the one retry back
        this.event('estate_check', 'ok', detail);
      }
      if (failures.length) this.armRetry();
    } catch (error) {
      this.event('estate_check', 'failed', this.clip((error as Error).message));
      this.armRetry();
    } finally {
      this.checking = false;
      this.o.onChange();
    }
  }

  private armRetry(): void {
    // LC-16: one retry within the hour after a failure — the retry itself failing does not chain.
    if (this.stopped || this.retried || this.retry || !this.o.settings().estate.enabled) return; // a quit or the switch off cancels it
    this.retried = true;
    this.retry = setTimeout(() => { this.retry = null; this.tick(); }, RETRY_AFTER_FAILURE_MS);
    this.retry.unref();
  }

  private clip(detail: string): string {
    return detail.replace(/\s+/g, ' ').slice(0, 300);
  }

  /** The contract watch (ADR-0018 §2): the remote's main against what the clone has fetched; the only
   *  apply is `git fetch origin`. The clone's own main is reported, never moved. */
  private async checkContract(cloneDir: string, failures: string[]): Promise<{ part: EstateState['contract']; pins: EstateState['pins'] }> {
    const blank = { remoteTip: null, knownTip: null, localTip: null, fetched: null };
    if (!cloneDir) return { part: { state: 'unconfigured', ...blank }, pins: [] };
    if (!this.isDir(cloneDir)) {
      failures.push('the named contract clone folder does not exist');
      return { part: { state: 'missing', ...blank }, pins: [] };
    }
    const remote = await this.child('git', ['-C', cloneDir, 'remote', 'get-url', 'origin'], PROBE_TIMEOUT_MS);
    const ready = estate.contractCloneState({ clonePath: cloneDir, remoteUrl: remote.code === 0 ? remote.output.trim() : null });
    if (ready !== 'ready') {
      failures.push('the named folder is not a clone of passioncode-ai/fabric-agent-contract');
      return { part: { state: 'not-a-clone', ...blank }, pins: [] };
    }
    const revParse = async (ref: string) => {
      const out = await this.child('git', ['-C', cloneDir, 'rev-parse', '--verify', '--quiet', ref], PROBE_TIMEOUT_MS);
      return out.code === 0 ? estate.parseRevParse(out.output) : null;
    };
    const remoteOut = await this.child('git', ['-C', cloneDir, 'ls-remote', 'origin', 'refs/heads/main'], PROBE_TIMEOUT_MS);
    const remoteTip = remoteOut.code === 0 ? estate.parseLsRemote(remoteOut.output) : null;
    if (remoteOut.code !== 0) failures.push(`git ls-remote failed: ${this.clip(remoteOut.output)}`);
    let knownTip = await revParse('refs/remotes/origin/main');
    const localTip = await revParse('refs/heads/main');
    let fetched: 'yes' | 'failed' | null = null;
    if (remoteTip && (knownTip === null || estate.shouldFetchContract(estate.compareTips(knownTip, remoteTip)))) {
      // The one automatic mutation, and it is safe: fetch moves no branch, rewrites no pin.
      const result = await this.child('git', ['-C', cloneDir, 'fetch', 'origin'], PROBE_TIMEOUT_MS);
      if (result.code === 0) {
        fetched = 'yes';
        knownTip = await revParse('refs/remotes/origin/main');
        this.event('estate_update', 'done', 'target=contract step=fetch');
      } else {
        fetched = 'failed';
        failures.push(`git fetch failed: ${this.clip(result.output)}`);
        this.event('estate_update', 'failed', `target=contract step=fetch ${this.clip(result.output)}`);
      }
    }
    const state = estate.compareTips(knownTip, remoteTip);
    const pins = readSiblingPins(this.readFile, cloneDir, remoteTip, this.o.listDirs);
    return { part: { state, remoteTip, knownTip, localTip, fetched }, pins };
  }

  /** The skills watch (ADR-0018 §3): probe the registry, apply only behind the switch and the trust check. */
  private async checkSkills(autoSkills: boolean, failures: string[]): Promise<EstateState['skills']> {
    const record = estate.parseSkillsRecord(this.readFile(path.join(this.o.dataDir, SKILLS_RECORD_FILE)));
    // FD-34: nothing to watch, nothing asked — the family is not here and this app never installed it.
    if (record.installed === null && !this.familyInstalled()) return { state: 'absent', installed: null, latest: null };
    const view = await this.child('npm', ['view', estate.SKILLS_PACKAGE, 'version'], PROBE_TIMEOUT_MS);
    const latest = view.code === 0 ? estate.parseRegistryVersion(view.output) : null;
    if (latest === null) {
      failures.push(`npm view ${estate.SKILLS_PACKAGE} version failed: ${this.clip(view.output)}`);
      return { state: 'error', installed: record.installed, latest: null };
    }
    if (record.installed === latest) return { state: 'current', installed: record.installed, latest };
    if (!autoSkills) return { state: record.installed === null ? 'unknown' : 'update-available', installed: record.installed, latest };
    // The person's switch is on: the publisher check decides whether the apply may run — also for
    // the first run, whose record does not exist yet (the reconcile reconciles, it never removes).
    const spec = `${estate.SKILLS_PACKAGE}@${latest}`;
    const publisher = await this.child('npm', ['view', spec, 'version', 'maintainers', '_npmUser', '--json'], PROBE_TIMEOUT_MS);
    const trusted = publisher.code === 0 && estate.publisherTrusted(publisher.output, latest);
    if (publisher.code !== 0) failures.push(`npm view ${spec} maintainers failed: ${this.clip(publisher.output)}`);
    const decision = estate.decideSkillsApply({ autoSkills, trusted, updateAvailable: true });
    if (!decision.apply) {
      this.event('estate_update', 'refused', `target=skills reason=${decision.why}${publisher.code === 0 ? '' : ' (probe failed)'}`);
      return { state: record.installed === null ? 'unknown' : 'update-available', installed: record.installed, latest };
    }
    return this.applySkills(latest, record, failures);
  }

  /** The background reconcile of exactly the version that was checked; the record moves only on exit 0,
   *  so a failed apply is a failed check — logged as one, and retried within the hour (review finding 10). */
  private async applySkills(latest: string, record: estate.SkillsRecord, failures: string[]): Promise<EstateState['skills']> {
    this.state = { ...this.state, skills: { state: 'updating', installed: record.installed, latest } };
    this.o.onChange();
    // `@<version>`, never a bare name: npx would run any copy already on the machine, and the
    // registry may move between the check and the run (review finding 2).
    const applied = await this.child('npx', ['--yes', `${estate.SKILLS_PACKAGE}@${latest}`, 'update'], APPLY_TIMEOUT_MS);
    const failedState: EstateState['skills'] = { state: record.installed === null ? 'error' : 'update-available', installed: record.installed, latest };
    if (applied.code === 0 && !applied.timedOut) {
      try {
        atomicWrite(path.join(this.o.dataDir, SKILLS_RECORD_FILE), estate.serializeSkillsRecord({ installed: latest, updatedAt: new Date().toISOString() }));
      } catch (error) {
        failures.push(`skills record not saved: ${this.clip((error as Error).message)}`);
        this.event('estate_update', 'failed', `target=skills record not saved: ${this.clip((error as Error).message)}`);
        return failedState;
      }
      this.event('estate_update', 'done', `target=skills version=${latest}`);
      return { state: 'current', installed: latest, latest };
    }
    failures.push(`npx ${estate.SKILLS_PACKAGE}@${latest} update failed`);
    this.event('estate_update', 'failed', `target=skills code=${applied.code ?? 'signal'}${applied.timedOut ? ' timedOut=yes' : ''} ${this.clip(applied.output)}`);
    return failedState;
  }
}
// #endregion estate-update
