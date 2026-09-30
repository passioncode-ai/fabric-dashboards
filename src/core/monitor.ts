// The monitor: descriptors in, service snapshots, activity and notifications out.
// It reads the services directory, probes every service, controls them through
// launchd only, and never starts a service process itself (ADR-0002).
import { EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { ActivityStore } from './activity';
import { claimConflicts, deriveState, expand, fetchWellKnown, readDirectory, type DescriptorEntry, type WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { tail } from './fsutil';
import { duration, t as tr, type Lang } from './i18n';
import { Launchd } from './launchd';
import { DOWN_NOTIFY_AFTER_MS, shouldNotify, type Happening } from './notify';
import { fetchEvents, readToken } from './probe';
import type { Busy, Reason, ServiceSnapshot, Settings } from './types';

export const CONTROL_TIMEOUT_MS = 40_000;
export const COMMAND_TIMEOUT_MS = 120_000;

export interface Notice { serviceKey: string; title: string; body: string; link?: string; target: 'service' | 'activity' }

export interface MonitorOptions {
  servicesDir: string;
  activity: ActivityStore;
  settings: () => Settings;
  lang: () => Lang;
  launchd?: Launchd;
  now?: () => number;
  intervals?: { rescan: number; visible: number; background: number; events: number; maxBackoff: number };
}

interface Tracked {
  entry: DescriptorEntry;
  probe: WellKnownResult | null;
  launchd: ServiceSnapshot['launchd'];
  firstUnansweredAt: number | null;
  lastAnswerAt: number | null;
  nextProbeAt: number;
  backoff: number;
  busy: Busy;
  lastAction: ServiceSnapshot['lastAction'];
  feedError: Reason | null;
  downNotified: boolean;
  lastState: ServiceSnapshot['state'] | null;
  lastPid: number | null;
  baselined: boolean; // first events poll records history without notifying
}

const DEFAULT_INTERVALS = { rescan: 5_000, visible: 5_000, background: 30_000, events: 15_000, maxBackoff: 60_000 };

export class Monitor extends EventEmitter {
  private readonly tracked = new Map<string, Tracked>();
  private readonly launchd: Launchd;
  private readonly now: () => number;
  private readonly intervals: typeof DEFAULT_INTERVALS;
  private visible = true;
  private watcher: fs.FSWatcher | null = null;
  private timers: NodeJS.Timeout[] = [];
  private scanning = true;
  private dirError: string | null = null;
  private ticking = false;
  private polling = false;
  private changeTimer: NodeJS.Timeout | null = null;

  constructor(private readonly o: MonitorOptions) {
    super();
    this.launchd = o.launchd ?? new Launchd();
    this.now = o.now ?? Date.now;
    this.intervals = { ...DEFAULT_INTERVALS, ...(o.intervals ?? {}) };
  }

  // --- lifecycle -----------------------------------------------------------------
  start(): void {
    void this.tick();
    this.timers.push(setInterval(() => void this.tick(), Math.min(this.intervals.rescan, this.intervals.visible, 1000)));
    this.timers.push(setInterval(() => void this.pollEvents(), this.intervals.events));
    this.watch();
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    this.watcher?.close();
    this.watcher = null;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) for (const t of this.tracked.values()) t.nextProbeAt = Math.min(t.nextProbeAt, this.now());
  }

  private watch(): void {
    try {
      fs.mkdirSync(this.o.servicesDir, { recursive: true, mode: 0o700 });
      this.watcher = fs.watch(this.o.servicesDir, { persistent: false }, () => void this.tick(true));
      this.watcher.on('error', () => { this.watcher?.close(); this.watcher = null; });
    } catch {
      this.watcher = null; // the periodic rescan still covers it
    }
  }

  private changed(): void {
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => { this.changeTimer = null; this.emit('change'); }, 50);
  }

  // --- reading and probing -------------------------------------------------------------
  private lastRescan = 0;

  async tick(forceRescan = false): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = this.now();
      if (forceRescan || now - this.lastRescan >= this.intervals.rescan) {
        this.lastRescan = now;
        this.rescan();
      }
      const due = [...this.tracked.values()].filter((t) => t.nextProbeAt <= now && !t.busy);
      if (due.length) {
        const table = due.some((t) => t.entry.descriptor?.lifecycle.manager === 'launchd') ? await this.launchd.disabledTable() : '';
        await Promise.all(due.map((t) => this.probe(t, table)));
      }
      this.checkNotifications();
    } finally {
      this.ticking = false;
      this.scanning = false;
      this.changed();
    }
  }

  private rescan(): void {
    let entries: DescriptorEntry[];
    try {
      entries = readDirectory(this.o.servicesDir);
      this.dirError = null;
    } catch (error) {
      this.dirError = (error as Error).message;
      return;
    }
    const seen = new Set(entries.map((e) => e.key));
    for (const [key, t] of this.tracked) {
      if (!seen.has(key)) {
        this.tracked.delete(key);
        this.appEvent(key, t, 'service.removed', 'info', 'app.event.removed');
      }
    }
    for (const entry of entries) {
      const existing = this.tracked.get(entry.key);
      if (existing) {
        const before = JSON.stringify(existing.entry);
        existing.entry = entry;
        if (JSON.stringify(entry) !== before) existing.nextProbeAt = this.now();
        continue;
      }
      const t: Tracked = {
        entry, probe: null, launchd: { managed: entry.descriptor?.lifecycle.manager === 'launchd', loaded: false, pid: null, disabled: false },
        firstUnansweredAt: null, lastAnswerAt: null, nextProbeAt: this.now(), backoff: 0, busy: null, lastAction: null,
        feedError: null, downNotified: false, lastState: null, lastPid: null, baselined: false,
      };
      this.tracked.set(entry.key, t);
      if (!this.scanning) this.appEvent(entry.key, t, 'service.installed', 'info', 'app.event.installed');
    }
  }

  private conflicts(): Map<string, { port?: number; with: string[] }> {
    return claimConflicts([...this.tracked.values()].map((t) => t.entry));
  }

  private async probe(t: Tracked, disabledTable: string): Promise<void> {
    const d = t.entry.descriptor;
    const conflict = this.conflicts().get(t.entry.key);
    if (!d || conflict) {
      t.probe = null;
      t.nextProbeAt = this.now() + this.intervals.background;
      this.observe(t);
      return;
    }
    if (d.lifecycle.manager === 'launchd' && d.lifecycle.label) {
      const s = await this.launchd.status(d.lifecycle.label, disabledTable);
      t.launchd = { managed: true, ...s };
    } else {
      t.launchd = { managed: false, loaded: false, pid: null, disabled: false };
    }
    const answeredBefore = t.probe?.kind === 'answer';
    t.probe = await fetchWellKnown(d.origin);
    const now = this.now();
    // A service that starts answering is read at once, not at the next 15-second poll.
    if (t.probe.kind === 'answer' && !answeredBefore) queueMicrotask(() => void this.pollOne(t).finally(() => this.changed()));
    if (t.probe.kind === 'no-answer') {
      if (t.firstUnansweredAt === null) t.firstUnansweredAt = now;
      t.backoff = Math.min(this.intervals.maxBackoff, Math.max(this.intervals.visible, t.backoff * 2 || this.intervals.visible));
    } else {
      t.firstUnansweredAt = null;
      t.lastAnswerAt = now;
      t.backoff = 0;
    }
    const cadence = this.visible ? this.intervals.visible : this.intervals.background;
    t.nextProbeAt = now + Math.max(cadence, t.probe.kind === 'no-answer' && !t.launchd.disabled ? Math.min(t.backoff, cadence * 2) : cadence);
    this.observe(t);
  }

  /** Turn a state change into an app event; remember what the notification rules need. */
  private observe(t: Tracked): void {
    const snap = this.snapshotOf(t);
    const prev = t.lastState;
    t.lastState = snap.state;
    if (prev === null || prev === snap.state) return;
    const pid = t.probe?.kind === 'answer' ? t.probe.doc.process.pid : null;
    if (snap.state === 'down' && !t.busy) this.appEvent(t.entry.key, t, 'service.down', 'error', 'app.event.down');
    if (prev === 'down' && (snap.state === 'ready' || snap.state === 'degraded')) {
      const outage = this.now() - (this.outageStart.get(t.entry.key) ?? this.now());
      this.appEvent(t.entry.key, t, 'service.back', 'notice', 'app.event.back', { duration: duration(this.o.lang(), outage) });
      if (t.downNotified) this.notify({ kind: 'back', serviceKey: t.entry.key }, t, 'notify.back.title', 'notify.back.body', { duration: duration(this.o.lang(), outage) });
      t.downNotified = false;
    }
    if (snap.state === 'down') this.outageStart.set(t.entry.key, t.firstUnansweredAt ?? this.now());
    if (snap.state === 'duplicate') {
      const params = (snap.reasons[0]?.params ?? {}) as Record<string, number>;
      this.appEvent(t.entry.key, t, 'service.duplicate', 'warning', 'app.event.duplicate', params);
      this.notify({ kind: 'duplicate', serviceKey: t.entry.key }, t, 'notify.duplicate.title', 'reason.duplicate', params);
    }
    if (snap.state === 'foreign') {
      this.appEvent(t.entry.key, t, 'service.foreign', 'warning', 'app.event.foreign');
      this.notify({ kind: 'foreign', serviceKey: t.entry.key }, t, 'notify.foreign.title', snap.reasons[0]?.code ?? 'reason.foreign.protocol', snap.reasons[0]?.params ?? {});
    }
    if (pid && t.lastPid && pid !== t.lastPid) this.emit('restarted', t.entry.key);
    if (pid) t.lastPid = pid;
  }

  private readonly outageStart = new Map<string, number>();

  private checkNotifications(): void {
    const now = this.now();
    for (const t of this.tracked.values()) {
      if (t.lastState === 'down' && !t.downNotified && t.firstUnansweredAt !== null && now - t.firstUnansweredAt >= DOWN_NOTIFY_AFTER_MS) {
        t.downNotified = true;
        this.notify({ kind: 'down', serviceKey: t.entry.key }, t, 'notify.down.title', 'notify.down.body', { since: new Date(t.firstUnansweredAt).toLocaleTimeString() });
      }
    }
  }

  private name(t: Tracked): string {
    return t.entry.descriptor?.name ?? (t.probe?.kind === 'answer' ? t.probe.doc.service.name : t.entry.key);
  }

  private appEvent(key: string, t: Tracked, kind: string, level: 'info' | 'notice' | 'warning' | 'error', textKey: string, params: Record<string, string | number> = {}): void {
    const lang = this.o.lang();
    this.o.activity.addAppEvent(key, this.name(t), kind, level, tr(lang, textKey, { name: this.name(t), ...params }));
    this.changed();
  }

  private notify(h: Happening, tracked: Tracked, titleKey: string, bodyKey: string, params: Record<string, string | number>, link?: string): void {
    if (!shouldNotify(this.o.settings(), h, new Date(this.now()))) return;
    const lang = this.o.lang();
    const name = this.name(tracked);
    this.emit('notify', { serviceKey: h.serviceKey, title: tr(lang, titleKey, { name, ...params }), body: tr(lang, bodyKey, { name, ...params }), link, target: 'service' } satisfies Notice);
  }

  // --- events feed ----------------------------------------------------------------
  async pollEvents(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      await Promise.all([...this.tracked.values()].map((t) => this.pollOne(t)));
    } finally {
      this.polling = false;
      this.changed();
    }
  }

  private async pollOne(t: Tracked): Promise<void> {
    const d = t.entry.descriptor;
    if (!d || t.probe?.kind !== 'answer' || this.snapshotOf(t).state === 'foreign') return;
    const path = t.probe.doc.surfaces.events.path;
    let token: string;
    try {
      token = readToken(d.auth.tokenFile);
    } catch (error) {
      t.feedError = { code: 'raw', params: { text: (error as Error).message } };
      return;
    }
    try {
      let after = this.o.activity.cursor(t.entry.key);
      const firstEver = after === null;
      const fresh = [];
      for (let page = 0; page < 5; page += 1) {
        const res = await fetchEvents(d, path, token, after, firstEver ? 50 : 100);
        fresh.push(...this.o.activity.addServiceEvents(t.entry.key, d.name, res.events, res.cursor));
        if (firstEver || res.events.length < 100 || res.cursor === after) break;
        after = res.cursor;
      }
      t.feedError = null;
      if (firstEver || !t.baselined) { t.baselined = true; return; } // history, not news
      const asking = fresh.filter((e) => e.notify);
      const allowed = asking.filter((e) => shouldNotify(this.o.settings(), { kind: 'event', serviceKey: t.entry.key, level: e.level }, new Date(this.now())));
      if (allowed.length === 1) {
        this.emit('notify', { serviceKey: t.entry.key, title: d.name, body: allowed[0]!.text, link: allowed[0]!.link, target: 'service' } satisfies Notice);
      } else if (allowed.length > 1) {
        this.emit('notify', { serviceKey: t.entry.key, title: tr(this.o.lang(), 'notify.many', { name: d.name, count: allowed.length }), body: allowed.at(-1)!.text, target: 'activity' } satisfies Notice);
      }
    } catch (error) {
      t.feedError = { code: 'raw', params: { text: (error as Error).message } };
    }
  }

  // --- control ---------------------------------------------------------------------
  async control(key: string, action: 'restart' | 'stop' | 'start'): Promise<{ ok: boolean; reason: Reason }> {
    const t = this.tracked.get(key);
    const d = t?.entry.descriptor;
    if (!t || !d) return { ok: false, reason: { code: 'reason.invalid', params: { problem: 'unknown service' } } };
    const name = d.name;
    const finish = (ok: boolean, reason: Reason) => {
      t.busy = null;
      t.lastAction = { action, ok, reason, at: new Date(this.now()).toISOString() };
      t.nextProbeAt = this.now();
      this.o.activity.addAppEvent(key, name, `service.${action}`, ok ? 'info' : 'warning', tr(this.o.lang(), reason.code, reason.params));
      this.changed();
      void this.tick();
      return { ok, reason };
    };
    if (d.lifecycle.manager !== 'launchd' || !d.lifecycle.label || !d.lifecycle.plist) return finish(false, { code: 'result.unmanaged', params: { name } });
    const label = d.lifecycle.label;
    const plist = expand(d.lifecycle.plist);
    if (action !== 'stop' && !fs.existsSync(plist)) return finish(false, { code: 'result.plistMissing', params: { name, path: plist } });
    const oldPid = t.probe?.kind === 'answer' ? t.probe.doc.process.pid : null;
    t.busy = action === 'restart' ? 'restarting' : action === 'stop' ? 'stopping' : 'starting';
    this.changed();
    const r = action === 'restart' ? await this.launchd.restart(label, plist) : action === 'stop' ? await this.launchd.stop(label) : await this.launchd.start(label, plist);
    if (r.code !== 0) return finish(false, { code: 'result.launchctl', params: { detail: (r.stderr || r.stdout).trim() || `exit ${r.code}` } });
    const deadline = this.now() + CONTROL_TIMEOUT_MS;
    while (this.now() < deadline) {
      const probe = await fetchWellKnown(d.origin, 1500);
      if (action === 'stop') {
        if (probe.kind === 'no-answer') {
          t.probe = probe;
          t.firstUnansweredAt = null;
          const s = await this.launchd.status(label);
          t.launchd = { managed: true, ...s };
          t.lastState = 'stopped';
          return finish(true, { code: 'result.stopped', params: { name } });
        }
      } else if (probe.kind === 'answer' && probe.doc.service.id === d.id && probe.doc.service.instance === d.instance && (action !== 'restart' || probe.doc.process.pid !== oldPid)) {
        t.probe = probe;
        t.firstUnansweredAt = null;
        t.lastAnswerAt = this.now();
        t.downNotified = false;
        t.lastPid = probe.doc.process.pid;
        return finish(true, { code: action === 'restart' ? 'result.restarted' : 'result.started', params: { name, pid: probe.doc.process.pid } });
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return finish(false, { code: action === 'stop' ? 'result.stillAnswering' : 'result.timeout', params: { name } });
  }

  async command(key: string, which: 'doctor' | 'update'): Promise<{ code: number | null; output: string; timedOut: boolean }> {
    const t = this.tracked.get(key);
    const argv = t?.entry.descriptor?.commands?.[which];
    if (!t || !argv) return { code: null, output: '', timedOut: false };
    t.busy = which === 'doctor' ? 'doctor' : 'updating';
    this.changed();
    const [cmd, ...args] = argv.map((a, i) => (i === 0 ? expand(a) : a));
    const result = await new Promise<{ code: number | null; output: string; timedOut: boolean }>((resolve) => {
      execFile(cmd!, args, { timeout: COMMAND_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', env: { ...process.env } }, (error, stdout, stderr) => {
        const timedOut = Boolean(error && (error as { killed?: boolean }).killed);
        const code = error ? (typeof (error as { code?: unknown }).code === 'number' ? (error as { code: number }).code : null) : 0;
        resolve({ code, output: `${stdout ?? ''}${stderr ? `\n${stderr}` : ''}`.trim(), timedOut });
      });
    });
    t.busy = null;
    const name = t.entry.descriptor!.name;
    const reason: Reason = result.timedOut ? { code: 'result.commandTimeout', params: { command: which } } : { code: 'result.command', params: { command: which, code: result.code ?? 'none' } };
    t.lastAction = { action: which, ok: !result.timedOut && result.code === 0, reason, at: new Date(this.now()).toISOString() };
    this.o.activity.addAppEvent(key, name, `service.${which}`, t.lastAction.ok ? 'info' : 'warning', `${name}: ${tr(this.o.lang(), reason.code, reason.params)}`);
    t.nextProbeAt = this.now();
    void this.tick();
    return result;
  }

  logs(key: string): { path: string; text?: string; error?: string }[] {
    const d = this.tracked.get(key)?.entry.descriptor;
    if (!d) return [];
    return d.paths.logs.map((p) => {
      const file = expand(p);
      try {
        return { path: file, text: tail(file) };
      } catch (error) {
        return { path: file, error: (error as Error).message };
      }
    });
  }

  // --- reading state ----------------------------------------------------------------
  private snapshotOf(t: Tracked): ServiceSnapshot {
    const { state, reasons } = deriveState({
      descriptor: t.entry.descriptor, problems: t.entry.problems, conflict: this.conflicts().get(t.entry.key),
      launchd: t.launchd, probe: t.probe, firstUnansweredAt: t.firstUnansweredAt, now: this.now(), busy: t.busy,
    });
    const wk = t.probe?.kind === 'answer' ? t.probe.doc : null;
    if (wk?.update?.available) reasons.push({ code: 'reason.update', params: { version: wk.update.available } });
    return {
      key: t.entry.key, descriptorPath: t.entry.path, descriptor: t.entry.descriptor, problems: t.entry.problems, state, reasons,
      wellKnown: wk, launchd: t.launchd,
      firstUnansweredAt: t.firstUnansweredAt ? new Date(t.firstUnansweredAt).toISOString() : null,
      lastAnswerAt: t.lastAnswerAt ? new Date(t.lastAnswerAt).toISOString() : null,
      busy: t.busy, lastAction: t.lastAction, latestEvent: this.o.activity.latest(t.entry.key), feedError: t.feedError,
    };
  }

  snapshots(): ServiceSnapshot[] {
    return [...this.tracked.values()].map((t) => this.snapshotOf(t)).sort((a, b) => (a.descriptor?.name ?? a.key).localeCompare(b.descriptor?.name ?? b.key));
  }

  snapshot(key: string): ServiceSnapshot | null {
    const t = this.tracked.get(key);
    return t ? this.snapshotOf(t) : null;
  }

  meta(): { servicesDir: string; dirError: string | null; scanning: boolean } {
    return { servicesDir: this.o.servicesDir, dirError: this.dirError, scanning: this.scanning };
  }
}
