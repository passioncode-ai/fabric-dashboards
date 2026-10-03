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

/**
 * Remove the Fabric Dashboards MCP server from Claude Code's `~/.claude.json`, at user scope and in
 * every project scope. Claude Code rewrites that file often, so the edit is read → change →
 * atomic rename, retried when the file changed in between; an unreadable file is never overwritten.
 */
export function removeMcpRegistrations(home = os.homedir()): { file: string; removed: string[] } {
  const file = path.join(home, '.claude.json');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let text: string;
    let before: fs.Stats;
    try {
      before = fs.statSync(file);
      text = fs.readFileSync(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { file, removed: [] };
      throw new Error(`cannot read ${file}: ${(error as Error).message}`);
    }
    let config: { mcpServers?: unknown; projects?: Record<string, { mcpServers?: unknown }> };
    try {
      config = JSON.parse(text);
    } catch (error) {
      throw new Error(`cannot read ${file}: ${(error as Error).message}`);
    }
    const removed: string[] = [];
    if (strip(config.mcpServers)) removed.push('user');
    for (const [project, scope] of Object.entries(config.projects ?? {})) if (scope && strip(scope.mcpServers)) removed.push(`projects.${project}`);
    if (!removed.length) return { file, removed };
    const now = fs.statSync(file);
    if (now.mtimeMs !== before.mtimeMs || now.size !== before.size) continue; // written meanwhile: read again
    atomicWrite(file, `${JSON.stringify(config, null, 2)}\n`, before.mode & 0o777);
    return { file, removed };
  }
  throw new Error(`${file} kept changing; nothing was removed`);
}

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
 */
export function purgeAfterExit(pid: number, paths: string[]): ChildProcess | null {
  const checked = paths.filter((p) => isProductPath(p)).map((p) => path.resolve(p));
  if (!checked.length) return null;
  const script = 'i=0; while kill -0 "$0" 2>/dev/null && [ $i -lt 300 ]; do sleep 0.1; i=$((i+1)); done; rm -rf -- "$@"';
  const helper = spawn('/bin/sh', ['-c', script, String(pid), ...checked], { detached: true, stdio: 'ignore' });
  helper.unref();
  return helper;
}
// #endregion uninstall
