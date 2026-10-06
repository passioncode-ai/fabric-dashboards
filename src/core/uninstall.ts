// Uninstall (lifecycle LC-14): remove what installing and running added — the agent registration
// of the MCP server, the login item (main.ts, through Electron) and the app's own data — so no
// agent keeps spawning a binary that is gone. Pure over a home directory, so tests run against a
// temporary HOME and never touch the operator's files.
// #region uninstall — docs: docs/ux/scenarios.md#scn-024-settings-launch-at-login-notifications-quiet-hours
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { atomicWrite } from './fsutil';
import { AUTO_UPDATE_FILE } from './autoupdate';

export const MCP_SERVER_NAME = 'fabric-dashboards';
export const BUNDLE_ID = 'ai.passioncode.fabric-dashboards';
export const PRODUCT = 'Fabric Dashboards';
const LAUNCHER = 'fabric-dashboards-mcp';

interface McpEntry { command?: unknown; args?: unknown }
type Servers = Record<string, McpEntry>;

/** Ours: the packaged launcher, or `node …/out/main/mcp/server.js` from a checkout. A server that
 *  merely shares the name and runs something else is the person's, and is kept. */
function isOurs(entry: McpEntry | undefined): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const parts = [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])].filter((p): p is string => typeof p === 'string');
  return parts.some((p) => path.basename(p) === LAUNCHER || /(^|\/)out\/main\/mcp\/server\.js$/.test(p));
}

function strip(servers: unknown): boolean {
  if (!servers || typeof servers !== 'object') return false;
  const s = servers as Servers;
  if (!isOurs(s[MCP_SERVER_NAME])) return false;
  delete s[MCP_SERVER_NAME];
  return true;
}

/** One entry the uninstall took out of `~/.claude.json`, kept so a reinstall can put it back. */
export interface McpRemoval { scope: string; entry: McpEntry & Record<string, unknown> }

type ClaudeConfig = { mcpServers?: unknown; projects?: Record<string, { mcpServers?: unknown }> };

/**
 * Read → change → atomic rename of Claude Code's `~/.claude.json`. Claude Code rewrites that file
 * often, so the edit is retried when the file changed in between; an unreadable file is never
 * overwritten. `change` returns whether it changed anything; a missing file is left missing.
 */
function editClaudeConfig<T>(home: string, change: (config: ClaudeConfig) => { changed: boolean; result: T }, missing: T): { file: string; result: T } {
  const file = path.join(home, '.claude.json');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let text: string;
    let before: fs.Stats;
    try {
      before = fs.statSync(file);
      text = fs.readFileSync(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { file, result: missing };
      throw new Error(`cannot read ${file}: ${(error as Error).message}`);
    }
    let config: ClaudeConfig;
    try {
      config = JSON.parse(text);
    } catch (error) {
      throw new Error(`cannot read ${file}: ${(error as Error).message}`);
    }
    const { changed, result } = change(config);
    if (!changed) return { file, result };
    const now = fs.statSync(file);
    if (now.mtimeMs !== before.mtimeMs || now.size !== before.size) continue; // written meanwhile: read again
    // A dotfiles setup may keep ~/.claude.json as a symlink: the rename lands on its target, so the
    // link stays a link (audit 2026-10-07).
    let target = file;
    try { target = fs.realpathSync(file); } catch { /* read a moment ago; the write below reports a failure */ }
    atomicWrite(target, `${JSON.stringify(config, null, 2)}\n`, before.mode & 0o777);
    return { file, result };
  }
  throw new Error(`${file} kept changing; nothing was changed`);
}

function scopes(config: ClaudeConfig): { scope: string; servers: Servers | undefined }[] {
  const servers = (x: unknown) => (x && typeof x === 'object' ? (x as Servers) : undefined);
  return [
    { scope: 'user', servers: servers(config.mcpServers) },
    ...Object.entries(config.projects ?? {}).map(([project, p]) => ({ scope: `projects.${project}`, servers: servers(p?.mcpServers) })),
  ];
}

/**
 * Remove the Fabric Dashboards MCP server from Claude Code's `~/.claude.json`, at user scope and in
 * every project scope. Returns the scopes and the entries removed, so a reinstall can restore them.
 */
