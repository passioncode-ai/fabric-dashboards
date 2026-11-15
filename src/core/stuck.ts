// FD-275 (Switchboard's session duty officer, board 98cc49a8, case `stuck`): a Claude Code console busy with no write to
// its transcript for 45 minutes is stuck. Its spinner keeps the console's output alive, so LC-18's idle close (no input or
// output for 30 minutes) never sees it. It is closed and saved like an idle one, and opening it continues the
// conversation; it is never restarted in front of nobody. A console whose transcript cannot be found is left alone.
// #region stuck-console — docs: docs/ux/scenarios.md#scn-066-an-idle-session-closes-and-comes-back
import fs from 'node:fs';
import path from 'node:path';

/** The duty officer's threshold for `stuck`. */
export const STUCK_MS = 45 * 60_000;

/** Every Claude Code config folder a console's session may write in: the ordinary one and each Switchboard home. */
export function claudeConfigDirs(home: string, platform: NodeJS.Platform = process.platform): string[] {
  const homes = platform === 'darwin' ? path.join(home, 'Library', 'Application Support', 'ai.passioncode.fabric-switchboard', 'homes')
    : platform === 'linux' ? path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'ai.passioncode.fabric-switchboard', 'homes') : null;
  let accounts: string[] = [];
  if (homes) { try { accounts = fs.readdirSync(homes); } catch { accounts = []; } }
  return [path.join(home, '.claude'), ...(homes ? accounts.map((a) => path.join(homes, a)) : [])];
}

/** The newest write to a transcript of `folder`'s Claude Code sessions in any of `dirs`; null when there is none. */
export function lastTranscriptWrite(folder: string, dirs: readonly string[]): number | null {
  const slug = folder.replace(/[^A-Za-z0-9]/g, '-');
  let newest: number | null = null;
  for (const d of dirs) {
    const dir = path.join(d, 'projects', slug);
    let names: string[] = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith('.jsonl')) continue;
      try { const at = fs.statSync(path.join(dir, n)).mtimeMs; if (newest === null || at > newest) newest = at; } catch { /* gone meanwhile */ }
    }
  }
  return newest;
}

export interface RunningConsole { key: string; runtime: string | null; cwd: string; startedAt: number | null }

/** The consoles stuck now: Claude Code, running for the threshold, and its folder's transcript written last before it. */
export function stuckKeys(running: readonly RunningConsole[], lastWrite: (cwd: string) => number | null, now: number, stuckMs = STUCK_MS): string[] {
  return running.filter((c) => {
    if (c.runtime !== 'claude-code' || !c.cwd || c.startedAt === null || now - c.startedAt < stuckMs) return false;
    const wrote = lastWrite(c.cwd);
    return wrote !== null && now - wrote >= stuckMs;
  }).map((c) => c.key);
}
// #endregion stuck-console
