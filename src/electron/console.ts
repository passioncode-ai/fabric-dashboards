// #region console-host — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
// ADR-0017: the main-process side of the agent console. It decides which runtime, which folder and
// which account (Switchboard) a service's console uses, spawns it on a PTY through ConsoleManager,
// and talks to the window only through typed IPC. No token passes through here: a session bound to
// a Switchboard project is started by Switchboard itself.
import { expand } from '@passioncode-ai/fabric-service-host';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execRunner, type Runner } from '@passioncode-ai/fabric-service-host';
import { CHANNELS, type ConsoleInfo, type ConsoleStartResult, type ConsoleTask } from '../core/api';
import { prepareHandoff, type McpCommand } from '../core/handoff';
import { prepareSetup, SETUP_KEY, setupFolder, type SetupState } from '../core/setup';
import type { DoctorReport } from '../core/doctor';
import type { ActivityItem } from '../core/types';
import { ConsoleManager, planStart, terminalScript, type SpawnPty } from '../core/consoles';
import { admit, machineProbe, type MachineState } from '../core/admission';
import { findCheckout } from '../core/repofind';
import { detectRuntimes, KNOWN_RUNTIMES, readLoginPath, searchDirs, specsFromSwitchboard, type Runtime, type RuntimeSpec } from '../core/runtimes';
import type { SettingsStore } from '../core/settings';
import { accountsOf, bindingFor, canLaunchInPlace, findSwitchboard, handoverKey, handoverRunArgv, handoversOf, isHandoverKey, managesProvider, sessionsIn, terminalLaunchArgv, type Binding, type SbHandover, type SbSessions } from '../core/switchboard';
import type { ServiceSnapshot } from '../core/types';
import { claimStop, finishStop, liveAgents, recoveryOf, resumeArgs, resumeOwnKey, transcriptOf, verdictOf, writtenAt, RESUME_SETTLE_MS, RESUMES_PER_PASS, type RecoveryStatus, type SbStop, type StopView } from '../core/recovery';

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
}

/** FD-62: how often hand-overs are read, in AGENTS.md's lifecycle table. */
export const HANDOVER_POLL_MS = { visible: 15_000, hidden: 60_000 };

/** FD-62: a console that runs a hand-over, as the shell lists it. */
export interface HandoverConsole { key: string; workflow: string; agent: string; account: string; dir: string; state: 'running' | 'exited'; kind: 'handover' | 'resume' }