export function removeMcpRegistrations(home = os.homedir()): { file: string; removed: string[]; entries: McpRemoval[] } {
  const { file, result } = editClaudeConfig(home, (config) => {
    const entries: McpRemoval[] = [];
    for (const { scope, servers } of scopes(config)) {
      if (!servers || !isOurs(servers[MCP_SERVER_NAME])) continue;
      entries.push({ scope, entry: structuredClone(servers[MCP_SERVER_NAME]) as McpRemoval['entry'] });
      delete servers[MCP_SERVER_NAME];
    }
    return { changed: entries.length > 0, result: entries };
  }, [] as McpRemoval[]);
  return { file, removed: result.map((e) => e.scope), entries: result };
}

/**
 * Put back the entries an uninstall removed, pointed at this install's launcher. A scope that has a
 * `fabric-dashboards` entry again (the person added one) keeps it; a project scope that no longer
 * exists is skipped. Returns the scopes restored.
 */
export function restoreMcpRegistrations(entries: McpRemoval[], launcher: string, home = os.homedir()): string[] {
  if (!entries.length) return [];
  return editClaudeConfig(home, (config) => {
    const restored: string[] = [];
    for (const { scope, entry } of entries) {
      let holder: { mcpServers?: unknown } | undefined;
      if (scope === 'user') holder = config;
      else if (scope.startsWith('projects.')) holder = config.projects?.[scope.slice('projects.'.length)];
      if (!holder) continue;
      if (!holder.mcpServers || typeof holder.mcpServers !== 'object') holder.mcpServers = {};
      const servers = holder.mcpServers as Servers;
      if (servers[MCP_SERVER_NAME]) continue;
      servers[MCP_SERVER_NAME] = { ...entry, command: launcher, args: [] };
      restored.push(scope);
    }
    return { changed: restored.length > 0, result: restored };
  }, [] as string[]).result;
}

/**
 * An entry of ours whose launcher no longer exists — the app was moved, or reinstalled somewhere
 * else after being dragged to the Trash — is pointed at this install's launcher. A development
 * entry (`node …/server.js`) and any other server are left alone. Returns the scopes repaired.
 */
export function repairMcpRegistrations(launcher: string, home = os.homedir(), exists: (p: string) => boolean = fs.existsSync): string[] {
  return editClaudeConfig(home, (config) => {
    const repaired: string[] = [];
    for (const { scope, servers } of scopes(config)) {
      const entry = servers?.[MCP_SERVER_NAME];
      if (!entry || typeof entry.command !== 'string' || path.basename(entry.command) !== LAUNCHER) continue;
      if (entry.command === launcher || exists(entry.command)) continue;
      entry.command = launcher;
      repaired.push(scope);
    }
    return { changed: repaired.length > 0, result: repaired };
  }, [] as string[]).result;
}

// #region restore-record — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#decision
/** What an uninstall that kept the data writes beside it, for the next install to put back. */
export const RESTORE_FILE = 'restore.json';
/** The person's choices and history: kept by an uninstall unless the person asks to delete them. */
export const KEPT_FILES = ['settings.json', 'settings.json.bak', 'activity.jsonl', 'activity-state.json', 'notified.json', RESTORE_FILE, AUTO_UPDATE_FILE] as const;
/** LC-16: what even «delete my settings» keeps — the automatic-update switch is never written by an uninstall. */
export const ALWAYS_KEPT = [AUTO_UPDATE_FILE] as const;

export interface RestoreRecord { version: 1; at: string; loginItem: boolean; mcp: McpRemoval[] }

export function writeRestoreRecord(dir: string, record: Omit<RestoreRecord, 'version'>): void {
  atomicWrite(path.join(dir, RESTORE_FILE), JSON.stringify({ version: 1, ...record }, null, 2));
}

/** The record an uninstall left, or null: absent, unreadable or of another shape. */
export function readRestoreRecord(dir: string): RestoreRecord | null {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dir, RESTORE_FILE), 'utf8'));
  } catch {
    return null;
  }
  const r = raw as Partial<RestoreRecord> | null;
  if (!r || r.version !== 1 || typeof r.loginItem !== 'boolean' || !Array.isArray(r.mcp)) return null;
  const mcp = r.mcp.filter((m): m is McpRemoval => Boolean(m) && typeof m.scope === 'string' && Boolean(m.entry) && typeof m.entry === 'object');
  return { version: 1, at: String(r.at ?? ''), loginItem: r.loginItem, mcp };
}

