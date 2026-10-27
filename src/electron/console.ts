// #region console-host — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
// ADR-0017: the main-process side of the agent console. It decides which runtime, which folder and
// which account (Switchboard) a service's console uses, spawns it on a PTY through ConsoleManager,
// and talks to the window only through typed IPC. No token passes through here: a session bound to
// a Switchboard project is started by Switchboard itself.
import { expand } from '@passioncode-ai/fabric-service-host';
import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execRunner, type Runner } from '@passioncode-ai/fabric-service-host';
import { CHANNELS, type ConsoleInfo, type ConsoleStartResult, type ConsoleTask } from '../core/api';
import { prepareHandoff, writeTaskOnly, type McpCommand } from '../core/handoff';
import { prepareSetup, SETUP_KEY, setupFolder, type SetupState } from '../core/setup';
import type { DoctorReport } from '../core/doctor';
import type { ActivityItem } from '../core/types';
import { ConsoleManager, planStart, terminalScript, type SpawnPty } from '../core/consoles';
import { admit, machineProbe, type MachineState } from '../core/admission';
import { findCheckout } from '../core/repofind';
import { detectRuntimes, KNOWN_RUNTIMES, readLoginPath, searchDirs, specsFromSwitchboard, type Runtime, type RuntimeSpec } from '../core/runtimes';
import type { SettingsStore } from '../core/settings';
import { accountsOf, allSessionsOf, bindingFor, canLaunchInPlace, findSwitchboard, handoverOwnKey, handoverRunArgv, handoversOf, handoversSwitch, isHandoverKey, managesProvider, sessionsIn, terminalLaunchArgv, type Binding, type SbHandover, type SbSessions } from '../core/switchboard';
import type { ServiceSnapshot } from '../core/types';
import { claimStop, continuedOf, finishStop, liveAgents, recoveryOf, resumeArgs, resumeOwnKey, sessionOpen, transcriptIn, transcriptOf, verdictOf, writtenAt, RESUME_SETTLE_MS, RESUMES_PER_PASS, type RecoveryStatus, type SbStop, type StopView } from '../core/recovery';
import { consoleRowId, handoverRowId, mergeSessions, pruneDismissed, pruneRecords, SourceReader, stopRowId, type ConsoleInput, type PendingHandover, type SbSessionRecord, type SessionActionResult, type SessionReason, type SessionRecord, type SessionNotice, type SessionRow, type SessionsStatus, type SourceDegraded } from '../core/sessions';

/** node-pty 1.1.0 ships its macOS `spawn-helper` without the executable bit, and its postinstall
 *  does not set it: without it every spawn fails with `posix_spawnp failed`. A development checkout
 *  is fixed here; the release build sets it before signing (scripts/dist-mac.mjs). */
export function ensureSpawnHelper(moduleDir: string, arch = process.arch, platform: NodeJS.Platform = process.platform): string | null {
  if (platform !== 'darwin') return null; // FD-37: only macOS's node-pty spawns through spawn-helper (Windows: conpty; Linux: built from source)
  const helper = path.join(moduleDir, 'prebuilds', `darwin-${arch}`, 'spawn-helper').replace('app.asar', 'app.asar.unpacked');
  try {
    fs.accessSync(helper, fs.constants.X_OK);
    return null;
  } catch {
    try { fs.chmodSync(helper, 0o755); return null; } catch (error) { return `the console helper is not executable: ${(error as Error).message}`; }
  }
}

function loadSpawn(): SpawnPty {
  // Loaded on first use: a window that never opens a console never loads the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pty = require('node-pty') as typeof import('node-pty');
  const problem = ensureSpawnHelper(path.dirname(require.resolve('node-pty/package.json')));
  if (problem) throw new Error(problem);
  return (file, args, opts) => pty.spawn(file, args, { name: opts.name, cols: opts.cols, rows: opts.rows, cwd: opts.cwd, env: opts.env });
}

export interface ConsoleHostOptions {
  settings: SettingsStore;
  snapshot: (key: string) => ServiceSnapshot | null;
  window: () => BrowserWindow | null;
  /** FD-92: the console drawer's page, which shows the console; it gets the same events as the window. */
  drawer?: () => Electron.WebContents | null;
  visible: () => boolean;
  log: (line: string) => void;
  /** Test-only search folders (never honoured by a packaged app — main.ts decides). */
  testDirs?: string[];
  /** Where Open in Terminal writes its one-shot `.command` files (the app's data folder). */
  scriptsDir: string;
  run?: Runner;
  spawn?: SpawnPty;
  /** FD-39 (ADR-0020): the context pack — where it is written (the app's data, never the repository),
   *  the agent's recent activity, and how this app's MCP server starts. Absent: no pack (older callers, tests). */
  packRoot?: string;
  /** This app's version, the `writer.version` of each `handoff.json` (FD-47). */
  version?: string;
  activity?: (key: string) => ActivityItem[];
  mcpServer?: () => McpCommand;
  /** FD-39 SCN-058: what is set up already, for the Setup console's brief. */
  setupState?: () => SetupState;
  /** FD-65: the last Check setup's report, so Repair with my coding agent starts from it. */
  doctor?: () => DoctorReport | null;
  /** FD-50 (LC-18): how long a session may sit without input or output before it is saved and closed
   *  (default IDLE_CLOSE_MS; 0 turns the sweep off, as tests that do not test it do). */
  idleMs?: number;
  /** Signals a session's process group; tests pass a fake — a fake pid is never a real group. */
  killGroup?: (pid: number, signal: NodeJS.Signals) => void;
  /** FD-49 (LC-17): the machine before a start; the real probe by default, a stub in tests. */
  machine?: (folder: string, running: number) => Promise<MachineState>;
  /** FD-62: the registered services' keys, to find the console a hand-over belongs in. */
  keys?: () => string[];
  /** FD-84, test-only: the home whose transcripts a continued session must be found in (default the user's), and how
   *  long a continued session must live before it counts as resumed (default RESUME_SETTLE_MS). */
  home?: string;
  settleMs?: number;
  /** FD-62: a hand-over console opened or went away — the shell's status changed. */
  changed?: () => void;
  /** FD-103 (decision 9): once per taken hand-over and per automatic continue after a limit reset. */
  notice?: (n: SessionNotice) => void;
}

/** FD-62: how often hand-overs are read, in AGENTS.md's lifecycle table. */
export const HANDOVER_POLL_MS = { visible: 15_000, hidden: 60_000 };

/** FD-62: a console that runs a hand-over, as the shell lists it. */

/** D2 of the 2026-10-12 board waves, stated in AGENTS.md's lifecycle table (LC-18). */
export const IDLE_CLOSE_MS = 30 * 60_000;

/** F3 of FIX-2: how long a quit waits for a continue in flight to settle its stop, then for the cancelling of a stop still
 *  claimed; both inside the app's own quit (main.ts exits once endAllForQuit resolves). */
export const QUIT_SETTLE_MS = 2500;
export const QUIT_FINISH_MS = 1500;

/** FD-74: how long the console trusts Switchboard's last answer about a folder before asking again in the background. */
export const BINDING_FRESH_MS = 30_000;

export class ConsoleHost {
  readonly manager: ConsoleManager;
  private dirs: Promise<string[]> | null = null;
  private catalog: Promise<Runtime[]> | null = null;
  private inPlaceFor: { key: string; value: boolean } | null = null;
  /** FD-74: what Switchboard said about each folder, for showing the console at once (BINDING_FRESH_MS). */
  private readonly bindings = new Map<string, { at: number; value: Binding | { kind: 'absent' }; pending: boolean }>();
  private readonly run: Runner;
  /** FD-62: the hand-overs this launch acted on (taken or deferred), by id — each is acted on once. */
  private readonly seenHandovers = new Set<string>();
  /** FD-62: the hand-over each console key runs, for its header and the shell's list. */
  private readonly handoverOf = new Map<string, SbHandover>();
  private handoversUnavailable: string | null = null;
  /** FD-83: the hand-over records of sessions this launch continued after a limit, by console key. */
  private readonly resumedKeys = new Set<string>();
  /** FD-83: stops this launch acted on (continued, or failed to), by event — each is acted on once. */
  private readonly actedStops = new Map<string, StopView>();
  private recovery: RecoveryStatus = { on: true, stops: [], resumed: 0 };
  /** F2 of FIX-2: stops being taken up now (an automatic continue, Continue now, or Continue on a declined stop), by
   *  event: marked before the claim, so a second press or the background pass never claims or starts the same stop. */
  private readonly taking = new Set<string>();
  /** F3 of FIX-2: the continues in flight, which a quit waits for, and the stops claimed and not finished yet, which a
   *  quit finishes as cancelled when their continue did not. */
  private readonly inFlight = new Set<Promise<unknown>>();
  private readonly claimedOpen = new Map<string, { stop: SbStop; sb: string; outcome?: 'resumed' | 'cancelled' }>();
  /** FIX-4 (F3 of the confirming round): stops whose `recovery claim` is on the wire now. A quit finishes them as cancelled
   *  too (Switchboard takes `finish cancelled` on a waiting or a claimed stop), so a claim that lands after the app is
   *  gone is refused, never left claimed. */
  private readonly claiming = new Map<string, { stop: SbStop; sb: string }>();
  /** FIX-4: the account labels a waiting stop is shown with, read at most once per BINDING_FRESH_MS. */
  private accountLabels: { at: number; sb: string; value: Record<string, string> } | null = null;
  private quitting = false;
  // #region sessions-host — docs: docs/reports/2026-10-24-ui-ux-iteration/sessions-and-navigation.md#every-state-has-an-action
  /** FD-103: why a console session is ending, set just before it is stopped: the person, the idle close, or the app
   *  quitting (R1-S4). */
  private readonly endReasons = new Map<string, 'you' | 'idle' | 'quit'>();
  /** FD-103: consoles running a session continued after a limit that did not take up its conversation (FD-84). */
  private readonly failedResumes = new Set<string>();
  /** FD-103: the coding agent's own session id of a console that continues a known session, for Continue later. */
  private readonly sessionIds = new Map<string, { sessionId: string; provider: 'claude' | 'codex' }>();
  /** FD-103: the stops of the last recovery read, by event, for Continue now. */
  private readonly lastStops = new Map<string, SbStop>();
  private pending: PendingHandover[] | null = null;
  private handoversEnabled: boolean | null = null;
  private handoverDegraded: SourceDegraded | null = null;
  /** R1-U6: an unreadable recovery since its first failure, like the hand-overs' (a status that changes every tick is
   *  pushed every tick). */
  private recoveryDegraded: SourceDegraded | null = null;
  private switchboardPresent = false;
  private readonly sbSessions = new SourceReader<SbSessionRecord[]>('sessions', async () => {
    const inv = await this.inventory();
    this.switchboardPresent = Boolean(inv.switchboard);
    return inv.switchboard ? allSessionsOf(this.run, inv.switchboard) : { ok: true, value: [] };
  });
  private shownSessions = '';
  // #endregion sessions-host

