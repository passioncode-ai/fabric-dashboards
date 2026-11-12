// #region usage-analytics — docs: docs/ANALYTICS.md#what-is-sent
// FD-136: anonymous usage and error data, the PassionCode way (Fabric's `apps/desktop/src/main/analytics.ts`,
// Fabric Inbox's B-200): on by default, told once in a notice, turned off in Settings for this product alone
// (the operator, 2026-11-04). Counts and kinds only, never a name, a path, an address, a key or what an agent
// said. Events go to the organization's self-hosted Aptabase in batches of at most 25, and only from a build that
// carries an App Key: the release workflow writes `analytics.json` into the app's resources; source builds,
// tests and forks carry none, so they send nothing.
//
// - **One installation id for every PassionCode app** on the machine, in the shared `installation.json`, created
//   once by whichever app starts first (a temporary file hard-linked into place) and never repaired. Its
//   `analytics` field no longer turns this app off (B-200): the switch is this product's own setting.
// - **Off is off:** nothing is queued or sent, and what waits is dropped.
// - **Delivery never blocks the app:** transport errors, 429 and 5xx keep the batch and retry after 60 s, then
//   10 min; 400 and 404 drop it. At most 200 events wait, in memory only; an event older than 23 h is dropped.
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomInt, randomUUID } from 'node:crypto';
import path from 'node:path';

export const SDK_VERSION = 'fabric-dashboards-analytics@1';
export const BATCH_MAX = 25;
export const QUEUE_MAX = 200;
export const EVENT_MAX_AGE_MS = 23 * 3600_000;
export const RETRY_DELAYS_MS = [60_000, 600_000] as const;
export const BUNDLE_FILE = 'analytics.json';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const APP_KEY = /^A-[A-Z]{2,4}-\d{10}$/;

/** The App Key and host a release build carries (`analytics.json`, written by the release workflow), or null. */
export interface Bundle { appKey: string; host: string; debug: boolean }
export function readBundle(text: string): Bundle | null {
  try {
    const v = JSON.parse(text) as { appKey?: unknown; host?: unknown; debug?: unknown };
    const url = new URL(String(v.host));
    const host = url.protocol === 'https:' && url.href === `${url.origin}/` && !url.username && !url.password ? url.origin : null;
    if (host && typeof v.appKey === 'string' && APP_KEY.test(v.appKey)) return { appKey: v.appKey, host, debug: v.debug === true };
  } catch { /* no key: nothing is sent */ }
  return null;
}

/** Where every PassionCode app keeps the shared installation file. */
export function installationPath(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string): string {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'PassionCode', 'installation.json');
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'PassionCode', 'installation.json');
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'PassionCode', 'installation.json');
}

interface Installation { version: 1; id: string; created_at: number; [field: string]: unknown }
const parseInstallation = (text: string): Installation | null => {
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    return o && typeof o === 'object' && !Array.isArray(o) && o.version === 1 && typeof o.id === 'string' && UUID_V4.test(o.id) ? o as Installation : null;
  } catch { return null; }
};

/** Read the shared file, or create it once. Never overwrites a file another app made; never repairs one. */
export function readOrCreateInstallation(file: string, now: () => Date): { id: string; createdNow: boolean } | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string | null = null;
    try { text = readFileSync(file, 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return null; }
    if (text !== null) { const p = parseInstallation(text); return p ? { id: p.id, createdNow: false } : null; }
    const fresh = { version: 1, id: randomUUID(), analytics: true, created_at: Math.floor(now().getTime() / 1000) };
    try {
      mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      writeFileSync(tmp, JSON.stringify(fresh) + '\n', { mode: 0o600 });
      try { linkSync(tmp, file); return { id: fresh.id, createdNow: true }; }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') return null; /* another app made it this instant: read theirs */ }
      finally { rmSync(tmp, { force: true }); }
    } catch { return null; }
  }
  return null;
}

/** Counts and the kinds below only: a free string could carry a name, so anything else is dropped. */
export type Props = Record<string, number | boolean | string>;
export const KNOWN_KINDS: ReadonlySet<string> = new Set(['ordinary', 'login', 'link', 'background', 'start', 'stop', 'restart', 'doctor', 'update', 'self_update', 'console', 'rename', 'main', 'renderer', 'gpu', 'utility', 'zygote', 'unknown',
  // FD-191: `session_started`'s kind and coding agent (any agent but the two is `other`).
  'session', 'agent', 'claude-code', 'codex', 'other',
  // `session_started`'s `surface` and `actor` (the analytics agent's review, board message `2d48d83f`, rules 2 and 11).
  'dialog', 'mcp', 'human']);
