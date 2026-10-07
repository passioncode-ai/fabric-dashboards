// The estate updater (FD-30, ADR-0018): watches the Fabric Agent Contract clone named in Settings
// and the operator's skill family, from inside the main process — short-lived git/npm tool
// processes, the same lifecycle class as the Updater's codesign/plutil spawns (no port, no
// launchd job). Cadence is LC-16's: the first check 90 s after start, then every 6 h, one retry
// within the hour after a failure; nothing runs while the switch is off. Every run is logged in
// the organization's event style with the codes estate_check / estate_update.
// #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
import fs from 'node:fs';
import path from 'node:path';
import { runOwned, type OwnedResult } from '../core/children';
import { atomicWrite } from '../core/fsutil';
import * as estate from '../core/estate-update';
import { CHECK_EVERY_MS, FIRST_CHECK_MS } from '../core/version';
import type { Settings } from '../core/types';

/** Probes are short; the skills apply reconciles the family and gets the long bound. */
const PROBE_TIMEOUT_MS = 30_000;
const APPLY_TIMEOUT_MS = 10 * 60_000;
/** LC-16: one retry within the hour after a failure, then back to the 6-hour rhythm. */
const RETRY_AFTER_FAILURE_MS = 45 * 60_000;
const SKILLS_RECORD_FILE = 'estate-skills.json';

export type EstateState = estate.EstateStatus;
export type Run = (command: string, args: string[], timeoutMs: number) => Promise<OwnedResult>;

export interface SiblingPinFile {
  key: string;
  file: string;
  parse: (text: string) => string | null;
}

/** The consumer checkouts beside the clone whose pins are read and reported, never rewritten
 *  (ADR-0018 §2). Lives beside the runner because resolving paths needs node:path, which the
 *  renderer-side typecheck of src/core must not pull in. */
export function siblingPinFiles(cloneDir: string): SiblingPinFile[] {
  const parent = path.dirname(path.resolve(cloneDir));
  return [
    { key: 'fabric-agent-adapter', file: path.join(parent, 'fabric-agent-adapter', 'fabric-contract.lock.json'), parse: estate.pinFromLockJson },
    { key: 'fabric', file: path.join(parent, 'fabric', 'apps', 'desktop', 'test', 'fixtures', 'fabric-agent-contract', 'SOURCE.json'), parse: estate.pinFromSourceJson },
    { key: 'fabric-dashboards', file: path.join(parent, 'fabric-dashboards', 'test', 'fixtures', 'contract', 'SOURCE.txt'), parse: estate.pinFromSourceTxt },
  ];
}