  constructor(private readonly o: ConsoleHostOptions) {
    this.run = o.run ?? execRunner;
    // One-shot Terminal files remove themselves when they run; one Terminal never ran is removed here.
    try {
      for (const name of fs.readdirSync(o.scriptsDir)) if (/^open-.*\.command$/.test(name)) fs.rmSync(path.join(o.scriptsDir, name), { force: true });
    } catch { /* no folder yet */ }
    let spawn: SpawnPty | null = o.spawn ?? null;
    this.manager = new ConsoleManager({
      spawn: (file, args, opts) => (spawn ??= loadSpawn())(file, args, opts),
      env: () => ({ ...process.env }),
      killGroup: o.killGroup,
    });
    this.manager.on('data', (e: { key: string; data: string; end: number }) => this.send({ key: e.key, kind: 'data', data: e.data, end: e.end }));
    // FD-50 (LC-18): an idle session is saved and closed, checked once a minute; nothing else wakes.
    const idleMs = o.idleMs ?? IDLE_CLOSE_MS;
    if (idleMs > 0) setInterval(() => void this.closeIdle(idleMs), 60_000).unref();
    this.manager.on('exit', (e: { key: string; code: number | null; signal: number | null }) => {
      this.o.log(`console: ${e.key} exited with ${e.code}${e.signal ? ` (signal ${e.signal})` : ''}`);
      this.send({ key: e.key, kind: 'exit', code: e.code, signal: e.signal });
      this.recordEnd(e.key, e.code);
      this.o.changed?.(); // FD-62: the shell's list shows it ended; FD-103: so does the Sessions list
    });
  }

  /** LC-08: a hidden window receives nothing; it reads the ring again when it shows. */
  private send(event: unknown): void {
    const w = this.o.window();
    if (!w || w.isDestroyed() || !this.o.visible()) return;
    w.webContents.send(CHANNELS.consoleEvent, event);
    const d = this.o.drawer?.();
    if (d && !d.isDestroyed()) d.send(CHANNELS.consoleEvent, event);
  }

  private searchPath(): Promise<string[]> {
    this.dirs ??= this.o.testDirs ? Promise.resolve(this.o.testDirs) : readLoginPath().then((p) => searchDirs(p));
    return this.dirs;
  }

  /** The runtimes installed, read once per launch (looked for again while none is found), and
   *  Switchboard, looked for on every call: one installed later must bind its folders at once
   *  (review R-3) — a stat per folder, and `launch --help` only when the binary changed. */
  private async inventory(): Promise<{ runtimes: Runtime[]; switchboard: string | null; inPlace: boolean; dirs: string[] }> {
    const dirs = await this.searchPath();
    const switchboard = findSwitchboard(dirs);
    if (!this.catalog) {
      this.catalog = (async () => {
        let extra: RuntimeSpec[] = [];
        if (switchboard) {
          const r = await this.run(switchboard, ['--json', 'agents', 'list'], 10_000);
          try { extra = specsFromSwitchboard(JSON.parse(r.stdout)); } catch { extra = []; }
        }
        const runtimes = detectRuntimes(dirs, [...KNOWN_RUNTIMES, ...extra]);
        this.o.log(`console: runtimes ${runtimes.map((r) => r.id).join(', ') || 'none'}; switchboard ${switchboard ?? 'absent'}`);
        return runtimes;
      })();
    }
    const runtimes = await this.catalog;
    if (!runtimes.length) this.catalog = null; // nothing found: look again next time
    let inPlace = false;
    if (switchboard) {
      let stamp = switchboard;
      try { stamp += `:${fs.statSync(switchboard).mtimeMs}`; } catch { /* checked below anyway */ }
      if (this.inPlaceFor?.key !== stamp) this.inPlaceFor = { key: stamp, value: await canLaunchInPlace(this.run, switchboard) };
      inPlace = this.inPlaceFor.value;
    }
    return { runtimes, switchboard, inPlace, dirs };
  }

  private folderOf(key: string): ConsoleInfo['folder'] {
    const saved = this.o.settings.get().consoles[key]?.folder;
    if (saved) return { path: saved, source: 'saved', exists: isDir(saved) };
    // FD-39: the Setup console belongs to no agent; it runs in the home folder unless the person chose another.
    if (key === SETUP_KEY) return { path: setupFolder(), source: 'found', exists: true };
    const d = this.o.snapshot(key)?.descriptor;
    if (!d) return null;
    const commandPaths = Object.values(d.commands ?? {}).map((argv) => String(argv?.[0] ?? '')).filter(Boolean).map(expandHome);
    const found = findCheckout({ repository: d.source?.repository, commandPaths });
    return found ? { path: found, source: 'found', exists: true } : null;
  }

  private chosen(key: string, runtimes: Runtime[]): Runtime | null {
    const id = this.o.settings.get().consoles[key]?.runtime;
    return runtimes.find((r) => r.id === id) ?? runtimes.find((r) => r.id === 'claude-code') ?? runtimes[0] ?? null;
  }

  private async bindingFor(runtime: Runtime | null, folder: string | null, inv: { switchboard: string | null; inPlace: boolean }): Promise<Binding | { kind: 'absent' }> {
    if (!inv.switchboard) return { kind: 'absent' };
    if (!runtime || !folder) return { kind: 'none' };
    const value = await bindingFor(this.run, inv.switchboard, folder, runtime.provider);
    this.bindings.set(`${inv.switchboard}|${folder}|${runtime.provider ?? ''}`, { at: Date.now(), value, pending: false });
    return value;
  }

  // #region console-fast-open — docs: docs/ux/scenarios.md#scn-048-open-an-agents-console-over-its-dashboard
  /** FD-74: the console shows what Switchboard said about this folder less than BINDING_FRESH_MS ago at once, and an
   *  older answer while it asks again in the background; only a folder it never answered for waits for it. A start
   *  always asks afresh (start(), openTerminal()): a session never starts on a remembered answer. */
  private async shownBinding(runtime: Runtime | null, folder: string | null, inv: { switchboard: string | null; inPlace: boolean }): Promise<Binding | { kind: 'absent' }> {
    if (!inv.switchboard || !runtime || !folder) return this.bindingFor(runtime, folder, inv);
    const k = `${inv.switchboard}|${folder}|${runtime.provider ?? ''}`;
    const c = this.bindings.get(k);
    if (!c) return this.bindingFor(runtime, folder, inv);
    if (Date.now() - c.at >= BINDING_FRESH_MS && !c.pending) {
      c.pending = true;
      void this.bindingFor(runtime, folder, inv).catch(() => { c.pending = false; });
    }
    return c.value;
  }

  /** FD-74: read the login shell's PATH and the runtimes once, soon after start, so the first console opens at once
   *  (measured 2026-10-19: the login shell took 1.7 s on this Mac). */
  warm(): void {
    void this.inventory().catch((error: Error) => this.o.log(`console: runtimes not read ahead: ${error.message}`));
  }
  // #endregion console-fast-open

  async info(key: string): Promise<ConsoleInfo> {
    const inv = await this.inventory();
    const runtime = this.chosen(key, inv.runtimes);
    const folder = this.folderOf(key);
    const b = await this.shownBinding(runtime, folder?.exists ? folder.path : null, inv);
    const s = this.manager.snapshot(key);
    return {
      key,
      runtimes: inv.runtimes.map((r) => ({ id: r.id, name: r.name, canContinue: Boolean(r.continueArgs), viaSwitchboard: Boolean(r.provider) })),
      runtime: runtime?.id ?? null,
      folder,
      binding: b.kind === 'project' ? { ...b, inPlace: inv.inPlace } : b,
      session: { state: s.state, label: s.label, cwd: s.cwd, output: s.output, end: s.end, exitCode: s.exitCode, signal: s.signal },
      idle: this.o.settings.get().consoles[key]?.idle ?? null,
      handover: this.handoverInfo(key),
    };
  }