/** D2 of the 2026-10-12 board waves, stated in AGENTS.md's lifecycle table (LC-18). */
export const IDLE_CLOSE_MS = 30 * 60_000;

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
      if (this.handoverOf.has(e.key)) this.o.changed?.(); // FD-62: the shell's list shows it ended
    });
  }

  /** LC-08: a hidden window receives nothing; it reads the ring again when it shows. */
  private send(event: unknown): void {
    const w = this.o.window();
    if (w && !w.isDestroyed() && this.o.visible()) w.webContents.send(CHANNELS.consoleEvent, event);
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

  // #region console-fast-open — docs: docs/ux/scenarios.md#scn-048-open-an-agents-console-beside-its-dashboard
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
      return [];
    }
    if (this.handoversUnavailable) this.o.log('console: hand-overs can be read again'); // FD-69: a recovery is said, not silent
    this.handoversUnavailable = null;
    const taken: string[] = [];
    for (const h of r.handovers) {
      if (this.seenHandovers.has(h.id) || h.offeredUntil <= now) continue;
      this.seenHandovers.add(h.id);
      if (this.seenHandovers.size > 512) this.seenHandovers.delete(this.seenHandovers.values().next().value!);
      const key = await this.takeHandover(h, inv.switchboard, inv.dirs);
      if (key) taken.push(key);
    }
    return taken;
  }

  private async takeHandover(h: SbHandover, sb: string, dirs: string[]): Promise<string | null> {
    if (!isDir(h.dir)) { this.o.log(`console: hand-over ${h.id} left to Terminal: its folder is not here`); return null; }
    const consoles = (this.o.keys?.() ?? []).map((key) => {
      const folder = this.folderOf(key);
      return { key, folder: folder?.exists ? folder.path : null, running: this.manager.snapshot(key).state === 'running' };
    });
    const key = handoverKey(h, consoles);
    const a = admit(await (this.o.machine ?? machineProbe)(h.dir, this.manager.runningCount()));
    if (!a.ok) { this.o.log(`console: hand-over ${h.id} left to Terminal (LC-17: ${a.why})`); return null; }
    const r = this.manager.start(key, { argv: handoverRunArgv(sb, h.id), cwd: h.dir, label: h.agent || 'agent', env: { PATH: dirs.join(path.delimiter) } }, { cols: 100, rows: 30 });
    if (!r.ok) { this.o.log(`console: hand-over ${h.id} not taken in ${key}: ${r.error}`); return null; }
    this.handoverOf.set(key, h);
    this.o.log(`console: hand-over ${h.id} (${h.agent}, ${h.workflow}) taken in ${key}`);
    this.o.changed?.();
    return key;
  }

  /** The consoles of their own that run or ran a hand-over, for the shell's list. */
  handoverConsoles(): HandoverConsole[] {
    const out: HandoverConsole[] = [];
    for (const [key, h] of this.handoverOf) {
      if (!isHandoverKey(key)) continue;
      const state = this.manager.snapshot(key).state;
      if (state === 'idle') continue;
      out.push({ key, workflow: h.workflow, agent: h.agent, account: h.account, dir: h.dir, state, kind: this.resumedKeys.has(key) ? 'resume' : 'handover' });
    }
    return out;
  }

  /** The person closes a finished hand-over console: it leaves the list. A running one is stopped first. */
  dismissHandover(key: string): void {
    if (!isHandoverKey(key) || this.manager.snapshot(key).state === 'running') return;
    this.manager.forget(key);
    this.handoverOf.delete(key);
    this.resumedKeys.delete(key);
    this.o.changed?.();
  }
  // #endregion console-handovers

  // #region limit-recovery — docs: docs/ux/scenarios.md#scn-075-a-session-stopped-on-a-limit-continues-by-itself
  /** FD-83 (SB-115): reads the sessions Switchboard holds as stopped on a limit, at the hand-overs' cadence, and
   *  continues each ready one whose transcript nothing else can be writing, at most RESUMES_PER_PASS a pass. The
   *  rest stays listed for the person. Off in Settings: read, never acted on. Returns the console keys it started. */
  async pollRecovery(now = Date.now()): Promise<string[]> {
    const on = this.o.settings.get().resumeAfterLimit;
    const inv = await this.inventory();
    if (!inv.switchboard) return this.setRecovery({ on, unavailable: 'absent', stops: [], resumed: this.recovery.resumed });
    const r = await recoveryOf(this.run, inv.switchboard);
    if ('unavailable' in r) {
      if (this.recovery.unavailable !== r.unavailable) this.o.log(`console: limit stops cannot be read (${r.unavailable}): ${r.detail}`);
      return this.setRecovery({ on, unavailable: r.unavailable, stops: [...this.actedStops.values()], resumed: this.recovery.resumed });
    }
    const pending = r.stops.filter((s) => s.state !== 'resumed' && !this.actedStops.has(s.event));
    const live = pending.some((s) => s.ready) ? await liveAgents(this.run).catch(() => null) : null;
    const views: StopView[] = [];
    const due: SbStop[] = [];
    for (const s of pending) {
      const verdict = verdictOf(s, live, now, isDir, (x) => transcriptOf(x, this.o.home ?? os.homedir()));
      if (verdict === 'resume' && on && due.length < RESUMES_PER_PASS) { due.push(s); continue; }
      views.push({ event: s.event, session: s.session, dir: s.dir, provider: s.provider, stoppedAt: s.stoppedAt, attempt: s.attempt, verdict });
    }
    const started: string[] = [];
    for (const s of due) {
      const key = await this.resume(s, inv.switchboard, inv.dirs);
      if (key) started.push(key);
      else if (!this.actedStops.has(s.event)) views.push({ event: s.event, session: s.session, dir: s.dir, provider: s.provider, stoppedAt: s.stoppedAt, attempt: s.attempt, verdict: 'resume' });
    }
    this.setRecovery({ on, stops: [...this.actedStops.values(), ...views], resumed: this.recovery.resumed + started.length });
    return started;
  }

  private setRecovery(next: RecoveryStatus): string[] {
    const before = JSON.stringify(this.recovery);
    this.recovery = next;
    if (JSON.stringify(next) !== before) this.o.changed?.();
    return [];
  }

  recoveryStatus(): RecoveryStatus { return this.recovery; }

  /** Claims the stop once, continues its session in the console through Switchboard, and records the outcome. A stop
   *  the machine cannot carry now (LC-17) is not claimed: the next pass tries again. */
  private async resume(stop: SbStop, sb: string, dirs: string[]): Promise<string | null> {
    const a = admit(await (this.o.machine ?? machineProbe)(stop.dir, this.manager.runningCount()));
    if (!a.ok) { this.o.log(`console: limit stop ${stop.event} waits (LC-17: ${a.why})`); return null; }
    const view = (verdict: StopView['verdict'], key?: string): StopView => ({ event: stop.event, session: stop.session, dir: stop.dir, provider: stop.provider, stoppedAt: stop.stoppedAt, attempt: stop.attempt, verdict, key });
    const claim = await claimStop(this.run, sb, stop, stop.candidates[0]!);
    if (!claim.ok) {
      this.actedStops.set(stop.event, view('failed'));
      this.o.log(`console: limit stop ${stop.event} not claimed: ${claim.detail}`);
      return null;
    }
    const consoles = (this.o.keys?.() ?? []).map((key) => {
      const folder = this.folderOf(key);
      return { key, folder: folder?.exists ? folder.path : null, running: this.manager.snapshot(key).state === 'running' };
    });
    // FD-84: the proof of a continuation is its own transcript being written, read before and after the start.
    const transcript = transcriptOf(stop, this.o.home ?? os.homedir());
    const before = transcript ? writtenAt(transcript) : null;
    const own = resumeOwnKey(stop);
    const key = handoverKey({ id: own.slice('handover.'.length), dir: stop.dir }, consoles, own);
    // FD-84: the agent's own CLI in its folder, so it reads the home that holds the transcript; a folder bound to a
    // Switchboard group routes it through Switchboard by its own settings.
    const cli = dirs.map((d) => path.join(d, stop.provider)).find((f) => { try { fs.accessSync(f, fs.constants.X_OK); return fs.statSync(f).isFile(); } catch { return false; } });
    const label = stop.provider === 'codex' ? 'Codex' : 'Claude Code';
    const r = cli ? this.manager.start(key, { argv: [cli, ...resumeArgs(stop)], cwd: stop.dir, label, env: { PATH: dirs.join(path.delimiter) } }, { cols: 100, rows: 30 }) : { ok: false as const, error: `${stop.provider} is not installed here` };
    if (!r.ok) {
      await finishStop(this.run, sb, stop, 'cancelled');
      this.actedStops.set(stop.event, view('failed'));
      this.o.log(`console: limit stop ${stop.event} claimed but not started in ${key}: ${r.error}; recorded as cancelled`);
      return null;
    }
    // FD-84: resumed only once proven: still running AND its transcript written since the start. Gone, or alive but
    // silent (a session that opened without its conversation), is cancelled and listed, never recorded as continued.
    const settle = this.o.settleMs ?? RESUME_SETTLE_MS;
    const wrote = () => transcript !== null && (writtenAt(transcript) ?? 0) > (before ?? 0);
    for (let waited = 0; waited < settle && this.manager.snapshot(key).state === 'running' && !wrote(); waited += 250) await new Promise((res) => setTimeout(res, 250));
    const alive = this.manager.snapshot(key).state === 'running';
    if (!alive || !wrote()) {
      await finishStop(this.run, sb, stop, 'cancelled');
      this.actedStops.set(stop.event, view('failed', key));
      this.o.log(alive
        ? `console: session ${stop.session} stopped on a limit runs in ${key} but did not write its transcript within ${Math.round(settle / 1000)} s; recorded as cancelled, left running for the person`
        : `console: session ${stop.session} stopped on a limit exited at once in ${key} (code ${this.manager.snapshot(key).exitCode}); recorded as cancelled`);
      this.o.changed?.();
      return null;
    }
    await finishStop(this.run, sb, stop, 'resumed');
    this.handoverOf.set(key, { id: own.slice('handover.'.length), workflow: path.basename(stop.dir), agent: label, account: '', dir: stop.dir, offeredUntil: 0 });
    this.resumedKeys.add(key);
    this.actedStops.set(stop.event, view('resumed', key));
    this.o.log(`console: session ${stop.session} stopped on a limit continued in ${key} (attempt ${stop.attempt})`);
    this.o.changed?.();
    return key;
  }
  // #endregion limit-recovery

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
    ipcMain.handle(CHANNELS.consoleStop, (_e, key) => { if (keyOk(key)) this.manager.stop(key); });
    ipcMain.handle(CHANNELS.consoleDismissHandover, (_e, key) => { if (keyOk(key)) this.dismissHandover(key); });
    ipcMain.handle(CHANNELS.consoleSessions, (_e, key) => (keyOk(key) ? this.sessions(key) : Promise.reject(new Error('not a service key'))));
    ipcMain.handle(CHANNELS.consoleOpenTerminal, (_e, key, mode) => (keyOk(key) ? this.openTerminal(key, mode === 'continue' ? 'continue' : 'new') : Promise.reject(new Error('not a service key'))));
    ipcMain.on(CHANNELS.consoleInput, (_e, key, data) => { if (keyOk(key) && typeof data === 'string' && data.length <= 1_000_000) this.manager.input(key, data); });
    ipcMain.on(CHANNELS.consoleResize, (_e, key, cols, rows) => { if (keyOk(key)) { const s = size({ cols, rows }); this.manager.resize(key, s.cols, s.rows); } });
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
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
