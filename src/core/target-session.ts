// #region target-session — docs: docs/ux/scenarios.md#scn-101-start-a-new-session-in-a-folder
// FD-206: a session of its own started on another machine. Switchboard knows the machines (`switchboard --json
// targets`) and starts the session there (`switchboard launch --target`, SB-332), so its account comes from the
// folder's group on that machine. The folder is that machine's; the person picks it from the projects it has.
import { shellQuote } from './consoles';
import { MACHINE } from './platform';
import type { Runner } from '@passioncode-ai/fabric-service-host';

export { MACHINE };

export const HOME_MARK = 'fabric-home:';
export const FOLDER_MARK = 'fabric-folder:';
export const FOLDERS_END = 'fabric-folders-end';

/** The machines Switchboard can start a session on, newest first; none when it does not answer or has none. With
 *  `withAliases`, also the other names ssh knows each by (`aliases`, Switchboard 0.7.60, SB-340). */
export async function targetsOf(run: Runner, sb: string): Promise<string[]>;
export async function targetsOf(run: Runner, sb: string, o: { withAliases: true }): Promise<{ machines: string[]; aliases: string[] }>;
export async function targetsOf(run: Runner, sb: string, o?: { withAliases: true }): Promise<string[] | { machines: string[]; aliases: string[] }> {
  const machines: string[] = [];
  const aliases: string[] = [];
  const done = () => (o?.withAliases ? { machines, aliases } : machines);
  const r = await run(sb, ['--json', 'targets'], 10_000);
  if (r.code !== 0) return done();
  let data: unknown;
  try { data = JSON.parse(r.stdout); } catch { return done(); }
  const list = (data as { data?: { targets?: unknown } })?.data?.targets;
  if (!Array.isArray(list)) return done();
  for (const t of list) {
    const m = (t as { machine?: unknown })?.machine;
    if (typeof m !== 'string' || !MACHINE.test(m) || machines.includes(m)) continue;
    machines.push(m);
    const al = (t as { aliases?: unknown })?.aliases;
    if (Array.isArray(al)) for (const a of al) if (typeof a === 'string' && MACHINE.test(a) && !aliases.includes(a) && a !== m) aliases.push(a);
    if (machines.length >= 20) break;
  }
  return done();
}

/** Asks the machine for its home and the projects under its `~/DATA`, with no prompt and a bounded connect. */
export function projectsProbeArgv(machine: string, ssh = '/usr/bin/ssh'): string[] {
  const script = `printf '${HOME_MARK}%s\\n' "$HOME"; for d in "$HOME"/DATA/*/; do if [ -d "$d" ]; then printf '${FOLDER_MARK}%s\\n' "\${d%/}"; fi; done; echo ${FOLDERS_END}`;
  return [ssh, '-T', '-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', machine, `/bin/sh -c ${shellQuote(script)}`];
}

/** The probe's answer: the home and its projects by name, service folders last (at most 500), or null when it did not answer. */
export function projectsOf(r: { code: number | null; stdout: string }): { home: string; folders: string[] } | null {
  const lines = r.stdout.split('\n').map((l) => l.trim());
  if (r.code !== 0 || !lines.includes(FOLDERS_END)) return null;
  const home = lines.find((l) => l.startsWith(HOME_MARK))?.slice(HOME_MARK.length) ?? '';
  if (!home.startsWith('/')) return null;
  const folders = lines.filter((l) => l.startsWith(FOLDER_MARK)).map((l) => l.slice(FOLDER_MARK.length)).filter((f) => f.startsWith(`${home}/`) && !f.includes('\u0000'));
  // Service folders (`_worktrees`, `.cache`) go after the projects.
  const aside = (f: string) => /^[._]/.test(f.slice(f.lastIndexOf('/') + 1));
  return { home, folders: [...new Set(folders)].sort((a, b) => Number(aside(a)) - Number(aside(b)) || a.localeCompare(b)).slice(0, 500) };
}

/** The console's command: that machine's Switchboard starts the coding agent there, in this terminal over ssh. */
export function targetLaunchArgv(o: { sb: string; machine: string; provider: 'claude' | 'codex'; isolated: boolean; folder: string; args: string[]; surface: boolean }): string[] {
  return [o.sb, 'launch', '--target', o.machine, '--provider', o.provider, '--mode', o.isolated ? 'isolated' : 'managed', '--working-directory', o.folder, '--in-place',
    ...(o.surface ? ['--surface', 'dashboards'] : []), ...(o.args.length ? ['--', ...o.args] : [])];
}
// #endregion target-session