  private handoverInfo(key: string): ConsoleInfo['handover'] {
    const h = this.handoverOf.get(key);
    return h ? { id: h.id, workflow: h.workflow, agent: h.agent, account: h.account, dir: h.dir, kind: this.resumedKeys.has(key) ? 'resume' : 'handover' } : null;
  }

  /** The context pack for this start, written now; null when there is no snapshot or no pack root.
   *  A pack that cannot be written is logged and the session starts without it — never blocked by it. */
  private pack(key: string, runtime: Runtime, folder: string, task?: ConsoleTask): { handoff: { before: string[]; after: string[] }; env: Record<string, string> } | null {
    if (key === SETUP_KEY && this.o.packRoot && this.o.mcpServer) {
      try {
        const r = prepareSetup({ dir: path.join(this.o.packRoot, key), runtimeId: runtime.id, runtimeName: runtime.name, server: this.o.mcpServer(), state: this.o.setupState?.() ?? { mcp: false, skills: false, firstAgent: false }, doctor: this.o.doctor?.() ?? null });
        return { handoff: r.handoff, env: r.env };
      } catch (error) {
        this.o.log(`console: setup starts without its brief: ${(error as Error).message}`);
        return null;
      }
    }
    const snap = this.o.snapshot(key);
    if (!snap || !this.o.packRoot || !this.o.mcpServer) return null;
    try {
      const r = prepareHandoff({ snapshot: snap, activity: this.o.activity?.(key) ?? [], folder, runtimeId: runtime.id, dir: path.join(this.o.packRoot, key), server: this.o.mcpServer(), version: this.o.version ?? '0.0.0', task });
      return { handoff: r.handoff, env: r.env };
    } catch (error) {
      this.o.log(`console: ${key} starts without its context pack: ${(error as Error).message}`);
      return null;
    }
  }

