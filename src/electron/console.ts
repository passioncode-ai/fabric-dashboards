// #region console-host — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
// ADR-0017: the main-process side of the agent console. It decides which runtime, which folder and
// which account (Switchboard) a service's console uses, spawns it on a PTY through ConsoleManager,
// and talks to the window only through typed IPC. No token passes through here: a session bound to
// a Switchboard project is started by Switchboard itself.
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { execRunner, type Runner } from '@passioncode-ai/fabric-service-host';
import { CHANNELS, type ConsoleInfo, type ConsoleStartResult } from '../core/api';
import { ConsoleManager, planStart, terminalScript, type SpawnPty } from '../core/consoles';
import { findCheckout } from '../core/repofind';
import { detectRuntimes, KNOWN_RUNTIMES, readLoginPath, searchDirs, specsFromSwitchboard, type Runtime, type RuntimeSpec } from '../core/runtimes';
import type { SettingsStore } from '../core/settings';
import { bindingFor, canLaunchInPlace, findSwitchboard, terminalLaunchArgv, type Binding } from '../core/switchboard';
import type { ServiceSnapshot } from '../core/types';

/** node-pty 1.1.0 ships its macOS `spawn-helper` without the executable bit, and its postinstall
 *  does not set it: without it every spawn fails with `posix_spawnp failed`. A development checkout
 *  is fixed here; the release build sets it before signing (scripts/dist-mac.mjs). */
export function ensureSpawnHelper(moduleDir: string, arch = process.arch): string | null {
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
}

export class ConsoleHost {
  readonly manager: ConsoleManager;
  private dirs: Promise<string[]> | null = null;
  private catalog: Promise<Runtime[]> | null = null;
  private inPlaceFor: { key: string; value: boolean } | null = null;
  private readonly run: Runner;

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
    });
    this.manager.on('data', (e: { key: string; data: string; end: number }) => this.send({ key: e.key, kind: 'data', data: e.data, end: e.end }));
    this.manager.on('exit', (e: { key: string; code: number | null; signal: number | null }) => {
      this.o.log(`console: ${e.key} exited with ${e.code}${e.signal ? ` (signal ${e.signal})` : ''}`);
      this.send({ key: e.key, kind: 'exit', code: e.code, signal: e.signal });
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
    return bindingFor(this.run, inv.switchboard, folder, runtime.provider);
  }

  async info(key: string): Promise<ConsoleInfo> {
    const inv = await this.inventory();
    const runtime = this.chosen(key, inv.runtimes);
    const folder = this.folderOf(key);
    const b = await this.bindingFor(runtime, folder?.exists ? folder.path : null, inv);
    const s = this.manager.snapshot(key);
    return {
      key,
      runtimes: inv.runtimes.map((r) => ({ id: r.id, name: r.name, canContinue: Boolean(r.continueArgs), viaSwitchboard: Boolean(r.provider) })),
      runtime: runtime?.id ?? null,
      folder,
      binding: b.kind === 'project' ? { ...b, inPlace: inv.inPlace } : b,
      session: { state: s.state, label: s.label, cwd: s.cwd, output: s.output, end: s.end, exitCode: s.exitCode, signal: s.signal },
    };
  }

  async start(key: string, mode: 'new' | 'continue', size: { cols: number; rows: number }): Promise<ConsoleStartResult> {
    if (this.manager.snapshot(key).state === 'running') return { ok: false, reason: 'running' };
    const inv = await this.inventory();
    const runtime = this.chosen(key, inv.runtimes);
    if (!runtime) return { ok: false, reason: 'no-runtime' };
    const folder = this.folderOf(key);
    if (!folder?.exists) return { ok: false, reason: 'no-folder' };
    const b = await this.bindingFor(runtime, folder.path, inv);
    const plan = planStart({ runtime, mode, folder: folder.path, binding: b.kind === 'absent' ? { kind: 'none' } : b, switchboard: inv.switchboard, inPlace: inv.inPlace });
    if (plan.kind === 'refused') return { ok: false, reason: plan.reason, detail: plan.detail };
    if (plan.kind === 'terminal-only') return { ok: false, reason: 'terminal-only', project: plan.project };
    // Review R-1: the session runs with the login shell's PATH, not the one an app opened from Finder has.
    const r = this.manager.start(key, { argv: plan.argv, cwd: plan.cwd, label: runtime.name, env: { PATH: inv.dirs.join(':') } }, size);
    if (!r.ok) return { ok: false, reason: r.error === 'running' ? 'running' : 'spawn', detail: r.error };
    // Remember what was started, so the panel offers it next time.
    this.o.settings.update({ consoles: { [key]: { runtime: runtime.id, folder: folder.source === 'saved' ? folder.path : this.o.settings.get().consoles[key]?.folder ?? null } } });
    this.o.log(`console: ${key} started ${runtime.id} (${mode}) in ${folder.path}${plan.argv[0] === inv.switchboard ? ' through Switchboard' : ''}`);
    return { ok: true };
  }

  async openTerminal(key: string, mode: 'new' | 'continue'): Promise<{ ok: boolean; error?: string }> {
    const inv = await this.inventory();
    const runtime = this.chosen(key, inv.runtimes);
    const folder = this.folderOf(key);
    if (!runtime) return { ok: false, error: 'no-runtime' };
    if (!folder?.exists) return { ok: false, error: 'no-folder' };
    const b = await this.bindingFor(runtime, folder.path, inv);
    if (b.kind === 'error') return { ok: false, error: b.detail };
    if (b.kind === 'project' && runtime.provider && inv.switchboard) {
      // Switchboard opens Terminal itself, on the project's account.
      const t = await terminalLaunchArgv(this.run, inv.switchboard, runtime.provider, b.pool, folder.path);
      if ('error' in t) return { ok: false, error: t.error };
      const r = await this.run(t.argv[0]!, t.argv.slice(1), 30_000);
      return r.code === 0 ? { ok: true } : { ok: false, error: (r.stderr || r.stdout).trim().split('\n').pop()?.slice(0, 300) || `exit ${r.code}` };
    }
    const plan = planStart({ runtime, mode, folder: folder.path, binding: { kind: 'none' }, switchboard: null, inPlace: false });
    if (plan.kind !== 'run') return { ok: false, error: plan.kind === 'refused' ? plan.detail : 'unavailable' };
    return openInTerminal(this.o.scriptsDir, terminalScript(plan.argv, folder.path));
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
    ipcMain.handle(CHANNELS.consoleStart, (_e, key, mode, s) => (keyOk(key) ? this.start(key, mode === 'continue' ? 'continue' : 'new', size(s)) : Promise.reject(new Error('not a service key'))));
    ipcMain.handle(CHANNELS.consoleStop, (_e, key) => { if (keyOk(key)) this.manager.stop(key); });
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
  return p.startsWith('~/') ? path.join(process.env.HOME ?? '', p.slice(2)) : p;
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
