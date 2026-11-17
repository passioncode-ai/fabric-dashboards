// #region bug-journal — docs: docs/BUGS.md#the-journal
// FD-263: the app's own bug tracker. Every failure the app notices (an uncaught exception or unhandled rejection in the
// main process, a renderer's error, a crashed process, an action that failed) is one row per fingerprint in a local
// journal: how often, first and last seen, in which versions, with its message and our own stack frames scrubbed of
// paths and secrets. Anonymous analytics carries only the fingerprint (FD-136 never sends a message or a stack); the
// person and agents read the details here (MCP `bugs`), and one can be filed as a GitHub issue.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { Bug, BugInput } from './bug-types';
export type { Bug, BugInput, BugKind, BugWhere } from './bug-types';

export const BUGS_FILE = 'bugs.json';
export const MAX_BUGS = 300;
const MAX_MESSAGE = 500;

/** FD-250: removes what reads as a credential (URL credentials, `token=…`, known key prefixes) and nothing else, for a
 *  service's own log line that the app shows and hands to agents. */
export function redactSecrets(text: string): string {
  return text
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@'"]+@/gi, '$1<credentials>@') // URL credentials
    .replace(/\b(bearer|token|key|secret|password|authorization)(["'\s:=]+)[^\s"',;]{6,}/gi, '$1$2<redacted>')
    .replace(/\b(sk|pk|ghp|gho|github_pat|xox[abp]|cak|fd)[-_][A-Za-z0-9_-]{12,}\b/g, '<redacted>');
}

/** Removes what could name a person, a machine or a secret from a message or a frame. */
export function scrub(text: string, home: string, user: string): string {
  let s = text;
  if (home && home.length > 1) s = s.split(home).join('~');
  s = s.replace(/\/Users\/[^/\s'"]+/g, '/Users/~').replace(/[A-Za-z]:\\Users\\[^\\\s'"]+/g, 'C:\\Users\\~').replace(/\/home\/[^/\s'"]+/g, '/home/~');
  if (user && user.length > 2) s = s.replace(new RegExp(`\\b${user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), '<user>');
  s = redactSecrets(s);
  // FD-294 (7): an address names a person; a domain with a dot is required, so `pkg@1.2.3` and `user@host:repo` stay.
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g, '<email>');
  s = s.replace(/\b[0-9a-f]{32,}\b/gi, '<hex>');
  return s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE)}…` : s;
}

/** Our own frames from a V8 stack: `at fn (…/out/main/core/x.js:12:3)` or `…/src/core/x.ts:12`, as `core/x.js:12 fn`. */
export function ownFrames(stack: string | undefined): string[] {
  if (!stack) return [];
  const out: string[] = [];
  for (const line of stack.split('\n').slice(1)) {
    const m = /^\s*at (?:(.+?) \()?(.+?):(\d+)(?::\d+)?\)?\s*$/.exec(line);
    if (!m) continue;
    const file = m[2]!.replace(/\\/g, '/');
    const own = /\/(?:out\/(?:main|renderer)|src|packages\/service-host\/(?:src|dist))\/(.+)$/.exec(file);
    if (!own || /node_modules/.test(file)) continue;
    out.push(`${own[1]}:${m[3]}${m[1] ? ` ${m[1].replace(/^async /, '')}` : ''}`);
    if (out.length >= 8) break;
  }
  return out;
}

/** The fingerprint: stable across versions and machines (function names, not line numbers or paths). */
export function fingerprint(b: Pick<BugInput, 'where' | 'kind' | 'name' | 'action' | 'message'>, frames: readonly string[]): string {
  // Wave 1 (C-08): the window's frames are minified names that change with every build, so a page error is known by
  // its message instead (numbers and quoted values stripped), and keeps one row across releases.
  const fns = b.where === 'renderer'
    ? (b.message ?? '').split('\n')[0]!.replace(/(["'`]).*?\1/g, '_').replace(/\d+/g, '#').slice(0, 120)
    : frames.slice(0, 4).map((f) => f.split(' ')[1] ?? f.split(':')[0]).join('>');
  return crypto.createHash('sha256').update([b.where, b.kind, b.name, b.action ?? '', fns].join('|')).digest('hex').slice(0, 12);
}

/** One failure added to the journal (a new row, or the count of its row raised). Pure. */
export function record(bugs: readonly Bug[], input: BugInput, o: { now: string; version: string; home: string; user: string }): { bugs: Bug[]; bug: Bug; isNew: boolean } {
  const name = scrub(input.name || 'Error', o.home, o.user).slice(0, 80);
  const frames = ownFrames(input.stack).map((f) => scrub(f, o.home, o.user));
  const message = scrub(input.message ?? '', o.home, o.user);
  const fp = fingerprint({ ...input, name, message }, frames);
  const at = bugs.findIndex((b) => b.fp === fp);
  if (at >= 0) {
    const was = bugs[at]!;
    const bug: Bug = { ...was, count: was.count + 1, lastSeen: o.now, message: message || was.message, frames: frames.length ? frames : was.frames, versions: was.versions.includes(o.version) ? was.versions : [...was.versions, o.version].slice(-10) };
    const next = [...bugs]; next[at] = bug;
    return { bugs: next, bug, isNew: false };
  }
  const bug: Bug = { fp, where: input.where, kind: input.kind, name, ...(input.action ? { action: input.action } : {}), message, frames, count: 1, firstSeen: o.now, lastSeen: o.now, versions: [o.version] };
  // The oldest seen goes first when the journal is full.
  const kept = [...bugs, bug].sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1)).slice(0, MAX_BUGS);
  return { bugs: kept, bug, isNew: true };
}

export function readBugs(dir: string): Bug[] {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, BUGS_FILE), 'utf8')) as { bugs?: unknown };
    return Array.isArray(v.bugs) ? (v.bugs as Bug[]).filter((b) => b && typeof b.fp === 'string' && typeof b.count === 'number') : [];
  } catch {
    return [];
  }
}

export function writeBugs(dir: string, bugs: readonly Bug[]): void {
  const file = path.join(dir, BUGS_FILE);
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify({ schema: 'fabric-dashboards-bugs/1', bugs }, null, 1)}\n`, { mode: 0o600 });
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true }); // Wave 1 (P-07): a failed write leaves no temporary file behind
  }
}

/** Wave 1 (C-08): a refusal the machine's room decides (LC-17) is the app working as designed, counted in analytics
 *  but never a bug. */
export function expectedFailure(code: string): boolean {
  return code.startsWith('admission_') || code === 'held';
}

/** A GitHub issue's title and body for one bug: what an engineer needs, nothing that names the person. */
export function issueOf(b: Bug): { title: string; body: string; label: string } {
  const title = `Bug ${b.fp}: ${b.where} ${b.kind} ${b.name}${b.action ? ` (${b.action})` : ''}`.slice(0, 120);
  const body = [
    `Filed from Fabric Dashboards' bug journal (FD-263).`, '',
    `- Fingerprint: \`${b.fp}\``, `- Where: ${b.where}, ${b.kind}${b.action ? `, action ${b.action}` : ''}`,
    `- Seen ${b.count} time(s), first ${b.firstSeen}, last ${b.lastSeen}`, `- Versions: ${b.versions.join(', ')}`, '',
    '**Message (scrubbed)**', '', '```', b.message || '(none)', '```', '',
    '**Our frames**', '', '```', ...(b.frames.length ? b.frames : ['(none)']), '```',
  ].join('\n');
  return { title, body, label: `bug:${b.fp}` };
}
/** GitHub's new-issue page for one bug, filled in; the body is cut to keep the address under GitHub's limit. */
export const BUG_REPOSITORY = 'passioncode-ai/fabric-dashboards';
export function newIssueUrl(b: Bug): string {
  const { title, body } = issueOf(b);
  return `https://github.com/${BUG_REPOSITORY}/issues/new?${new URLSearchParams({ title, body: body.slice(0, 5000) }).toString()}`;
}
// #endregion bug-journal