  /** FD-129 (UX-16): the task goes to the session that runs: its `task.md` is written and one line pointing at it is
   *  typed in, with no Enter, so the person reads it and sends it. Nothing is typed when no session runs. */
  sendTask(key: string, task: ConsoleTask): { ok: boolean; error?: string } {
    if (this.manager.snapshot(key).state !== 'running') return { ok: false, error: 'not-running' };
    const snap = this.o.snapshot(key);
    const folder = this.folderOf(key);
    if (!snap || !folder?.exists || !this.o.packRoot) return { ok: false, error: 'no-pack' };
    try {
      const r = writeTaskOnly({ snapshot: snap, activity: this.o.activity?.(key) ?? [], folder: folder.path, dir: path.join(this.o.packRoot, key), task });
      this.manager.input(key, r.line);
      this.o.log(`console: ${key} got a ${task.kind} task typed into its running session`);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  async start(key: string, mode: 'new' | 'continue', size: { cols: number; rows: number }, task?: ConsoleTask): Promise<ConsoleStartResult> {
    if (this.manager.snapshot(key).state === 'running') return { ok: false, reason: 'running' };
    const inv = await this.inventory();
    const runtime = this.chosen(key, inv.runtimes);
    if (!runtime) return { ok: false, reason: 'no-runtime' };
    const folder = this.folderOf(key);
    if (!folder?.exists) return { ok: false, reason: 'no-folder' };
    // FD-49 (LC-17): start only what the machine can carry; otherwise defer, saying why.
    const a = admit(await (this.o.machine ?? machineProbe)(folder.path, this.manager.runningCount()));
    if (!a.ok) {
      this.o.log(`console: ${key} start deferred (LC-17): ${a.why}`);
      if (a.why === 'disk') return { ok: false, reason: 'admission', why: 'disk', freeGb: Math.round((a.freeDisk / 1024 ** 3) * 10) / 10 };
      if (a.why === 'cap') return { ok: false, reason: 'admission', why: 'cap', running: a.running, cap: a.cap };
      return { ok: false, reason: 'admission', why: 'swap' };
    }
    const b = await this.bindingFor(runtime, folder.path, inv);
    const pack = this.pack(key, runtime, folder.path, task);
    // FD-51 (LC-20): with a Switchboard route for this provider, every start runs managed.
    const managed = inv.switchboard && runtime.provider && inv.inPlace ? managesProvider(await accountsOf(this.run, inv.switchboard), runtime.provider) : false;
    const plan = planStart({ runtime, mode, folder: folder.path, binding: b.kind === 'absent' ? { kind: 'none' } : b, switchboard: inv.switchboard, inPlace: inv.inPlace, managed, handoff: pack?.handoff });
    if (plan.kind === 'refused') return { ok: false, reason: plan.reason, detail: plan.detail };
    if (plan.kind === 'terminal-only') return { ok: false, reason: 'terminal-only', project: plan.project };
    // Review R-1: the session runs with the login shell's PATH, not the one an app opened from Finder has.
    const r = this.manager.start(key, { argv: plan.argv, cwd: plan.cwd, label: runtime.name, env: { PATH: inv.dirs.join(path.delimiter), ...(pack?.env ?? {}) } }, size);
    if (!r.ok) return { ok: false, reason: r.error === 'running' ? 'running' : 'spawn', detail: r.error };
    this.handoverOf.delete(key); // FD-62: this console now runs the person's own session
    // R1-C: Continue in the console takes up its last session, so that session's ended row leaves the Sessions list, as
    // Continue in the list clears the console's idle mark (SCN-066, SCN-084).
    if (mode === 'continue') this.forgetLatestEnded(key);
    // Remember what was started, so the panel offers it next time.
    this.o.settings.update({ consoles: { [key]: { runtime: runtime.id, folder: folder.source === 'saved' ? folder.path : this.o.settings.get().consoles[key]?.folder ?? null, idle: null } } });
    this.o.log(`console: ${key} started ${runtime.id} (${mode}) in ${folder.path}${plan.argv[0] === inv.switchboard ? ' through Switchboard' : ''}${pack ? ` with its context${task ? ` and a ${task.kind} task` : ''}` : ''}`);
    return { ok: true };
  }

  /** FD-50 (LC-18): save each idle session (when, and the Switchboard account it ran on) and close it, so it
   *  holds neither memory nor MCP servers; opening the console again continues it. */
  async closeIdle(idleMs: number, now = Date.now()): Promise<string[]> {
    const keys = this.manager.idleKeys(idleMs, now);
    for (const key of keys) {
      let account: string | null = null;
      try {
        const listed = await this.sessions(key);
        if ('sessions' in listed) account = listed.sessions.find((x) => x.state === 'running')?.movedTo ?? listed.sessions.find((x) => x.state === 'running')?.label ?? null;
      } catch { /* the account is a nicety; the close is not */ }
      const entry = this.o.settings.get().consoles[key] ?? { runtime: null, folder: null };
      this.o.settings.update({ consoles: { [key]: { ...entry, idle: { at: new Date(now).toISOString(), account } } } });
      this.endReasons.set(key, 'idle');
      this.manager.stop(key);
      this.o.log(`console: ${key} closed after ${Math.round(idleMs / 60_000)} idle minutes (LC-18); opening it again continues it`);
    }
    return keys;
  }

  /** FD-43: the sessions Switchboard launched in this console's folder, and where each runs now (FD-51).
   *  Read only while the console is shown (the renderer asks at its cadence); nothing without Switchboard. */
  async sessions(key: string): Promise<SbSessions | { unavailable: 'absent' | 'no-folder'; detail: string }> {
    const inv = await this.inventory();
    if (!inv.switchboard) return { unavailable: 'absent', detail: '' };
    const folder = this.folderOf(key);
    if (!folder?.exists) return { unavailable: 'no-folder', detail: '' };
    return sessionsIn(this.run, inv.switchboard, folder.path, await accountsOf(this.run, inv.switchboard));
  }

  // #region console-handovers — docs: docs/ux/scenarios.md#scn-069-a-hand-over-opens-in-the-console
  /** FD-62 (SB-108): takes each hand-over Switchboard left for a console, once, on a console PTY. One the
   *  machine cannot carry now (LC-17) is left alone: Switchboard opens it in Terminal after two minutes.
   *  Nothing runs without Switchboard. Returns the console keys that took one. */
  async pollHandovers(now = Date.now()): Promise<string[]> {
    const inv = await this.inventory();
    if (!inv.switchboard) return [];
    const r = await handoversOf(this.run, inv.switchboard);
    if ('unavailable' in r) {
      if (this.handoversUnavailable !== r.unavailable) this.o.log(`console: hand-overs cannot be read (${r.unavailable}): ${r.detail}`);
      this.handoversUnavailable = r.unavailable;
      this.handoverDegraded = { source: 'handovers', reason: r.unavailable, detail: r.detail, since: this.handoverDegraded?.since ?? now };
      return [];
    }
    if (this.handoversUnavailable) this.o.log('console: hand-overs can be read again'); // FD-69: a recovery is said, not silent
    this.handoversUnavailable = null;
    this.handoverDegraded = null;
    this.pending = r.handovers;
    this.handoversEnabled = r.enabled;
    const taken: string[] = [];
    for (const h of r.handovers) {
      if (this.seenHandovers.has(h.id)) continue;
      // FD-103: an offer that lapsed before this app saw it is a row for the person, not only a skip.
      if (h.offeredUntil <= now) { this.seenHandovers.add(h.id); this.notOpened(h, 'expired', now); continue; }
      this.seenHandovers.add(h.id);
      if (this.seenHandovers.size > 512) this.seenHandovers.delete(this.seenHandovers.values().next().value!);
      const key = await this.takeHandover(h, inv.switchboard, inv.dirs);
      if (key) taken.push(key);
    }
    return taken;
  }

  private async takeHandover(h: SbHandover, sb: string, dirs: string[]): Promise<string | null> {
    if (!isDir(h.dir)) { this.o.log(`console: hand-over ${h.id} left to Terminal: its folder is not here`); this.notOpened(h, 'no-folder'); return null; }
    // FD-103 (decision 8 of 2026-10-24): a hand-over always gets a console of its own, never an agent's free console in
    // the same folder, so one session lives in one place and the agent's console stays the person's.
    const key = handoverOwnKey(h.id);
    const a = admit(await (this.o.machine ?? machineProbe)(h.dir, this.manager.runningCount()));
    if (!a.ok) { this.o.log(`console: hand-over ${h.id} left to Terminal (LC-17: ${a.why})`); this.notOpened(h, `busy-${a.why}`); return null; } // R1-B: the cause found
    const r = this.manager.start(key, { argv: handoverRunArgv(sb, h.id), cwd: h.dir, label: h.agent || 'agent', env: { PATH: dirs.join(path.delimiter) } }, { cols: 100, rows: 30 });
    if (!r.ok) { this.o.log(`console: hand-over ${h.id} not taken in ${key}: ${r.error}`); this.notOpened(h, 'not-started'); return null; }
    this.handoverOf.set(key, h);
    this.o.log(`console: hand-over ${h.id} (${h.agent}, ${h.workflow}) taken in ${key}`);
    this.notice('handover', key);
    this.o.changed?.();
    return key;
  }

  /** A finished hand-over or continued session's own console leaves the list (Remove, Clear). A running one stays. */
  private dismissHandover(key: string): void {
    if (!isHandoverKey(key) || this.manager.snapshot(key).state === 'running') return;
    this.manager.forget(key);
    this.handoverOf.delete(key);
    this.resumedKeys.delete(key);
    this.failedResumes.delete(key);
    this.sessionIds.delete(key);
    this.o.changed?.();
  }
  // #endregion console-handovers

  // #region limit-recovery — docs: docs/ux/scenarios.md#scn-075-a-session-stopped-on-a-limit-continues-by-itself
  /** FD-83 (SB-115): reads the sessions Switchboard holds as stopped on a limit, at the hand-overs' cadence, and
   *  continues each ready one whose transcript nothing else can be writing, at most RESUMES_PER_PASS a pass. The
   *  rest stays listed for the person. Off in Settings: read, never acted on. Returns the console keys it started. */
  async pollRecovery(now = Date.now()): Promise<string[]> {
    if (this.quitting) return []; // F3 of FIX-2: nothing starts once the app quits
    const on = this.o.settings.get().resumeAfterLimit;
    const inv = await this.inventory();
    if (!inv.switchboard) return this.setRecovery({ on, unavailable: 'absent', stops: [], resumed: this.recovery.resumed });
    const r = await recoveryOf(this.run, inv.switchboard);
    if ('unavailable' in r) {
      if (this.recovery.unavailable !== r.unavailable) this.o.log(`console: limit stops cannot be read (${r.unavailable}): ${r.detail}`);
      this.recoveryDegraded = { source: 'recovery', reason: r.unavailable, detail: r.detail.slice(0, 300), since: this.recoveryDegraded?.since ?? now };
      return this.setRecovery({ on, unavailable: r.unavailable, stops: [...this.actedStops.values()], resumed: this.recovery.resumed });
    }
    if (this.recovery.unavailable && this.recovery.unavailable !== 'absent') this.o.log('console: limit stops can be read again'); // FD-85, as FD-69 for hand-overs
    this.recoveryDegraded = null;
    // FD-103 (decision 2): a stop the person declined, or removed from the list, is never continued here; the decline
    // outlives its row (Remove and Clear keep the record, hidden), and only the person's Continue undoes it (R1-U2).
    const m = this.memory();
    const held = new Set([...m.records.filter((x) => x.end === 'declined').map((x) => x.id), ...m.dismissed.filter((d) => d.id.startsWith('st:')).map((d) => d.id)]);
    this.lastStops.clear();
    for (const s of r.stops) this.lastStops.set(s.event, s);
    const pending = r.stops.filter((s) => s.state !== 'resumed' && !this.actedStops.has(s.event) && !this.taking.has(s.event));
    const read = pending.some((s) => s.ready) ? await liveAgents(this.run).catch(() => null) : null;
    // F4 of FIX-2: a folder one of this app's consoles works in is live too (a hand-over taken on this tick has no claude
    // process yet that lsof could see), so a hand-over and a stop of one folder never both start.
    const live = read && { dirs: [...read.dirs, ...this.manager.runningKeys().map((k) => this.handoverOf.get(k)?.dir ?? this.manager.snapshot(k).cwd).filter(Boolean)], args: read.args };
    // FD-103: Continue now on another account names its candidates, and a stop names the account it stopped on (V-1 of
    // FIX-2); their labels are read only when there are some.
    const labels = pending.some((s) => s.candidates.length || s.account) ? await this.labelsOf(inv.switchboard, now) : {};
    const candidates = (s: SbStop) => s.candidates.map((id) => ({ id, label: labels[id] ?? id }));
    const accountOf = (s: SbStop) => (s.account ? labels[s.account] ?? null : null);
    const views: StopView[] = [];
    const due: SbStop[] = [];
    // FIX-5: a stop whose session went on after it (or stopped again later) is not waiting and is never continued again.
    const continued = continuedOf(r.stops, this.o.home ?? os.homedir(), now);
    for (const s of pending) {
      const verdict = verdictOf(s, live, now, isDir, (x) => transcriptOf(x, this.o.home ?? os.homedir()), continued);
      if (verdict === 'continued') continue;
      // FD-103 (decision 2): a stop the person declined is never continued by this app.
      if (verdict === 'resume' && on && due.length < RESUMES_PER_PASS && !held.has(stopRowId(s.event))) { due.push(s); continue; }
      views.push({ event: s.event, session: s.session, dir: s.dir, provider: s.provider, stoppedAt: s.stoppedAt, attempt: s.attempt, verdict, candidates: candidates(s), probeAt: s.probeAt, account: accountOf(s), waitReason: s.waitReason });
    }
    const started: string[] = [];
    for (const s of due) {
      const key = await this.resume(s, inv.switchboard, inv.dirs, s.candidates[0]!, true);
      if (key) started.push(key);
      else if (!this.actedStops.has(s.event) && !this.taking.has(s.event)) views.push({ event: s.event, session: s.session, dir: s.dir, provider: s.provider, stoppedAt: s.stoppedAt, attempt: s.attempt, verdict: 'resume', candidates: candidates(s), probeAt: s.probeAt, account: accountOf(s), waitReason: s.waitReason });
    }
    this.setRecovery({ on, stops: [...this.actedStops.values(), ...views.filter((v) => !this.actedStops.has(v.event))], resumed: this.recovery.resumed + started.length });
    return started;
  }

  /** FIX-4: the account labels, from Switchboard at most once per BINDING_FRESH_MS while stops wait; a failed read is
   *  not kept, so the next pass asks again. */
  private async labelsOf(sb: string, now = Date.now()): Promise<Record<string, string>> {
    const c = this.accountLabels;
    if (c && c.sb === sb && now - c.at < BINDING_FRESH_MS && now >= c.at) return c.value;
    const read = await accountsOf(this.run, sb).catch(() => null);
    if (!read) return c?.value ?? {};
    this.accountLabels = { at: now, sb, value: read.labels ?? {} };
    return this.accountLabels.value;
  }

  private setRecovery(next: RecoveryStatus): string[] {
    const before = JSON.stringify(this.recovery);
    this.recovery = next;
    if (JSON.stringify(next) !== before) this.o.changed?.();
    return [];
  }

  recoveryStatus(): RecoveryStatus { return this.recovery; }

  /** F2 of FIX-2: what this launch did with a stop replaces its listed view at once, not at the next read, so a waiting
   *  row of a stop just continued is not offered again. */
  private showActed(): void {
    this.setRecovery({ ...this.recovery, stops: [...this.actedStops.values(), ...this.recovery.stops.filter((v) => !this.actedStops.has(v.event))] });
  }

  /** F3 of FIX-2: what a quit still waits for: continues in flight and stops claimed and not finished. */
  quitWork(): number { return this.inFlight.size + this.claimedOpen.size + this.claiming.size; }

  /** F2, F3 of FIX-2: one stop is taken up by one path at a time; the promise is kept for the quit to wait on. */
  private track<T>(event: string, work: () => Promise<T>): Promise<T> {
    this.taking.add(event);
    const p = work();
    this.inFlight.add(p);
    const done = () => { this.taking.delete(event); this.inFlight.delete(p); };
    p.then(done, done);
    return p;
  }

  /** FIX-4: a finish Switchboard did not take keeps its entry, with the outcome meant, so the quit tries it once more. */
  private async finish(stop: SbStop, sb: string, outcome: 'resumed' | 'cancelled'): Promise<boolean> {
    const done = await finishStop(this.run, sb, stop, outcome).catch(() => false);
    if (done) this.claimedOpen.delete(stop.event);
    else this.claimedOpen.set(stop.event, { stop, sb, outcome });
    return done;
  }

  /** Claims the stop once, continues its session in the console through Switchboard, and records the outcome. A stop
   *  the machine cannot carry now (LC-17) is not claimed: the next pass tries again. */
  private resume(stop: SbStop, sb: string, dirs: string[], account: string, automatic: boolean): Promise<string | null> {
    // F2 of FIX-2: a stop another path is taking up now, or this launch continued, is never claimed again.
    if (this.quitting || this.taking.has(stop.event) || this.actedStops.get(stop.event)?.verdict === 'resumed') return Promise.resolve(null);
    return this.track(stop.event, () => this.resumeOnce(stop, sb, dirs, account, automatic));
  }

  private async resumeOnce(stop: SbStop, sb: string, dirs: string[], account: string, automatic: boolean): Promise<string | null> {
    const a = admit(await (this.o.machine ?? machineProbe)(stop.dir, this.manager.runningCount()));
    if (!a.ok) { this.o.log(`console: limit stop ${stop.event} waits (LC-17: ${a.why})`); return null; }
    // FIX-4: a stop this launch acted on keeps the account it stopped on (V-1 of FIX-2), from the labels last read.
    const stoppedOn = stop.account ? this.accountLabels?.value[stop.account] ?? null : null;
    const view = (verdict: StopView['verdict'], key?: string): StopView => ({ event: stop.event, session: stop.session, dir: stop.dir, provider: stop.provider, stoppedAt: stop.stoppedAt, attempt: stop.attempt, verdict, key, account: stoppedOn });
    this.claiming.set(stop.event, { stop, sb });
    const claim = await claimStop(this.run, sb, stop, account).finally(() => this.claiming.delete(stop.event));
    if (!claim.ok) {
      this.actedStops.set(stop.event, view('failed'));
      this.o.log(`console: limit stop ${stop.event} not claimed: ${claim.detail}`);
      this.showActed();
      return null;
    }
    this.claimedOpen.set(stop.event, { stop, sb });
    if (this.quitting) { await this.finish(stop, sb, 'cancelled'); return null; } // F3: claimed while the app quit
    // FD-84: the proof of a continuation is its own transcript being written, read before and after the start.
    const transcript = transcriptOf(stop, this.o.home ?? os.homedir());
    const before = transcript ? writtenAt(transcript) : null;
    // FD-103 (decision 8, extended by the orchestrator 2026-10-24): a session continued after a limit reset gets a console
    // of its own, never an agent's free console in its folder, so it lives on its session page and the agent's console
    // stays the person's.
    const own = resumeOwnKey(stop);
    const key = own;
    // FD-84: the agent's own CLI in its folder, so it reads the home that holds the transcript; a folder bound to a
    // Switchboard group routes it through Switchboard by its own settings.
    const cli = dirs.map((d) => path.join(d, stop.provider)).find((f) => { try { fs.accessSync(f, fs.constants.X_OK); return fs.statSync(f).isFile(); } catch { return false; } });
    const label = stop.provider === 'codex' ? 'Codex' : 'Claude Code';
    const r = cli ? this.manager.start(key, { argv: [cli, ...resumeArgs(stop)], cwd: stop.dir, label, env: { PATH: dirs.join(path.delimiter) } }, { cols: 100, rows: 30 }) : { ok: false as const, error: `${stop.provider} is not installed here` };
    if (!r.ok && r.error === 'running') {
      // FIX-4: its own console already runs (an earlier continue the person kept open); this claim starts nothing, so it
      // is finished as cancelled rather than left claimed for nobody to settle.
      await this.finish(stop, sb, 'cancelled');
      this.o.log(`console: limit stop ${stop.event} already runs in ${key}; the claim is recorded as cancelled`);
      return null;
    }
    if (!r.ok) {
      await this.finish(stop, sb, 'cancelled');
      this.actedStops.set(stop.event, view('failed'));
      this.o.log(`console: limit stop ${stop.event} claimed but not started in ${key}: ${r.error}; recorded as cancelled`);
      this.showActed();
      return null;
    }
    // FD-84: resumed only once proven: still running AND its transcript written since the start. Gone, or alive but
    // silent (a session that opened without its conversation), is cancelled and listed, never recorded as continued.
    const settle = this.o.settleMs ?? RESUME_SETTLE_MS;
    const wrote = () => transcript !== null && (writtenAt(transcript) ?? 0) > (before ?? 0);
    for (let waited = 0; waited < settle && this.manager.snapshot(key).state === 'running' && !wrote(); waited += 250) await new Promise((res) => setTimeout(res, 250));
    const alive = this.manager.snapshot(key).state === 'running';
    if (!alive || !wrote()) {
      await this.finish(stop, sb, 'cancelled');
      this.actedStops.set(stop.event, view('failed', key));
      // FD-103 (SES-05): one that still runs is listed as needing the person, and its console opens by its key.
      if (alive) {
        this.failedResumes.add(key);
        this.handoverOf.set(key, { id: own.slice('handover.'.length), workflow: path.basename(stop.dir), agent: label, account: '', dir: stop.dir, offeredUntil: 0 });
        this.resumedKeys.add(key);
        this.sessionIds.set(key, { sessionId: stop.session, provider: stop.provider });
      }
      this.o.log(alive
        ? `console: session ${stop.session} stopped on a limit runs in ${key} but did not write its transcript within ${Math.round(settle / 1000)} s; recorded as cancelled, left running for the person`
        : `console: session ${stop.session} stopped on a limit exited at once in ${key} (code ${this.manager.snapshot(key).exitCode}); recorded as cancelled`);
      this.showActed();
      this.o.changed?.();
      return null;
    }
    await this.finish(stop, sb, 'resumed');
    this.handoverOf.set(key, { id: own.slice('handover.'.length), workflow: path.basename(stop.dir), agent: label, account: '', dir: stop.dir, offeredUntil: 0 });
    this.resumedKeys.add(key);
    this.sessionIds.set(key, { sessionId: stop.session, provider: stop.provider });
    this.actedStops.set(stop.event, view('resumed', key));
    this.o.log(`console: session ${stop.session} stopped on a limit continued in ${key} (attempt ${stop.attempt})`);
    if (automatic) this.notice('resume', key); // FD-103 (decision 9): like a taken hand-over
    this.showActed();
    this.o.changed?.();
    return key;
  }
  // #endregion limit-recovery

  // #region sessions-host — docs: docs/reports/2026-10-24-ui-ux-iteration/sessions-and-navigation.md#every-state-has-an-action
  /** FD-103: the Sessions list's memory in the settings (kept 24 h); a store from an older caller has none. */
  private memory(): { records: SessionRecord[]; dismissed: { id: string; at: number }[] } {
    const m = this.o.settings.get().sessions;
    const now = Date.now();
    return { records: pruneRecords(m?.records ?? [], now), dismissed: pruneDismissed(m?.dismissed ?? [], now) };
  }

  private remember(change: (m: { records: SessionRecord[]; dismissed: { id: string; at: number }[] }) => void): void {
    const m = this.memory();
    change(m);
    this.o.settings.update({ sessions: m });
  }

  private keep(record: SessionRecord): void {
    this.remember((m) => { m.records = [...m.records.filter((r) => r.id !== record.id), record]; });
  }

  private notice(kind: SessionNotice['kind'], key: string): void {
    const snap = this.manager.snapshot(key);
    const h = this.handoverOf.get(key);
    const folder = h?.dir ?? snap.cwd;
    try {
      this.o.notice?.({ kind, id: consoleRowId(key, snap.startedAt ?? Date.now()), key, project: path.basename(folder), agent: h?.agent || snap.label, at: Date.now() });
    } catch (error) { this.o.log(`console: session notice not delivered: ${(error as Error).message}`); }
  }

  /** FD-103: a hand-over that could not open here is a row for 24 hours, with its reason, not only a log line. */
  private notOpened(h: SbHandover, reason: SessionReason, now = Date.now()): void {
    this.keep({
      id: handoverRowId(h.id), key: null, folder: h.dir, agent: h.agent || 'agent', account: h.account || null, context: null, origin: 'handover',
      end: 'not-opened', reason, startedAt: null, endedAt: now, sessionId: null, provider: providerOf(h.agent), handoverId: h.id,
    });
    this.o.changed?.();
  }

  /** FD-103: a console session ended: kept 24 h with how it ended (by the person, by the idle close, or by itself). A
   *  hand-over whose `handovers run` failed at once because Switchboard is older than this app is a hand-over that did
   *  not open, not a session that ended. */
  private recordEnd(key: string, code: number | null): void {
    const snap = this.manager.snapshot(key);
    const end = this.endReasons.get(key) ?? 'ended';
    this.endReasons.delete(key);
    const h = this.handoverOf.get(key);
    const resumed = this.resumedKeys.has(key);
    const known = this.sessionIds.get(key);
    this.sessionIds.delete(key); // R1-U5: it belonged to this session; a new one on the key has its own or none
    this.failedResumes.delete(key);
    if (snap.startedAt === null) return;
    const now = Date.now();
    if (h && !resumed && code !== 0 && now - snap.startedAt < 60_000 && /earlier version than this command|unrecognized subcommand|unexpected argument/i.test(snap.output)) {
      this.notOpened(h, 'switchboard-old', now);
      return;
    }
    this.keep({
      id: consoleRowId(key, snap.startedAt), key, folder: h?.dir ?? snap.cwd, agent: h?.agent || snap.label || 'agent', account: h?.account || null, context: null,
      origin: h ? (resumed ? 'resume' : 'handover') : 'here', end, reason: null, startedAt: snap.startedAt, endedAt: now,
      sessionId: known?.sessionId ?? null, provider: known?.provider ?? providerOf(h?.agent ?? snap.label), handoverId: h && !resumed ? h.id : null,
    });
  }

  /** R1-S4: the app quits: every running console ends, each recorded as closed when the app quit (not as ended by
   *  itself); resolves once each has exited or been killed (LC-02). */
  async endAllForQuit(): Promise<void> {
    this.quitting = true;
    for (const key of this.manager.runningKeys()) this.endReasons.set(key, 'quit');
    await this.manager.stopAll();
    // F3 of FIX-2: a continue in flight sees its console gone and settles its stop in Switchboard; it gets a few seconds,
    // and a stop still claimed after them is finished as cancelled, so none is left claimed by an app that is gone.
    const within = (ms: number, work: Promise<unknown>) => Promise.race([work, new Promise<void>((r) => setTimeout(r, ms).unref?.())]);
    if (this.inFlight.size) await within(QUIT_SETTLE_MS, Promise.allSettled([...this.inFlight]));
    // FIX-4: a claim still on the wire is cancelled too, and a finish Switchboard refused earlier is tried once more with
    // the outcome it meant.
    const open = new Map<string, { stop: SbStop; sb: string; outcome?: 'resumed' | 'cancelled' }>([...this.claiming, ...this.claimedOpen]);
    if (open.size) await within(QUIT_FINISH_MS, Promise.allSettled([...open.values()].map(({ stop, sb, outcome }) => this.finish(stop, sb, outcome ?? 'cancelled'))));
  }

  /** The person's Stop (the console's button, or End in the Sessions list). */
  stopByPerson(key: string): void {
    if (this.manager.snapshot(key).state === 'running') this.endReasons.set(key, 'you');
    this.manager.stop(key);
  }

  /** FD-103: Switchboard's machine-wide session list, on the hand-overs' tick (15 s shown, 60 s hidden); never more than
   *  one read in flight; a failure keeps the last answer and is listed as a degraded source. */
  async pollSessions(): Promise<void> {
    await this.sbSessions.poll();
    const shown = JSON.stringify(this.sessionsStatus());
    if (shown !== this.shownSessions) { this.shownSessions = shown; this.o.changed?.(); }
  }

  /** FD-103: every coding session of this Mac, as the window lists it (`status.sessions`). */
  sessionsStatus(now = Date.now()): SessionsStatus {
    const m = this.memory();
    const consoles: ConsoleInput[] = this.manager.runningKeys().map((key) => {
      const snap = this.manager.snapshot(key);
      const h = this.handoverOf.get(key);
      const resumed = this.resumedKeys.has(key);
      return {
        key, folder: h?.dir ?? snap.cwd, agent: h?.agent || snap.label || 'agent', startedAt: snap.startedAt ?? now,
        origin: h ? (resumed ? 'resume' : 'handover') : 'here', account: h?.account || null,
        failedResume: this.failedResumes.has(key), handoverId: h && !resumed ? h.id : null,
      };
    });
    const rows = mergeSessions({
      now, switchboard: this.sbSessions.value ?? (this.switchboardPresent ? null : []), pending: this.pending,
      stops: this.recovery.stops, consoles, records: m.records, dismissed: m.dismissed,
    });
    // V-5 of FIX-2: an ended row whose console holds nothing (the app restarted since) says so on its page.
    for (const r of rows) if (r.group === 'ended' && r.key && this.manager.snapshot(r.key).state === 'idle') r.consoleEmpty = true;
    const degraded = [this.sbSessions.degraded, this.handoverDegraded, this.recoveryDegraded].filter((d): d is SourceDegraded => d !== null);
    return { rows, degraded, switchboard: this.switchboardPresent, handovers: { enabled: this.handoversEnabled }, autoContinue: this.o.settings.get().resumeAfterLimit !== false };
  }

  private rowOf(id: string): SessionRow | undefined {
    return this.sessionsStatus().rows.find((r) => r.id === id);
  }

  /** FD-103: Continue (an ended, idle-closed or ended-by-you row) and Continue now on another account (a waiting limit
   *  stop, `account` one of its candidates). Continue resumes the session's own conversation with the agent's CLI in
   *  the same folder when its transcript is known; otherwise it starts a new session there, the way the console starts
   *  one (through Switchboard for a bound folder). A row continued leaves the list: its new session is the row now. */
  async continueSession(id: string, size: { cols: number; rows: number } = { cols: 100, rows: 30 }, account?: string): Promise<SessionActionResult> {
    const row = this.rowOf(id);
    if (!row) return { ok: false, reason: 'unknown' };
    if (row.actions.includes('continueNow') && id.startsWith('st:')) return this.continueStop(id.slice(3), account ?? row.candidates[0]?.id ?? '');
    if (!row.actions.includes('continue')) return { ok: false, reason: 'not-allowed' };
    if (!isDir(row.folder)) return { ok: false, reason: 'no-folder' };
    // F1 of FIX-2: a declined stop is taken up by this Continue alone: the background pass leaves it meanwhile.
    if (id.startsWith('st:')) {
      const event = id.slice(3);
      if (this.taking.has(event)) return { ok: false, reason: 'running' };
      return this.track(event, () => this.continueRow(id, row, size));
    }
    return this.continueRow(id, row, size);
  }

  private async continueRow(id: string, row: SessionRow, size: { cols: number; rows: number }): Promise<SessionActionResult> {
    const record = this.memory().records.find((r) => r.id === id) ?? null;
    // A service's own console continues its last session there, as its Continue button does.
    if (row.origin === 'here' && row.key && !isHandoverKey(row.key)) {
      const r = await this.start(row.key, 'continue', size);
      if (!r.ok) return r.reason === 'admission' ? { ok: false, reason: 'admission', detail: r.why } : { ok: false, reason: r.reason, detail: r.detail };
      this.forgetRow(id);
      return { ok: true, key: row.key };
    }
    const key = row.key && isHandoverKey(row.key) && this.manager.snapshot(row.key).state !== 'running'
      ? row.key : `handover.cs-${crypto.createHash('sha256').update(id).digest('hex').slice(0, 12)}`;
    const provider = record?.provider ?? providerOf(row.agent);
    const home = this.o.home ?? os.homedir();
    const sessionId = record?.sessionId ?? (provider === 'claude' ? await this.quietTranscript(row) : null);
    const inv = await this.inventory();
    // FIX-4: a limit stop's account is the one that ran out; the new session's account comes from Switchboard's in-place
    // record of it (mergeSessions), never from the stop.
    const before = { id: key.slice('handover.'.length), workflow: row.project, agent: row.agent, account: row.origin === 'limit' ? '' : (row.account ?? ''), dir: row.folder, offeredUntil: 0 };
    const resumed = row.origin === 'resume' || id.startsWith('st:');
    const tookUp = Boolean(sessionId && provider && transcriptOf({ session: sessionId, provider } as SbStop, home));
    if (sessionId && provider && tookUp) {
      const cli = inv.dirs.map((d) => path.join(d, provider)).find((f) => { try { fs.accessSync(f, fs.constants.X_OK); return fs.statSync(f).isFile(); } catch { return false; } });
      if (!cli) return { ok: false, reason: 'no-runtime' };
      const a = admit(await (this.o.machine ?? machineProbe)(row.folder, this.manager.runningCount()));
      if (!a.ok) return { ok: false, reason: 'admission', detail: a.why };
      const args = provider === 'codex' ? ['resume', sessionId] : ['--resume', sessionId];
      const r = this.manager.start(key, { argv: [cli, ...args], cwd: row.folder, label: provider === 'codex' ? 'Codex' : 'Claude Code', env: { PATH: inv.dirs.join(path.delimiter) } }, size);
      if (!r.ok) return { ok: false, reason: r.error === 'running' ? 'running' : 'spawn', detail: r.error };
      this.sessionIds.set(key, { sessionId, provider });
    } else {
      this.sessionIds.delete(key); // R1-U5: a new session on this key takes up no earlier conversation
      const runtime = provider === 'codex' ? 'codex' : provider === 'claude' ? 'claude-code' : (inv.runtimes.find((x) => x.id === row.agent || x.name === row.agent)?.id ?? null);
      this.o.settings.update({ consoles: { [key]: { runtime, folder: row.folder } } });
      const r = await this.start(key, 'new', size);
      if (!r.ok) return r.reason === 'admission' ? { ok: false, reason: 'admission', detail: r.why } : { ok: false, reason: r.reason, detail: r.detail };
    }
    this.handoverOf.set(key, before);
    if (resumed) this.resumedKeys.add(key); else this.resumedKeys.delete(key);
    if (id.startsWith('st:')) await this.undecline(id, key, inv.switchboard, tookUp);
    else this.forgetRow(id);
    this.o.log(`console: session ${id} continued in ${key}${sessionId ? ' with its conversation' : ' as a new session'}`);
    this.o.changed?.();
    return { ok: true, key };
  }

  /** FD-103 (decision 3): Continue now on another account: claims the stop on the account the person chose, one of
   *  Switchboard's candidates, and continues it in a console, as the automatic continue does. */
  private async continueStop(event: string, account: string): Promise<SessionActionResult> {
    const stop = this.lastStops.get(event);
    if (!stop) return { ok: false, reason: 'unknown' };
    if (!stop.candidates.includes(account)) return { ok: false, reason: 'account' };
    const inv = await this.inventory();
    if (!inv.switchboard) return { ok: false, reason: 'no-switchboard' };
    // F2 of FIX-2: a second press, or the background pass, is taking it up now, or this launch continued it already.
    if (this.taking.has(event) || this.actedStops.get(event)?.verdict === 'resumed') return { ok: false, reason: 'running' };
    const key = await this.resume(stop, inv.switchboard, inv.dirs, account, false);
    if (!key) return { ok: false, reason: 'claim', detail: this.actedStops.get(event)?.verdict };
    return { ok: true, key };
  }

  /** A row continued, dismissed or cleared leaves the list for 24 hours by a dismissal. Its record stays, hidden: an
   *  ended console's record still claims the Switchboard record of the same session, which would otherwise come back as
   *  a row of its own (R1-U1), and a declined stop stays declined (R1-U2). */
  private forgetRow(id: string): void {
    this.remember((m) => { m.dismissed = [...m.dismissed.filter((d) => d.id !== id), { id, at: Date.now() }]; });
  }

  /** R1-C: the ended row of `key`'s last session, which a Continue in its console takes up, leaves the list. */
  private forgetLatestEnded(key: string): void {
    const m = this.memory();
    const hidden = new Set(m.dismissed.map((d) => d.id));
    const last = m.records.filter((r) => r.key === key && r.end !== 'not-opened' && r.end !== 'declined').sort((a, b) => b.endedAt - a.endedAt)[0];
    if (last && !hidden.has(last.id)) this.forgetRow(last.id);
  }

  /** R1-U2: the person's Continue on a declined stop is the one thing that undoes the decline: its record goes, and the
   *  stop counts as taken up by this launch, so its waiting row does not come back while the new session is the row.
   *  F1 of FIX-2: the stop is settled in Switchboard too, and held here for a day by a dismissal, so neither this launch
   *  nor the next one, nor another host, continues the same conversation a second time.
   *  F1 of FIX-4: Switchboard is read once more before acting, and only a stop still waiting there is settled: one
   *  another host claimed meanwhile is that host's to finish, never cancelled from here. It is recorded as resumed only
   *  when the Continue took up its conversation (claimed on a ready candidate, then finished); a new session in the
   *  folder is not the stopped conversation, so the stop is finished as cancelled. */
  private async undecline(id: string, key: string, sb: string | null, tookUp: boolean): Promise<void> {
    this.remember((m) => {
      m.records = m.records.filter((r) => r.id !== id);
      m.dismissed = [...m.dismissed.filter((d) => d.id !== id), { id, at: Date.now() }];
    });
    const last = this.lastStops.get(id.slice(3));
    if (!last) return;
    this.actedStops.set(last.event, { event: last.event, session: last.session, dir: last.dir, provider: last.provider, stoppedAt: last.stoppedAt, attempt: last.attempt, verdict: 'resumed', key });
    this.showActed();
    if (!sb) return;
    const read = await recoveryOf(this.run, sb).catch(() => null);
    const stop = read && 'stops' in read ? read.stops.find((s) => s.event === last.event) : undefined;
    if (!stop || stop.state !== 'waiting') {
      this.o.log(`console: declined limit stop ${last.event} continued by the person; ${stop ? 'claimed by another host, left to it' : read && 'stops' in read ? 'already finished in Switchboard' : 'Switchboard could not be read; held here for a day'}`);
      return;
    }
    const account = tookUp && stop.ready ? stop.candidates[0] : undefined;
    if (account) {
      this.claiming.set(stop.event, { stop, sb });
      const claim = await claimStop(this.run, sb, stop, account).catch(() => ({ ok: false as const, detail: '' })).finally(() => this.claiming.delete(stop.event));
      if (!claim.ok) {
        // The stop moved since the read (another host, or a capacity change): nothing is finished from here.
        this.o.log(`console: declined limit stop ${stop.event} continued by the person; not claimed (${claim.detail || 'refused'}), held here for a day`);
        return;
      }
      this.claimedOpen.set(stop.event, { stop, sb });
    }
    const outcome = account ? 'resumed' : 'cancelled';
    const done = await this.finish(stop, sb, outcome);
    this.o.log(`console: declined limit stop ${stop.event} continued by the person; ${done ? `recorded as ${outcome} in Switchboard` : 'Switchboard could not be told; held here for a day'}`);
  }

  /** R1-U4: the Claude Code conversation a row without a known session id may take up: the one transcript written while
   *  it ran, but never one written in the last minute or one a live agent may hold (a row with no end may still run). */
  private async quietTranscript(row: SessionRow): Promise<string | null> {
    const home = this.o.home ?? os.homedir();
    const now = Date.now();
    if (row.endedAt !== null) return transcriptIn(row.folder, home, row.startedAt, row.endedAt);
    const id = transcriptIn(row.folder, home, row.startedAt, now, now - 60_000);
    if (!id) return null;
    const live = await liveAgents(this.run).catch(() => null);
    return live && !sessionOpen({ session: id, dir: row.folder } as SbStop, live) ? id : null;
  }

  /** FD-103: Remove (an ended row, a hand-over that did not open, a stop this app does not continue) and Do not
   *  continue (a waiting stop: moved to Ended as declined; this app never continues it, Switchboard's record stays). */
  async dismissSession(id: string): Promise<SessionActionResult> {
    const row = this.rowOf(id);
    if (!row) return { ok: false, reason: 'unknown' };
    if (row.actions.includes('dontContinue') && id.startsWith('st:')) {
      const stop = this.lastStops.get(id.slice(3));
      this.keep({
        id, key: row.key, folder: row.folder, agent: row.agent, account: row.account, context: null, origin: 'limit', end: 'declined', reason: 'declined',
        startedAt: row.startedAt, endedAt: Date.now(), sessionId: stop?.session ?? null, provider: stop?.provider ?? providerOf(row.agent), handoverId: null,
      });
      this.o.log(`console: limit stop ${id.slice(3)} declined by the person; not continued here`);
      this.o.changed?.();
      return { ok: true, key: null };
    }
    if (!row.actions.includes('dismiss')) return { ok: false, reason: 'not-allowed' };
    this.forgetRow(id);
    if (row.key && isHandoverKey(row.key) && this.manager.snapshot(row.key).state !== 'running') this.dismissHandover(row.key);
    this.o.changed?.();
    return { ok: true, key: null };
  }

  /** FD-103: Clear in the Ended group removes every ended row. */
  async clearEnded(): Promise<void> {
    for (const row of this.sessionsStatus().rows.filter((r) => r.group === 'ended')) await this.dismissSession(row.id);
  }

  /** FD-103: End (asks first, in the window) a session that runs in a console of this app. */
  async endSession(id: string): Promise<SessionActionResult> {
    const row = this.rowOf(id);
    if (!row?.key) return { ok: false, reason: 'unknown' };
    if (!row.actions.includes('end')) return { ok: false, reason: 'not-allowed' };
    this.stopByPerson(row.key);
    return { ok: true, key: row.key };
  }

  /** FD-103: Show in Finder, for a row's folder; the folder comes from the row, never from the page. */
  async revealSession(id: string): Promise<SessionActionResult> {
    const row = this.rowOf(id);
    if (!row) return { ok: false, reason: 'unknown' };
    if (!row.actions.includes('reveal')) return { ok: false, reason: 'not-allowed' };
    if (!isDir(row.folder)) return { ok: false, reason: 'no-folder' };
    shell.showItemInFolder(row.folder);
    return { ok: true, key: row.key };
  }

  /** FD-103: Switchboard's switch for handing sessions over to a console, as last read with the hand-overs. */
  async readHandoversSwitch(): Promise<{ available: boolean; enabled: boolean | null }> {
    const inv = await this.inventory();
    return { available: Boolean(inv.switchboard), enabled: inv.switchboard ? this.handoversEnabled : null };
  }

  /** FD-103: turns Switchboard's switch on or off through its CLI, then reads it back. */
  async setHandoversSwitch(on: boolean): Promise<{ ok: boolean; enabled: boolean | null; detail?: string }> {
    const inv = await this.inventory();
    if (!inv.switchboard) return { ok: false, enabled: null, detail: 'Switchboard is not installed' };
    const r = await handoversSwitch(this.run, inv.switchboard, on);
    if (!r.ok) return { ok: false, enabled: this.handoversEnabled, detail: r.detail };
    const read = await handoversOf(this.run, inv.switchboard);
    if ('enabled' in read) this.handoversEnabled = read.enabled;
    this.o.log(`console: Switchboard hand-overs to this app turned ${on ? 'on' : 'off'}`);
    this.o.changed?.();
    return { ok: true, enabled: this.handoversEnabled };
  }
  // #endregion sessions-host

  async openTerminal(key: string, mode: 'new' | 'continue'): Promise<{ ok: boolean; error?: string }> {
    // FD-37: Terminal through LaunchServices is macOS's; a Windows or Linux terminal comes with M2.
    if (process.platform !== 'darwin') return { ok: false, error: 'Opening a terminal window is not available on this system yet.' };
    const inv = await this.inventory();
    const runtime = this.chosen(key, inv.runtimes);
    const folder = this.folderOf(key);
    if (!runtime) return { ok: false, error: 'no-runtime' };
    if (!folder?.exists) return { ok: false, error: 'no-folder' };
    const b = await this.bindingFor(runtime, folder.path, inv);
    if (b.kind === 'error') return { ok: false, error: b.detail };
    if (b.kind === 'project' && runtime.provider && inv.switchboard) {
      // Switchboard opens Terminal itself, on the project's account. Its Terminal launch takes no
      // runtime arguments, so it cannot resume: say so rather than start a fresh session (audit 2026-10-07).
      if (mode === 'continue') return { ok: false, error: 'continue-unsupported' };
      const t = await terminalLaunchArgv(this.run, inv.switchboard, runtime.provider, b.pool, folder.path);
      if ('error' in t) return { ok: false, error: t.error };
      const r = await this.run(t.argv[0]!, t.argv.slice(1), 30_000);
      return r.code === 0 ? { ok: true } : { ok: false, error: (r.stderr || r.stdout).trim().split('\n').pop()?.slice(0, 300) || `exit ${r.code}` };
    }
    // FD-39: a Terminal window gets the same context pack as the console (arguments and environment) —
    // unless a console session of this agent is running: the pack is one per agent key (DEC-0042 SH-5), and
    // rewriting it would take that session's task and brief from under it.
    const busy = this.manager.snapshot(key).state === 'running';
    if (busy) this.o.log(`console: ${key} opens in Terminal without its context pack: a console session holds it`);
    const pack = busy ? null : this.pack(key, runtime, folder.path);
    const plan = planStart({ runtime, mode, folder: folder.path, binding: { kind: 'none' }, switchboard: null, inPlace: false, handoff: pack?.handoff });
    if (plan.kind !== 'run') return { ok: false, error: plan.kind === 'refused' ? plan.detail : 'unavailable' };
    return openInTerminal(this.o.scriptsDir, terminalScript(plan.argv, folder.path, pack?.env ?? {}));
  }

  async pickFolder(key: string): Promise<ConsoleInfo> {
    const w = this.o.window();
    const current = this.folderOf(key);
    const options = { properties: ['openDirectory' as const, 'createDirectory' as const], defaultPath: current?.path };
    const r = w ? await dialog.showOpenDialog(w, options) : await dialog.showOpenDialog(options);
    const chosen = r.canceled ? null : r.filePaths[0];
    if (chosen) this.o.settings.update({ consoles: { [key]: { runtime: this.o.settings.get().consoles[key]?.runtime ?? null, folder: chosen } } });
    return this.info(key);
  }

  async choose(key: string, choice: { runtime?: string }): Promise<ConsoleInfo> {
    const inv = await this.inventory();
    if (choice.runtime && inv.runtimes.some((r) => r.id === choice.runtime)) {
      this.o.settings.update({ consoles: { [key]: { runtime: choice.runtime, folder: this.o.settings.get().consoles[key]?.folder ?? null } } });
    }
    return this.info(key);
  }

  register(): void {
    const keyOk = (key: unknown): key is string => typeof key === 'string' && /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/.test(key);
    const size = (v: unknown) => {
      const s = (v ?? {}) as { cols?: unknown; rows?: unknown };
      return { cols: clampInt(s.cols, 2, 1000, 80), rows: clampInt(s.rows, 1, 500, 24) };
    };
    ipcMain.handle(CHANNELS.consoleInfo, (_e, key) => (keyOk(key) ? this.info(key) : Promise.reject(new Error('not a service key'))));
    ipcMain.handle(CHANNELS.consoleChoose, (_e, key, choice) => (keyOk(key) ? this.choose(key, choice ?? {}) : Promise.reject(new Error('not a service key'))));
    ipcMain.handle(CHANNELS.consolePickFolder, (_e, key) => (keyOk(key) ? this.pickFolder(key) : Promise.reject(new Error('not a service key'))));
    const taskOf = (v: unknown): ConsoleTask | undefined => {
      const x = (v ?? null) as { kind?: unknown; output?: unknown } | null;
      if (!x || (x.kind !== 'fix' && x.kind !== 'update' && x.kind !== 'audit')) return undefined;
      return { kind: x.kind, ...(typeof x.output === 'string' ? { output: x.output.slice(-20_000) } : {}) };
    };
    ipcMain.handle(CHANNELS.consoleStart, (_e, key, mode, s, task) => (keyOk(key) ? this.start(key, mode === 'continue' ? 'continue' : 'new', size(s), taskOf(task)) : Promise.reject(new Error('not a service key'))));
    ipcMain.handle(CHANNELS.consoleStop, (_e, key) => { if (keyOk(key)) this.stopByPerson(key); });
    // #region sessions-host — docs: docs/reports/2026-10-24-ui-ux-iteration/sessions-and-navigation.md#every-state-has-an-action
    // FD-103: the Sessions list's actions name a row by its id; the main process finds what it stands for.
    const idOk = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 500;
    const notARow = () => Promise.reject(new Error('not a session id'));
    ipcMain.handle(CHANNELS.sessionsContinue, (_e, id, s, account) => (idOk(id) ? this.continueSession(id, size(s ?? { cols: 100, rows: 30 }), typeof account === 'string' && account.length <= 64 ? account : undefined) : notARow()));
    ipcMain.handle(CHANNELS.sessionsDismiss, (_e, id) => (idOk(id) ? this.dismissSession(id) : notARow()));
    ipcMain.handle(CHANNELS.sessionsClearEnded, () => this.clearEnded());
    ipcMain.handle(CHANNELS.sessionsEnd, (_e, id) => (idOk(id) ? this.endSession(id) : notARow()));
    ipcMain.handle(CHANNELS.sessionsReveal, (_e, id) => (idOk(id) ? this.revealSession(id) : notARow()));
    ipcMain.handle(CHANNELS.sessionsHandovers, () => this.readHandoversSwitch());
    ipcMain.handle(CHANNELS.sessionsHandoversSet, (_e, on) => (typeof on === 'boolean' ? this.setHandoversSwitch(on) : Promise.reject(new Error('not a switch value'))));
    // #endregion sessions-host
    ipcMain.handle(CHANNELS.consoleSessions, (_e, key) => (keyOk(key) ? this.sessions(key) : Promise.reject(new Error('not a service key'))));
    ipcMain.handle(CHANNELS.consoleOpenTerminal, (_e, key, mode) => (keyOk(key) ? this.openTerminal(key, mode === 'continue' ? 'continue' : 'new') : Promise.reject(new Error('not a service key'))));
    ipcMain.handle(CHANNELS.consoleSendTask, (_e, key, task) => { const job = taskOf(task); return keyOk(key) && job ? this.sendTask(key, job) : { ok: false, error: 'bad-request' }; });
    ipcMain.on(CHANNELS.consoleInput, (_e, key, data) => { if (keyOk(key) && typeof data === 'string' && data.length <= 1_000_000) this.manager.input(key, data); });
    ipcMain.on(CHANNELS.consoleResize, (_e, key, cols, rows) => { if (keyOk(key)) { const s = size({ cols, rows }); this.manager.resize(key, s.cols, s.rows); } });
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
}

/** FD-103: the provider a coding agent's sessions run on, from its catalog id or name. */
function providerOf(agent: string | null | undefined): 'claude' | 'codex' | null {
  const a = (agent ?? '').toLowerCase();
  return a.includes('codex') ? 'codex' : a.includes('claude') ? 'claude' : null;
}

function isDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function expandHome(p: string): string {
  return expand(p); // FD-37: os.homedir(), and `~\` on Windows — HOME is unset there
}

/** Terminal runs the quoted line in a new window: a one-shot `.command` file (0700, removing itself
 *  first) opened with Terminal through LaunchServices — the way Switchboard opens its sessions. No
 *  Apple Events, so no automation permission is asked of the person, signed build or not. */
function openInTerminal(dir: string, line: string): Promise<{ ok: boolean; error?: string }> {
  let file: string;
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    file = path.join(dir, `open-${process.pid}-${Date.now().toString(36)}.command`);
    fs.writeFileSync(file, `#!/bin/sh\nrm -f "$0"\n${line}\n`, { mode: 0o700 });
  } catch (error) {
    return Promise.resolve({ ok: false, error: (error as Error).message });
  }
  return new Promise((resolve) => {
    execFile('/usr/bin/open', ['-a', 'Terminal', file], { timeout: 15_000 }, (error, _out, stderr) => {
      if (error) { try { fs.rmSync(file, { force: true }); } catch { /* gone */ } }
      resolve(error ? { ok: false, error: String(stderr || error.message).trim().slice(0, 300) } : { ok: true });
    });
  });
}
// #endregion console-host