export function clearRestoreRecord(dir: string): void {
  fs.rmSync(path.join(dir, RESTORE_FILE), { force: true });
}
// #endregion restore-record

/** Every directory the app writes under `home` (Electron's userData, caches, logs, the updater's
 *  cache, the network store, saved window state). */
export function productDataPaths(home = os.homedir()): string[] {
  const lib = path.join(home, 'Library');
  return [
    path.join(lib, 'Application Support', PRODUCT),
    path.join(lib, 'Logs', PRODUCT),
    path.join(lib, 'Caches', BUNDLE_ID),
    path.join(lib, 'Caches', `${BUNDLE_ID}.ShipIt`),
    path.join(lib, 'HTTPStorages', BUNDLE_ID),
    path.join(lib, 'Saved Application State', `${BUNDLE_ID}.savedState`),
    path.join(lib, 'Preferences', `${BUNDLE_ID}.plist`),
  ];
}

/** A path purge may remove: at least ~/Library/<dir>/<name> deep. Never a home, a root or a bare
 *  Library directory. A test profile outside ~/Library is therefore never purged by the app. */
export function isProductPath(p: string): boolean {
  const resolved = path.resolve(p);
  const parts = resolved.split(path.sep).filter(Boolean);
  const lib = parts.lastIndexOf('Library');
  return lib >= 0 && parts.length - lib >= 3;
}

/** Remove the given product paths. Refuses anything isProductPath does not accept. */
export function purgeData(paths: string[]): string[] {
  const removed: string[] = [];
  for (const p of paths) {
    const resolved = path.resolve(p);
    if (!isProductPath(resolved)) throw new Error(`purge refuses ${resolved}: not a product path inside ~/Library`);
    if (!fs.existsSync(resolved)) continue;
    fs.rmSync(resolved, { recursive: true, force: true });
    removed.push(resolved);
  }
  return removed;
}
/**
 * Remove product data once process `pid` has exited — the app's own data cannot be deleted while
 * Chromium still writes into it. A detached `/bin/sh` waits for the pid (at most 30 s), removes the
 * paths isProductPath accepts and ends: the one process that deliberately outlives the app, bounded.
 * An app still running after 30 s keeps its data: nothing is removed from under a live process
 * (audit 2026-10-07); a later uninstall or the person removes it.
 * With `keep`, everything inside `keep.dir` except the named files goes too — the uninstall that
 * keeps the person's settings and history (LC-14: data goes only when the person asks).
 */
export function purgeAfterExit(pid: number, paths: string[], keep?: { dir: string; names: readonly string[] }, waitMs = 30_000): ChildProcess | null {
  const checked = paths.filter((p) => isProductPath(p)).map((p) => path.resolve(p));
  const keepDir = keep && isProductPath(keep.dir) ? path.resolve(keep.dir) : '';
  if (!checked.length && !keepDir) return null;
  const names = keep?.names ?? [];
  if (names.some((n) => !/^[A-Za-z0-9._-]+$/.test(n))) throw new Error('a kept name is a plain file name');
  const kept = names.length ? names.join('|') : '/';
  const ticks = Math.max(1, Math.round(waitMs / 100));
  const script = 'i=0; while kill -0 "$0" 2>/dev/null && [ $i -lt ' + ticks + ' ]; do sleep 0.1; i=$((i+1)); done; kill -0 "$0" 2>/dev/null && exit 0; k="$1"; shift; rm -rf -- "$@"; '
    + `if [ -n "$k" ] && [ -d "$k" ]; then for f in "$k"/* "$k"/.[!.]* "$k"/..?*; do [ -e "$f" ] || [ -L "$f" ] || continue; case "\${f##*/}" in ${kept}) ;; *) rm -rf -- "$f" ;; esac; done; fi`;
  const helper = spawn('/bin/sh', ['-c', script, String(pid), keepDir, ...checked], { detached: true, stdio: 'ignore' });
  helper.unref();
  return helper;
}
// #endregion uninstall
