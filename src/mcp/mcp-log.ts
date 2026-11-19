// FD-347: what the MCP server did with its session, kept where a person and an agent can read it later. The server's
// stderr goes to the coding agent, and a client that keeps no server output (Claude Code 2.1 keeps none) loses why a
// server left, so a session that reads "disconnected" could not be explained. One line per event (start, hand-over,
// hand-over failed, leaving) is appended to `mcp.log` beside the app's `main.log`, 0600; past MCP_LOG_MAX it moves to
// `mcp.log.1` (one copy kept). Best effort: a write that fails changes nothing for the session. No arguments, names or
// tokens: only versions, process ids and the reason in the server's own words.
// #region mcp-log — docs: AGENTS.md#lifecycle
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { places } from '../core/platform';

export const MCP_LOG_MAX = 512 * 1024;

/** `mcp.log` beside the app's own log. */
export function mcpLogFile(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const logs = places(platform, env, home)?.logs ?? p.join(home, 'Library', 'Logs', 'Fabric Dashboards');
  return p.join(logs, 'mcp.log');
}

/** Append one line, with the time and this process, rotating once the file passes `max`. */
export function appendMcpLog(text: string, file = mcpLogFile(), max = MCP_LOG_MAX, now = new Date(), pid = process.pid, ppid = process.ppid): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    try { if (fs.statSync(file).size >= max) fs.renameSync(file, `${file}.1`); } catch { /* no file yet */ }
    fs.appendFileSync(file, `${now.toISOString()} pid=${pid} ppid=${ppid} ${text.replace(/[\r\n]+/g, ' ')}\n`, { mode: 0o600 });
  } catch { /* best effort */ }
}
// #endregion mcp-log
