// #region setup-check — docs: docs/ux/scenarios.md#scn-070-check-what-is-set-up
// FD-65: Check setup runs the PassionCode launcher's read-only `doctor --json` (launcher ADR-0004, its
// docs/reference/cli.md "Setup and doctor") and shows its lines. The launcher is pinned: a check the person
// presses never runs code the app did not name. It is never run with `--fix` and never polled: the person
// presses the button, and the last result is kept until the next press.
export const DOCTOR_PIN = '0.2.2';
export const DOCTOR_TIMEOUT_MS = 120_000;
export const DOCTOR_AREAS = ['prerequisites', 'skills', 'apps', 'mcp', 'services'] as const;

export type DoctorArea = (typeof DOCTOR_AREAS)[number];
export type DoctorState = 'ok' | 'warn' | 'fail' | 'info';
export interface DoctorCheck { id: string; area: DoctorArea; product: string | null; state: DoctorState; detail: string; fix: string | null }
export interface DoctorReport { version: string; at: string; ok: boolean; summary: Record<DoctorState, number>; checks: DoctorCheck[] }

/** What a press of Check setup ended with. */
export type SetupCheckResult =
  | { kind: 'report'; report: DoctorReport; checkedAt: string }
  | { kind: 'no-node' } // npx is not on this computer's PATH: Node 18+ is missing
  | { kind: 'error'; detail: string; checkedAt: string };

/** The command, run with no shell: `npx --yes @passioncode-ai/passioncode@<pin> doctor --json`. */
export function doctorArgv(npx = 'npx'): [string, string[]] {
  return [npx, ['--yes', `@passioncode-ai/passioncode@${DOCTOR_PIN}`, 'doctor', '--json']];
}

const STATES = new Set<DoctorState>(['ok', 'warn', 'fail', 'info']);
const AREAS = new Set<string>(DOCTOR_AREAS);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);

/** The launcher's JSON, read strictly: a check that does not have the documented shape is dropped. */
export function parseDoctor(stdout: string): DoctorReport | null {
  let d: unknown;
  try { d = JSON.parse(stdout); } catch { return null; }
  const x = d as { version?: unknown; at?: unknown; ok?: unknown; checks?: unknown };
  if (!x || typeof x !== 'object' || !Array.isArray(x.checks) || typeof x.ok !== 'boolean') return null;
  const checks: DoctorCheck[] = [];
  for (const c of x.checks.slice(0, 500) as Record<string, unknown>[]) {
    const id = str(c?.id, 200);
    const detail = str(c?.detail, 500);
    if (!id || detail === null || !AREAS.has(String(c.area)) || !STATES.has(c.state as DoctorState)) continue;
    checks.push({ id, area: c.area as DoctorArea, product: str(c.product, 64), state: c.state as DoctorState, detail, fix: str(c.fix, 1000) });
  }
  const summary: Record<DoctorState, number> = { ok: 0, warn: 0, fail: 0, info: 0 };
  for (const c of checks) summary[c.state] += 1;
  return { version: str(x.version, 40) ?? '?', at: str(x.at, 40) ?? '', ok: x.ok, summary, checks };
}

/** Exit 0 (nothing failed) or 1 (a check failed) carry the report; anything else is "the check could not run". */
export function doctorResult(r: { code: number | null; stdout?: string; stderr?: string; started?: boolean; timedOut?: boolean; output: string }, now = new Date()): SetupCheckResult {
  const checkedAt = now.toISOString();
  if (r.started === false && /ENOENT|not found/i.test(r.output)) return { kind: 'no-node' };
  if (r.timedOut) return { kind: 'error', detail: `no answer within ${DOCTOR_TIMEOUT_MS / 1000} s`, checkedAt };
  if (r.code === 0 || r.code === 1) {
    const report = parseDoctor(r.stdout ?? '');
    if (report) return { kind: 'report', report, checkedAt };
  }
  const first = (r.stderr || r.output || '').split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? `exit ${r.code}`;
  return { kind: 'error', detail: first.slice(0, 300), checkedAt };
}

/** The lines a person acts on: failures first, then warnings, in the launcher's order within each. */
export function attention(report: DoctorReport): DoctorCheck[] {
  return [...report.checks.filter((c) => c.state === 'fail'), ...report.checks.filter((c) => c.state === 'warn')];
}

/** The areas to show, those with a failure first, each in the launcher's order. */
export function areasInOrder(lines: DoctorCheck[]): DoctorArea[] {
  const present = DOCTOR_AREAS.filter((a) => lines.some((c) => c.area === a));
  const failing = (a: DoctorArea) => lines.some((c) => c.area === a && c.state === 'fail');
  return [...present.filter(failing), ...present.filter((a) => !failing(a))];
}

/** For the Setup console's brief: what the last check found, so the agent starts from it. */
export function doctorMarkdown(report: DoctorReport): string {
  const lines = attention(report);
  if (!lines.length) return '';
  return [
    '## What the last Check setup found',
    '',
    `The person pressed Check setup in Fabric Dashboards; the launcher's \`doctor\` (${report.version}, ${report.at}) reported ${report.summary.fail} failing and ${report.summary.warn} warning checks. Start with these, failures first; each names its fix. Prove each one with \`npx --yes @passioncode-ai/passioncode@latest doctor --json\` after you fix it.`,
    '',
    ...lines.map((c) => `- **${c.state}** \`${c.id}\` (${c.area}): ${c.detail}${c.fix ? ` — fix: ${c.fix}` : ''}`),
    '',
  ].join('\n');
}
// #endregion setup-check
