// #region switchboard-binding — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
// ADR-0017: which account a console session runs on. Fabric Switchboard owns the answer: a folder
// in one of its projects (or under a managed rule) must run on that project's account, never on the
// ordinary sign-in. Read-only queries only (`project show`, `accounts list`, `launch --help`); the
// session itself is started by Switchboard, in the console once it can launch in place (SB-75),
// otherwise in Terminal. No token ever passes through this app.
import type { Runner } from '@passioncode-ai/fabric-service-host';
import path from 'node:path';
import fs from 'node:fs';
import type { RuntimeSpec } from './runtimes';

export type Binding =
  | { kind: 'none' } // no project or managed rule for this provider: the ordinary sign-in
  | { kind: 'project'; name: string; pool: string }
  | { kind: 'error'; detail: string }; // Switchboard did not answer: never start on a guess

/** The Switchboard CLI in `dirs`, or null when it is not installed. */
export function findSwitchboard(dirs: string[]): string | null {
  for (const d of dirs) {
    const file = path.join(d, 'switchboard');
    try { fs.accessSync(file, fs.constants.X_OK); if (fs.statSync(file).isFile()) return file; } catch { /* next */ }
  }
  return null;
}

function parse(stdout: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(stdout) as { ok?: boolean; data?: unknown };
    return v && v.ok === true && v.data && typeof v.data === 'object' ? (v.data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** What Switchboard binds `folder` to for `provider`. A runtime Switchboard holds no account for is never bound. */
export async function bindingFor(run: Runner, sb: string, folder: string, provider: RuntimeSpec['provider']): Promise<Binding> {
  if (!provider) return { kind: 'none' };
  const r = await run(sb, ['--json', 'project', 'show', '--path', folder], 10_000);
  const data = r.code === 0 ? parse(r.stdout) : null;
  if (!data) return { kind: 'error', detail: (r.stderr || r.stdout).trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}` };
  const project = data.project as { name?: unknown; pool?: unknown } | null;
  if (project && typeof project.name === 'string' && typeof project.pool === 'string') return { kind: 'project', name: project.name, pool: project.pool };
  // A folder rule whose effective target is a managed session also routes through Switchboard.
  const rules = Array.isArray(data.rules) ? (data.rules as { provider?: string; effective?: { target?: string; enabled?: boolean } | null }[]) : [];
  const rule = rules.find((x) => x.provider === provider)?.effective;
  if (rule && rule.target === 'managed' && rule.enabled !== false) return { kind: 'project', name: path.basename(folder), pool: 'default' };
  return { kind: 'none' };
}

/** Whether this Switchboard can run a prepared session in the caller's terminal (SB-75). */
export async function canLaunchInPlace(run: Runner, sb: string): Promise<boolean> {
  const r = await run(sb, ['launch', '--help'], 10_000);
  const text = `${r.stdout}\n${r.stderr}`;
  return r.code === 0 && /--in-place\b/.test(text) && /--provider\b/.test(text);
}

/** The command the console runs for a bound folder once Switchboard launches in place. */
export function inPlaceArgv(sb: string, provider: 'claude' | 'codex', folder: string, runtimeArgs: string[]): string[] {
  return [sb, 'launch', '--provider', provider, '--mode', 'managed', '--working-directory', folder, '--in-place', ...(runtimeArgs.length ? ['--', ...runtimeArgs] : [])];
}

/** Until SB-75: the account Switchboard selects in the pool, for its existing Terminal launch. */
export async function terminalLaunchArgv(run: Runner, sb: string, provider: 'claude' | 'codex', pool: string, folder: string): Promise<{ argv: string[] } | { error: string }> {
  const r = await run(sb, ['--json', 'accounts', 'list'], 10_000);
  const data = r.code === 0 ? parse(r.stdout) : null;
  const account = (data?.routes as Record<string, unknown> | undefined)?.[`${provider}:${pool}`];
  if (typeof account !== 'string' || !/^[0-9a-f-]{8,64}$/i.test(account)) {
    return { error: data ? `Switchboard selects no ${provider} account in pool ${pool}` : ((r.stderr || r.stdout).trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}`) };
  }
  return { argv: [sb, 'launch', account, '--mode', 'managed', '--working-directory', folder] };
}
// #endregion switchboard-binding