const CODE = /^[A-Za-z0-9_.-]{1,60}$/;
export function cleanProps(props: Record<string, unknown>): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && (KNOWN_KINDS.has(v) || (k === 'code' && CODE.test(v)) || (k === 'from' && /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(v)))) out[k] = v;
  }
  return out;
}

/** growth counts by `props.environment`; Aptabase's dataset follows it (`isDebug` exactly when not production). */
export function environmentFor(version: string, packaged: boolean, debug: boolean): 'production' | 'sandbox' {
  return packaged && !debug && !/^\d+\.\d+\.\d+-/.test(version) ? 'production' : 'sandbox';
}

export interface AnalyticsState { installedAt?: string; lastActiveDay?: string; version?: string }
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ status: number }>;

export interface AnalyticsDeps {
  bundle: Bundle | null;
  appVersion: string;
  packaged: boolean;
  osName: string;
  osVersion?: string;
  locale?: string;
  engineVersion?: string;
  installationFile: string;
  stateFile: string;
  /** This product's own switch (Settings), read on every event: on by default. */
  enabled: () => boolean;
  fetch: FetchLike;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
  log?: (line: Record<string, unknown>) => void;
}

export type AnalyticsAvailability = 'on' | 'off' | 'unavailable-no-key';

const OS_NAMES: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };
export const osNameOf = (platform: NodeJS.Platform): string => OS_NAMES[platform] ?? String(platform).slice(0, 20);