/** Every sibling pin read; a missing or unreadable file is `unknown`, never a failure of the check. */
export function readSiblingPins(read: (file: string) => string | null, cloneDir: string, remoteTip: string | null): estate.SiblingPin[] {
  return siblingPinFiles(cloneDir).map(({ key, file, parse }) => {
    const text = read(file);
    const pinned = text === null ? null : parse(text);
    return { key, pinned, state: estate.pinState(pinned, remoteTip) };
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
  /** Injectable readers for the pure decision logic (tests). */
  readFile?: (file: string) => string | null;
  isDir?: (dir: string) => boolean;
}

export class EstateUpdater {
  state: EstateState = estate.initialEstateStatus();
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;
  private retry: NodeJS.Timeout | null = null;
  private retried = false;
  private checking = false;
  private readonly run: Run;
  private readonly readFile: (file: string) => string | null;
  private readonly isDir: (dir: string) => boolean;

  constructor(private readonly o: EstateUpdaterOptions) {
    this.run = o.run ?? ((command, args, timeoutMs) => runOwned(command, args, { timeoutMs }));
    this.readFile = o.readFile ?? ((file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } });
    this.isDir = o.isDir ?? ((dir) => { try { return fs.statSync(dir).isDirectory(); } catch { return false; } });
  }

  private event(name: string, outcome: string, detail = ''): void {
    this.o.log(`${name} ${outcome}${detail ? ` ${detail}` : ''}`);
  }

  /** Called in whenReady next to updater.start(): the LC-16 cadence, only when the switch is on. */
  start(): void {
    if (!this.o.settings().estate.enabled) return;
    this.arm();
  }

  /** Called in will-quit: nothing is started or retried past this point. */
  stop(): void {
    this.disarm();
  }

  /** The person turned the switch mid-run: timers start and stop cleanly. */
  switched(on: boolean): void {
    if (on && !this.timer && !this.first) this.arm();
    if (!on) this.disarm();
  }

  private arm(): void {
    this.first = setTimeout(() => { this.first = null; void this.tick(); }, FIRST_CHECK_MS);
    this.first.unref();
    this.timer = setInterval(() => void this.tick(), CHECK_EVERY_MS);
    this.timer.unref();
  }

  private disarm(): void {
    if (this.first) { clearTimeout(this.first); this.first = null; }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
  }

  private tick(): void {
    if (this.checking) return; // one check at a time; the interval simply skips an overrun
    void this.check();
  }

  private async check(): Promise<void> {
    if (!this.o.settings().estate.enabled) return; // nothing runs while the switch is off
    this.checking = true;
    const failures: string[] = [];
    try {
      const s = this.o.settings().estate;
      const contract = await this.checkContract(s.contractClone, failures);
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
    if (this.retried || this.retry || !this.o.settings().estate.enabled) return; // a quit or the switch off cancels it
    this.retried = true;
    this.retry = setTimeout(() => { this.retry = null; void this.tick(); }, RETRY_AFTER_FAILURE_MS);
    this.retry.unref();
  }

  private clip(detail: string): string {
    return detail.replace(/\s+/g, ' ').slice(0, 300);
  }

  /** The contract watch (ADR-0018 §2): probe ls-remote vs rev-parse; the only apply is fetch origin. */
  private async checkContract(cloneDir: string, failures: string[]): Promise<{ part: EstateState['contract']; pins: EstateState['pins'] }> {
    const none = { part: { state: 'unconfigured' as const, remoteTip: null, localTip: null, fetched: null }, pins: [] };
    if (!cloneDir) return none;
    if (!this.isDir(cloneDir)) {
      failures.push('the named contract clone folder does not exist');
      return { part: { state: 'not-a-clone', remoteTip: null, localTip: null, fetched: null }, pins: [] };
    }
    const remote = await this.run('git', ['-C', cloneDir, 'remote', 'get-url', 'origin'], PROBE_TIMEOUT_MS);
    const ready = estate.contractCloneState({ clonePath: cloneDir, remoteUrl: remote.code === 0 ? remote.output.trim() : null });
    if (ready !== 'ready') {
      failures.push('the named folder is not a fabric-agent-contract clone');
      return { part: { state: 'not-a-clone', remoteTip: null, localTip: null, fetched: null }, pins: [] };
    }
    const [remoteOut, localOut] = await Promise.all([
      this.run('git', ['-C', cloneDir, 'ls-remote', 'origin', 'main'], PROBE_TIMEOUT_MS),
      this.run('git', ['-C', cloneDir, 'rev-parse', 'main'], PROBE_TIMEOUT_MS),
    ]);
    const remoteTip = remoteOut.code === 0 ? estate.parseLsRemote(remoteOut.output) : null;
    const localTip = localOut.code === 0 ? estate.parseRevParse(localOut.output) : null;
    if (remoteOut.code !== 0) failures.push(`git ls-remote failed: ${this.clip(remoteOut.output)}`);
    if (localOut.code !== 0) failures.push(`git rev-parse failed: ${this.clip(localOut.output)}`);
    let state = estate.compareTips(localTip, remoteTip);
    let fetched: 'yes' | 'failed' | null = null;
    if (estate.shouldFetchContract(state)) {
      // The one automatic mutation, and it is safe: fetch moves no branch, rewrites no pin.
      const result = await this.run('git', ['-C', cloneDir, 'fetch', 'origin'], PROBE_TIMEOUT_MS);
      if (result.code === 0) { fetched = 'yes'; this.event('estate_update', 'done', 'target=contract step=fetch'); }
      else {
        fetched = 'failed';
        failures.push(`git fetch failed: ${this.clip(result.output)}`);
        this.event('estate_update', 'failed', `target=contract step=fetch ${this.clip(result.output)}`);
      }
    }
    if (remoteTip === null && localTip === null) state = 'unknown';
    const pins = readSiblingPins(this.readFile, cloneDir, remoteTip);
    return { part: { state, remoteTip, localTip, fetched }, pins };
  }

  /** The skills watch (ADR-0018 §3): probe the registry, apply only behind the switch and the trust check. */
  private async checkSkills(autoSkills: boolean, failures: string[]): Promise<EstateState['skills']> {
    const record = estate.parseSkillsRecord(this.readFile(path.join(this.o.dataDir, SKILLS_RECORD_FILE)));
    const view = await this.run('npm', ['view', estate.SKILLS_PACKAGE, 'version'], PROBE_TIMEOUT_MS);
    const latest = view.code === 0 ? estate.parseRegistryVersion(view.output) : null;
    if (latest === null) {
      failures.push(`npm view ${estate.SKILLS_PACKAGE} version failed: ${this.clip(view.output)}`);
      return { state: 'unknown', installed: record.installed, latest: null };
    }
    if (record.installed === latest) return { state: 'current', installed: record.installed, latest };
    if (!autoSkills) return { state: record.installed === null ? 'unknown' : 'update-available', installed: record.installed, latest };
    // The person's switch is on: the publisher check decides whether the apply may run — also for
    // the first run, whose record does not exist yet (the reconcile reconciles, it never removes).
    const maintainers = await this.run('npm', ['view', estate.SKILLS_PACKAGE, 'maintainers'], PROBE_TIMEOUT_MS);
    const trusted = maintainers.code === 0 && estate.maintainersTrusted(maintainers.output);
    if (maintainers.code !== 0) failures.push(`npm view ${estate.SKILLS_PACKAGE} maintainers failed: ${this.clip(maintainers.output)}`);
    const decision = estate.decideSkillsApply({ autoSkills, trusted, updateAvailable: true });
    if (!decision.apply) {
      this.event('estate_update', 'refused', `target=skills reason=${decision.why}${maintainers.code === 0 ? '' : ' (probe failed)'}`);
      return { state: record.installed === null ? 'unknown' : 'update-available', installed: record.installed, latest };
    }
    return this.applySkills(latest, record);
  }

  /** The background reconcile; the record moves only on exit 0, so a failed apply is retried next check. */
  private async applySkills(latest: string, record: estate.SkillsRecord): Promise<EstateState['skills']> {
    this.state = { ...this.state, skills: { state: 'updating', installed: record.installed, latest } };
    this.o.onChange();
    const applied = await this.run('npx', ['--yes', estate.SKILLS_PACKAGE, 'update'], APPLY_TIMEOUT_MS);
    if (applied.code === 0 && !applied.timedOut) {
      try {
        atomicWrite(path.join(this.o.dataDir, SKILLS_RECORD_FILE), estate.serializeSkillsRecord({ installed: latest, updatedAt: new Date().toISOString() }));
      } catch (error) {
        this.event('estate_update', 'failed', `target=skills record not saved: ${this.clip((error as Error).message)}`);
        return { state: 'update-available', installed: record.installed, latest };
      }
      this.event('estate_update', 'done', `target=skills version=${latest}`);
      return { state: 'current', installed: latest, latest };
    }
    this.event('estate_update', 'failed', `target=skills code=${applied.code ?? 'signal'}${applied.timedOut ? ' timedOut=yes' : ''} ${this.clip(applied.output)}`);
    return { state: 'update-available', installed: record.installed, latest };
  }
}
// #endregion estate-update