export function createAnalytics(deps: AnalyticsDeps) {
  const now = deps.now ?? (() => new Date());
  const environment = environmentFor(deps.appVersion, deps.packaged, deps.bundle?.debug ?? false);
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => { const t = setTimeout(fn, ms); t.unref(); return t; });
  const clearTimer = deps.clearTimer ?? ((t: unknown) => clearTimeout(t as NodeJS.Timeout));
  const log = deps.log ?? (() => {});
  const sessionId = `${Math.floor(now().getTime() / 1000)}${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
  // Read lazily: an app with the switch off never creates the shared file.
  let installation: { id: string; createdNow: boolean } | null | undefined;
  const installId = (): string | null => {
    if (installation === undefined) installation = readOrCreateInstallation(deps.installationFile, now);
    return installation?.id ?? null;
  };
  let queue: { body: Record<string, unknown>; at: number }[] = [];
  let retry = 0;
  let timer: unknown = null;
  let flushing = false;
  const errorsSeen = new Set<string>();

  const availability = (): AnalyticsAvailability => (!deps.bundle ? 'unavailable-no-key' : deps.enabled() ? 'on' : 'off');
  const readState = (): AnalyticsState => {
    try { const v = JSON.parse(readFileSync(deps.stateFile, 'utf8')); return v && typeof v === 'object' ? v as AnalyticsState : {}; } catch { return {}; }
  };
  const writeState = (s: AnalyticsState): void => {
    try {
      mkdirSync(path.dirname(deps.stateFile), { recursive: true, mode: 0o700 });
      const tmp = `${deps.stateFile}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(s) + '\n', { mode: 0o600 });
      renameSync(tmp, deps.stateFile);
    } catch { /* the next start tries again; the worst case is a repeated once-only event */ }
  };
  const schedule = (ms: number): void => {
    if (timer) return;
    timer = setTimer(() => { timer = null; void flush(); }, ms);
  };

  function track(eventName: string, props: Record<string, unknown> = {}): boolean {
    if (availability() !== 'on') return false;
    const id = installId();
    const at = now();
    queue.push({
      at: at.getTime(),
      body: {
        timestamp: at.toISOString(), sessionId, eventName,
        systemProps: {
          isDebug: environment !== 'production', osName: deps.osName, osVersion: String(deps.osVersion ?? '').slice(0, 100), locale: String(deps.locale ?? '').slice(0, 10),
          appVersion: String(deps.appVersion).slice(0, 50), appBuildNumber: '', sdkVersion: SDK_VERSION, engineName: 'Electron', engineVersion: String(deps.engineVersion ?? '').slice(0, 30),
        },
        // A shared file that cannot be read: the event goes without an id (counted as anonymous), never with a made-up one.
        props: { ...cleanProps(props), ...(id ? { install_id: id, iid: id } : {}), environment },
      },
    });
    if (queue.length > QUEUE_MAX) queue = queue.slice(queue.length - QUEUE_MAX);
    schedule(0);
    return true;
  }

  async function flush(): Promise<void> {
    if (flushing || !deps.bundle) return;
    if (availability() !== 'on') { queue = []; return; }
    flushing = true;
    try {
      queue = queue.filter((e) => e.at >= now().getTime() - EVENT_MAX_AGE_MS);
      while (queue.length) {
        const batch = queue.slice(0, BATCH_MAX);
        let status = 0;
        try {
          const res = await deps.fetch(`${deps.bundle.host}/api/v0/events`, {
            method: 'POST', headers: { 'App-Key': deps.bundle.appKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(batch.map((e) => e.body)), signal: AbortSignal.timeout(15_000),
          });
          status = res.status;
        } catch { status = 0; }
        if (status >= 200 && status < 300) {
          queue = queue.slice(batch.length); retry = 0;
          log({ event: 'analytics.flush', outcome: 'sent', count: batch.length });
          continue;
        }
        if (status === 0 || status === 429 || status >= 500) {
          const delay = RETRY_DELAYS_MS[Math.min(retry, RETRY_DELAYS_MS.length - 1)]!;
          retry++;
          log({ event: 'analytics.flush', outcome: 'kept', status, count: batch.length, retry_in_ms: delay });
          schedule(delay);
          return;
        }
        queue = queue.slice(batch.length);
        log({ event: 'analytics.flush', outcome: 'dropped', status, count: batch.length });
      }
    } finally { flushing = false; }
  }

  return {
    availability,
    track,
    flush,
    /** Every start: `app_installed` once, `app_updated` when the version changed, then `app_started`. */
    started(launch: 'ordinary' | 'login' | 'link' | 'background', counts: Record<string, number> = {}): void {
      if (availability() !== 'on') return;
      const state = readState();
      const next: AnalyticsState = { ...state };
      if (!state.installedAt) {
        installId();
        if (track('app_installed', { ...counts, first_passioncode_app: installation?.createdNow === true })) next.installedAt = now().toISOString();
      }
      if (state.version && state.version !== deps.appVersion) track('app_updated', { from: state.version });
      next.version = String(deps.appVersion).slice(0, 50);
      track('app_started', { launch, ...counts });
      writeState(next);
    },
    /** Once per UTC day while the app runs, window open or not. */
    activeTick(counts: Record<string, number>): void {
      if (availability() !== 'on') return;
      const day = now().toISOString().slice(0, 10);
      const state = readState();
      if (state.lastActiveDay === day) return;
      if (track('app_active', counts)) writeState({ ...state, lastActiveDay: day });
    },
    /** A crash the app noticed: where and a code only, once per launch for each. */
    error(where: string, code: string): void {
      const w = KNOWN_KINDS.has(where) ? where : 'unknown';
      const c = CODE.test(code) ? code : 'unknown';
      if (errorsSeen.has(`${w}:${c}`)) return;
      errorsSeen.add(`${w}:${c}`);
      track('app_error', { where: w, code: c });
    },
    /** FD-141: an action that did not succeed (not a crash): which one and a code, once per launch for each. */
    failed(action: 'start' | 'stop' | 'restart' | 'doctor' | 'update' | 'self_update' | 'console' | 'rename', code: string): void {
      const c = CODE.test(code) ? code : 'unknown';
      if (errorsSeen.has(`failed:${action}:${c}`)) return;
      errorsSeen.add(`failed:${action}:${c}`);
      track('action_failed', { action, code: c });
    },
    /** FD-191: a session of its own, or a new agent's, started from its dialog: the kind, the coding agent (Claude Code,
     *  Codex, or `other`), and whether it runs without permission prompts and isolated. Never the folder. */
    sessionStarted(o: { kind: 'session' | 'agent'; runtime: string; bypass: boolean; isolated: boolean; surface?: 'dialog' | 'mcp' }): void {
      // Added after 0.8.44, never renamed (docs/ANALYTICS.md): where it was started from, and so who started it.
      const surface = o.surface ?? 'dialog';
      track('session_started', { kind: o.kind, runtime: o.runtime === 'claude-code' || o.runtime === 'codex' ? o.runtime : 'other', bypass: o.bypass, isolated: o.isolated, surface, actor: surface === 'mcp' ? 'agent' : 'human' });
    },
    /** The switch was turned: off drops what waits; on takes effect at the next event. */
    switched(enabled: boolean): void {
      if (!enabled) { queue = []; if (timer) { clearTimer(timer); timer = null; } }
      log({ event: 'analytics.switch', enabled });
    },
    stop(): void { if (timer) { clearTimer(timer); timer = null; } },
    pending: (): number => queue.length,
  };
}
export type Analytics = ReturnType<typeof createAnalytics>;
// #endregion usage-analytics
