// The monitor: descriptors in, service snapshots, activity and notifications out.
// It reads the services directory, probes every service, controls them through
// launchd only, and never starts a service process itself (ADR-0002).
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { ActivityStore } from './activity';
import { runOwned } from './children';
import { authHeaders, claimConflicts, deriveState, expand, fetchWellKnown, portOf, readDirectory, REMOTE_TIMEOUT_MS, type DescriptorEntry, type WellKnownOptions, type WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { tail } from './fsutil';
import { duration, t as tr, type Lang } from './i18n';
import { Launchd } from './launchd';
import { composeEventNotice, displayName, DOWN_NOTIFY_AFTER_MS, episodeKey, intentOf, NotifyLedger, shouldNotify, type Happening, type Intent } from './notify';
import { fetchEvents, PROBE_TIMEOUT_MS, readToken } from './probe';
import { tlsFor } from './testhooks';
import type { Busy, Reason, ServiceSnapshot, Settings } from './types';

export const CONTROL_TIMEOUT_MS = 40_000;
export const COMMAND_TIMEOUT_MS = 120_000;
/** Consecutive failed probes before silence counts at all (ADR-0008). Fewer keep the last answer. */
export const DOWN_AFTER_MISSES = 3;

export interface Notice { serviceKey: string; title: string; subtitle?: string; body: string; link?: string; target: 'service' | 'activity' }

export interface MonitorOptions {
  servicesDir: string;
  activity: ActivityStore;
  settings: () => Settings;
  lang: () => Lang;
  launchd?: Launchd;
  now?: () => number;
  /** Milliseconds. `rescan` is the safety net under the directory watcher; `visible`/`background` the
   *  probe cadence with and without a visible window; `events`/`eventsBackground` the feed cadence;
   *  `remote` the floor for an online service; `launchdRefresh` how stale launchd's view may get while
   *  hidden and every probe answers with the same pid; `disabledTtl` how long one `print-disabled`
   *  table serves. AGENTS.md ## Lifecycle states the resulting idle budget. */
  intervals?: Partial<typeof DEFAULT_INTERVALS>;
  /** The health probe. Default: the well-known document with PROBE_TIMEOUT_MS, or REMOTE_TIMEOUT_MS and the token for a remote placement (DEC-0019). */
  wellKnown?: (origin: string, options?: WellKnownOptions) => Promise<WellKnownResult>;
  /** Which notification episodes were told and when (ADR-0010). Default: in memory. */
  ledger?: NotifyLedger;
  /** The events feed reader and the token reader. Defaults: probe.ts. */
  events?: typeof fetchEvents;
  token?: typeof readToken;
}

interface Tracked {
  entry: DescriptorEntry;
  probe: WellKnownResult | null;
  launchd: ServiceSnapshot['launchd'];
  firstUnansweredAt: number | null;
  lastAnswerAt: number | null;
  misses: number; // consecutive probes without an answer
  lastAnswer: Extract<WellKnownResult, { kind: 'answer' }> | null;
  nextProbeAt: number;
  backoff: number;
  busy: Busy;
  lastAction: ServiceSnapshot['lastAction'];
  feedError: Reason | null;
  downNotified: boolean;
  lastState: ServiceSnapshot['state'] | null;
  lastPid: number | null;
  baselined: boolean; // first events poll records history without notifying
  tokenProblem: string | null; // DEC-0019: a remote placement whose token cannot be read is invalid, never probed
  launchdAt: number | null; // when launchd was last read for this service
  polledAt: number | null; // when its events feed was last read
  /** The usage path its own last answer declared (ADR-0013): kept while it is down, so Spend says it could not read it instead of "not reporting". */
  usagePath: string | null;
  /** S-2: the descriptor (as JSON) whose online origin answered as another service — no token goes there again until it changes. */
  remoteForeignFor: string | null;
}

// #region idle-cadence — docs: AGENTS.md#lifecycle
const DEFAULT_INTERVALS = {
  rescan: 60_000, visible: 5_000, background: 30_000, events: 15_000, eventsBackground: 30_000,
  remote: 60_000, launchdRefresh: 5 * 60_000, disabledTtl: 60_000, maxBackoff: 60_000,
};
/** The earliest a scheduled wake may come after the last one. */
const MIN_WAKE_MS = 250;
// #endregion idle-cadence

export class Monitor extends EventEmitter {
  private readonly tracked = new Map<string, Tracked>();
  private readonly launchd: Launchd;
  private readonly now: () => number;
  private readonly intervals: typeof DEFAULT_INTERVALS;
  private readonly wellKnown: (origin: string, options?: WellKnownOptions) => Promise<WellKnownResult>;
  private readonly ledger: NotifyLedger;
  private readonly events: typeof fetchEvents;
  private readonly token: typeof readToken;
  /** Hidden until a window says otherwise: a launch at login never shows one (LC-08). */
  private visible = false;
  private running = false;
  private watcher: fs.FSWatcher | null = null;
  private wakeTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastPollAt = 0;
  private scanning = true;
  private dirError: string | null = null;
  private ticking = false;
  private rescanPending = false;
  private polling = false;
  private changeTimer: NodeJS.Timeout | null = null;
  private lastEmitted: string | null = null;
  private disabled: { at: number; table: string } | null = null;

  constructor(private readonly o: MonitorOptions) {
    super();
    this.launchd = o.launchd ?? new Launchd();
    this.now = o.now ?? Date.now;
    this.intervals = { ...DEFAULT_INTERVALS, ...(o.intervals ?? {}) };
    this.wellKnown = o.wellKnown ?? ((origin, options) => fetchWellKnown(origin, options?.headers ? REMOTE_TIMEOUT_MS : PROBE_TIMEOUT_MS, options));
    this.ledger = o.ledger ?? new NotifyLedger(null);
    this.events = o.events ?? fetchEvents;
    this.token = o.token ?? readToken;
  }

  // --- lifecycle -----------------------------------------------------------------
  // #region idle-scheduler — docs: AGENTS.md#lifecycle
  // One timer for probes and rescans, armed for the earliest thing that is due — never a fixed
  // 1-second poll — and one for the events feed. Hidden, both run at the background cadence (LC-08).
  start(): void {
    this.running = true;
    this.watch();
    void this.tick();
    this.armPoll(this.intervals.events);
  }

  stop(): void {
    this.running = false;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.changeTimer) clearTimeout(this.changeTimer);
    this.wakeTimer = this.pollTimer = this.changeTimer = null;
    this.watcher?.close();
    this.watcher = null;
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    if (!visible) {
      // A probe booked at the live cadence moves to the background one; an unconfirmed miss keeps
      // its quick re-check (ADR-0008).
      const shift = Math.max(0, this.intervals.background - this.intervals.visible);
      for (const t of this.tracked.values()) if (t.misses === 0 && t.entry.descriptor?.placement !== 'remote') t.nextProbeAt += shift;
      this.schedule();
      this.armPoll(Math.max(0, this.lastPollAt + this.intervals.eventsBackground - this.now()));
      return;
    }
    // A window that opens shows current states, not the last background read.
    for (const t of this.tracked.values()) t.nextProbeAt = Math.min(t.nextProbeAt, this.now());
    if (this.running) void this.tick();
    this.armPoll(Math.max(0, this.lastPollAt + this.intervals.events - this.now()));
  }

  private watch(): void {
    try {
      fs.mkdirSync(this.o.servicesDir, { recursive: true, mode: 0o700 });
      this.watcher = fs.watch(this.o.servicesDir, { persistent: false }, () => void this.tick(true));
      this.watcher.on('error', () => { this.watcher?.close(); this.watcher = null; this.schedule(); });
    } catch {
      this.watcher = null; // the rescan below covers it, at the probe cadence
    }
  }

  /** How often the directory is read when nothing told us it changed: at the probe cadence while a
   *  window shows it (SCN-003's five seconds even if a watcher event is lost); hidden, the watcher
   *  plus a slow safety net, or the background cadence when there is no watcher. */
  private rescanEvery(): number {
    if (this.visible) return this.intervals.visible;
    return this.watcher ? this.intervals.rescan : this.intervals.background;
  }

  private schedule(delay?: number): void {
    if (!this.running) return;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    let wait = delay;
    if (wait === undefined) {
      const now = this.now();
      let next = this.lastRescan + this.rescanEvery();
      for (const t of this.tracked.values()) if (!t.busy) next = Math.min(next, t.nextProbeAt);
      wait = Math.max(MIN_WAKE_MS, next - now);
    }
    this.wakeTimer = setTimeout(() => { this.wakeTimer = null; void this.tick(); }, wait);
    this.wakeTimer.unref?.();
  }

  private armPoll(delay: number): void {
    if (!this.running) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.pollEvents().finally(() => this.armPoll(this.visible ? this.intervals.events : this.intervals.eventsBackground));
    }, delay);
    this.pollTimer.unref?.();
  }
  // #endregion idle-scheduler

  /** What the window, the tray and the Dock show, minus what changes on every answer without
   *  meaning anything (the time of the last answer). Equal fingerprints are not news. */
  private fingerprint(): string {
    return JSON.stringify([this.snapshots().map((s) => ({ ...s, lastAnswerAt: null })), this.meta(), this.o.activity.revision]);
  }

  /** Emit `change` only when what a person can see differs from the last emit (LC-08). */
  private changed(): void {
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => {
      this.changeTimer = null;
      const now = this.fingerprint();
      if (now === this.lastEmitted) return;
      this.lastEmitted = now;
      this.emit('change');
    }, 50);
  }

  // --- reading and probing -------------------------------------------------------------
  private lastRescan = 0;

  async tick(forceRescan = false): Promise<void> {
    if (this.ticking) { if (forceRescan) this.rescanPending = true; return; }
    this.ticking = true;
    try {
      const now = this.now();
      if (forceRescan || this.rescanPending || now - this.lastRescan >= this.rescanEvery()) {
        this.rescanPending = false;
        this.lastRescan = now;
        this.rescan();
      }
      const due = [...this.tracked.values()].filter((t) => t.nextProbeAt <= now && !t.busy);
      if (due.length) {
        let table: Promise<string> | null = null;
        const disabledTable = () => (table ??= this.disabledTable());
        await Promise.all(due.map((t) => this.probe(t, disabledTable)));
      }
    } finally {
      this.ticking = false;
      this.scanning = false;
      this.changed();
      if (this.rescanPending) this.schedule(0);
      else this.schedule();
    }
  }

  /** One `launchctl print-disabled` serves every probe for `disabledTtl`; a control action clears it. */
  private async disabledTable(): Promise<string> {
    const now = this.now();
    if (this.disabled && now - this.disabled.at < this.intervals.disabledTtl) return this.disabled.table;
    const table = await this.launchd.disabledTable();
    this.disabled = { at: now, table };
    return table;
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
        this.emit('removed', key); // its view and its stored session go with it (LC-12)
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
        // R-18: launchd is not read yet — not "not loaded". Until the first probe it reads `starting`, never Off with Start.
        entry, probe: null, launchd: { managed: entry.descriptor?.lifecycle.manager === 'launchd', loaded: true, pid: null, disabled: false },
        firstUnansweredAt: null, lastAnswerAt: null, misses: 0, lastAnswer: null, nextProbeAt: this.now(), backoff: 0, busy: null, lastAction: null, tokenProblem: null, usagePath: null, remoteForeignFor: null,
        feedError: null, downNotified: false, lastState: null, lastPid: null, baselined: false, launchdAt: null, polledAt: null,
      };
      this.tracked.set(entry.key, t);
      if (!this.scanning) this.appEvent(entry.key, t, 'service.installed', 'info', 'app.event.installed');
    }
  }

  private conflicts(): Map<string, { port?: number; with: string[] }> {
    return claimConflicts([...this.tracked.values()].map((t) => t.entry));
  }

  private async probe(t: Tracked, disabledTable: () => Promise<string>): Promise<void> {
    const d = t.entry.descriptor;
    const conflict = this.conflicts().get(t.entry.key);
    if (!d || conflict) {
      t.probe = null;
      t.nextProbeAt = this.now() + this.intervals.background;
      this.observe(t);
      return;
    }
    const answeredBefore = t.probe?.kind === 'answer';
    const pidBefore = t.probe?.kind === 'answer' ? t.probe.doc.process.pid : null;
    let options: WellKnownOptions | undefined;
    t.tokenProblem = null;
    if (d.placement === 'remote') {
      // S-2: an origin that answered as another service keeps that verdict, and gets no token,
      // until the descriptor changes (reason.remote.foreign says so).
      if (t.remoteForeignFor === JSON.stringify(d)) {
        t.nextProbeAt = this.now() + this.intervals.remote;
        this.observe(t);
        return;
      }
      t.remoteForeignFor = null;
      try {
        options = { headers: authHeaders(d, this.token(d.auth.tokenFile)), ...tlsFor(d.origin) };
      } catch (error) {
        t.tokenProblem = (error as Error).message;
        t.probe = null;
        t.nextProbeAt = this.now() + this.intervals.background;
        this.observe(t);
        return;
      }
    }
    let probe: WellKnownResult;
    try {
      probe = await this.wellKnown(d.origin, options);
    } catch (error) {
      probe = { kind: 'no-answer', detail: (error as Error).message };
    }
    // #region launchd-reads — docs: AGENTS.md#lifecycle
    // launchd is read on every probe while a window shows it. Hidden, a `launchctl print` (a process
    // spawn) runs only when it can change the verdict: the probe missed, the answering pid moved, or
    // launchd's view is older than `launchdRefresh` (a duplicate behind a steady answer).
    if (d.lifecycle.manager === 'launchd' && d.lifecycle.label) {
      const steady = probe.kind === 'answer' && pidBefore === probe.doc.process.pid && t.launchd.managed;
      const fresh = t.launchdAt !== null && this.now() - t.launchdAt < this.intervals.launchdRefresh;
      if (this.visible || !steady || !fresh) {
        const s = await this.launchd.status(d.lifecycle.label, await disabledTable());
        t.launchd = { managed: true, ...s };
        t.launchdAt = this.now();
      }
    } else {
      t.launchd = { managed: false, loaded: false, pid: null, disabled: false };
    }
    // #endregion launchd-reads
    t.probe = probe;
    if (probe.kind === 'answer') {
      const own = probe.doc.service.id === d.id && probe.doc.service.instance === d.instance;
      if (own) t.usagePath = probe.doc.surfaces.usage?.path ?? null;
      else if (d.placement === 'remote') t.remoteForeignFor = JSON.stringify(d);
    }
    const now = this.now();
    // A service that starts answering is read at once, not at the next 15-second poll.
    if (probe.kind === 'answer' && !answeredBefore) queueMicrotask(() => void this.pollOne(t).finally(() => this.changed()));
    // #region probe-confirmation — docs: docs/adr/0008-a-missed-probe-is-not-an-outage.md#decision
    // An online service is never read faster than `remote`, window or not (DEC-0019, LC-08).
    const cadence = Math.max(this.visible ? this.intervals.visible : this.intervals.background, d.placement === 'remote' ? this.intervals.remote : 0);
    if (probe.kind === 'no-answer') {
      if (t.firstUnansweredAt === null) t.firstUnansweredAt = now;
      t.misses += 1;
      t.backoff = Math.min(this.intervals.maxBackoff, Math.max(this.intervals.visible, t.backoff * 2 || this.intervals.visible));
      // An unconfirmed miss is checked again soon, whatever the window: one slow answer is not a verdict.
      t.nextProbeAt = now + (t.misses < DOWN_AFTER_MISSES ? this.intervals.visible : Math.max(cadence, !t.launchd.disabled ? Math.min(t.backoff, cadence * 2) : cadence));
    } else {
      t.firstUnansweredAt = null;
      t.lastAnswerAt = now;
      t.misses = 0;
      t.backoff = 0;
      t.lastAnswer = probe.kind === 'answer' ? probe : null;
      t.nextProbeAt = now + cadence;
    }
    this.observe(t);
    if (probe.kind === 'no-answer') this.checkDown(t, now);
    // #endregion probe-confirmation
  }

  /** What the state is derived from. Until DOWN_AFTER_MISSES probes in a row have failed, a miss
   *  keeps the last answer — unless launchd says that answer is gone (job off, or another pid). */
  private evidence(t: Tracked): { probe: WellKnownResult | null; firstUnansweredAt: number | null } {
    if (t.probe?.kind !== 'no-answer' || t.misses >= DOWN_AFTER_MISSES) return { probe: t.probe, firstUnansweredAt: t.firstUnansweredAt };
    const l = t.launchd;
    const off = l.managed && (l.disabled || !l.loaded);
    const replaced = l.managed && l.pid !== null && t.lastAnswer !== null && t.lastAnswer.doc.process.pid !== l.pid;
    if (t.lastAnswer && !off && !replaced) return { probe: t.lastAnswer, firstUnansweredAt: null };
    return { probe: t.probe, firstUnansweredAt: this.now() }; // silence not yet counted: `starting`, reason waiting
  }

  /** Turn a state change into an app event; remember what the notification rules need. */
  private observe(t: Tracked): void {
    const snap = this.snapshotOf(t);
    const prev = t.lastState;
    t.lastState = snap.state;
    // R-8: a new pid is a restart even when the state did not change between two probes (ready → ready).
    const pid = t.probe?.kind === 'answer' && snap.state !== 'foreign' ? t.probe.doc.process.pid : null;
    if (pid && t.lastPid && pid !== t.lastPid) this.emit('restarted', t.entry.key);
    if (pid) t.lastPid = pid;
    if (prev === null || prev === snap.state) return;
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
  }

  private readonly outageStart = new Map<string, number>();

  /** Called right after a failed probe: the outage is notified only when that probe confirms it
   *  has lasted past DOWN_NOTIFY_AFTER_MS. A tick without a probe never decides. */
  private checkDown(t: Tracked, now: number): void {
    if (t.lastState === 'down' && !t.downNotified && t.misses >= DOWN_AFTER_MISSES && t.firstUnansweredAt !== null && now - t.firstUnansweredAt >= DOWN_NOTIFY_AFTER_MS) {
      t.downNotified = true;
      // P-8: an online service is restarted by its platform, not here — its notification says so.
      const body = t.entry.descriptor?.placement === 'remote' ? 'notify.down.bodyRemote' : 'notify.down.body';
      this.notify({ kind: 'down', serviceKey: t.entry.key }, t, 'notify.down.title', body, { since: new Date(t.firstUnansweredAt).toLocaleTimeString(this.o.lang(), { hour: '2-digit', minute: '2-digit' }) });
    }
  }

  private name(t: Tracked): string {
    const d = t.entry.descriptor;
    if (d) return displayName(d.name, d.instance);
    return t.probe?.kind === 'answer' ? displayName(t.probe.doc.service.name, t.probe.doc.service.instance) : t.entry.key;
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
    const now = this.now();
    this.lastPollAt = now;
    try {
      // An online service's feed is read no faster than `remote`, like its probe.
      const due = [...this.tracked.values()].filter((t) => t.entry.descriptor?.placement !== 'remote' || t.polledAt === null || now - t.polledAt >= this.intervals.remote - MIN_WAKE_MS);
      await Promise.all(due.map((t) => this.pollOne(t)));
    } finally {
      this.polling = false;
      this.changed();
    }
  }

  private async pollOne(t: Tracked): Promise<void> {
    const d = t.entry.descriptor;
    // U-9: a service that does not answer (or a foreign one) is not read; an old feed error would
    // only be stale beside its state, which says why.
    if (!d || t.probe?.kind !== 'answer' || this.snapshotOf(t).state === 'foreign') { t.feedError = null; return; }
    t.polledAt = this.now();
    const path = t.probe.doc.surfaces.events.path;
    let token: string;
    try {
      token = this.token(d.auth.tokenFile);
    } catch (error) {
      t.feedError = { code: 'raw', params: { text: (error as Error).message } };
      return;
    }
    try {
      let after = this.o.activity.cursor(t.entry.key);
      const firstEver = after === null;
      const fresh = [];
      for (let page = 0; page < 5; page += 1) {
        const res = await this.events(d, path, token, after, firstEver ? 50 : 100);
        fresh.push(...this.o.activity.addServiceEvents(t.entry.key, this.name(t), res.events, res.cursor)); // P-2: the instance is named
        if (firstEver || res.events.length < 100 || res.cursor === after) break;
        after = res.cursor;
      }
      t.feedError = null;
      if (firstEver || !t.baselined) { t.baselined = true; return; } // history, not news
      // #region notification-policy — docs: docs/adr/0010-notifications-only-when-it-matters.md#decision
      // The service asks (`notify`); the host tells only a request, a failure or a new warning, once per episode.
      const now = this.now();
      const told: { intent: Exclude<Intent, 'quiet'>; text: string; link?: string }[] = [];
      for (const e of fresh) {
        const intent = e.notify ? intentOf(e) : 'quiet';
        if (intent === 'quiet') continue;
        if (!shouldNotify(this.o.settings(), { kind: 'event', serviceKey: t.entry.key, level: e.level }, new Date(now))) continue;
        if (!this.ledger.admit(episodeKey({ key: t.entry.key, id: d.id }, e), intent, now)) continue;
        told.push({ intent, text: e.text, link: e.link });
      }
      if (told.length) this.emit('notify', { serviceKey: t.entry.key, ...composeEventNotice(this.o.lang(), this.name(t), told) } satisfies Notice);
      // #endregion notification-policy
    } catch (error) {
      t.feedError = { code: 'raw', params: { text: (error as Error).message } };
    }
  }

  // --- control ---------------------------------------------------------------------
  async control(key: string, action: 'restart' | 'stop' | 'start'): Promise<{ ok: boolean; reason: Reason }> {
    const t = this.tracked.get(key);
    const d = t?.entry.descriptor;
    if (!t || !d) return { ok: false, reason: { code: 'reason.invalid', params: { problem: 'unknown service' } } };
    const name = this.name(t); // P-2: "Growth · projection restarted", never two instances that read alike
    // R-8: one action at a time — a double click or a second button never runs a second kickstart.
    if (t.busy) return { ok: false, reason: { code: 'result.busy', params: { name } } };
    const finish = (ok: boolean, reason: Reason) => {
      t.busy = null;
      this.disabled = null; // the action may have changed launchd's disabled table
      t.launchdAt = null;
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
    // U-15: restarting a duplicate waits for a new pid; if the stray copy keeps the port, say so by its pid.
    const strayPid = t.lastState === 'duplicate' ? oldPid : null;
    let lastSeenPid: number | null = null;
    t.busy = action === 'restart' ? 'restarting' : action === 'stop' ? 'stopping' : 'starting';
    this.changed();
    const r = action === 'restart' ? await this.launchd.restart(label, plist) : action === 'stop' ? await this.launchd.stop(label) : await this.launchd.start(label, plist);
    if (r.code !== 0) return finish(false, { code: 'result.launchctl', params: { detail: (r.stderr || r.stdout).trim() || `exit ${r.code}` } });
    const deadline = this.now() + CONTROL_TIMEOUT_MS;
    while (this.now() < deadline) {
      const probe = await fetchWellKnown(d.origin, 1500);
      if (probe.kind === 'answer') lastSeenPid = probe.doc.process.pid;
      if (action === 'stop') {
        if (probe.kind === 'no-answer') {
          t.probe = probe;
          t.firstUnansweredAt = null;
          t.misses = 0;
          t.lastAnswer = null;
          const s = await this.launchd.status(label);
          t.launchd = { managed: true, ...s };
          t.lastState = 'stopped';
          return finish(true, { code: 'result.stopped', params: { name } });
        }
      } else if (probe.kind === 'answer' && probe.doc.service.id === d.id && probe.doc.service.instance === d.instance && (action !== 'restart' || probe.doc.process.pid !== oldPid)) {
        t.probe = probe;
        t.firstUnansweredAt = null;
        t.lastAnswerAt = this.now();
        t.misses = 0;
        t.lastAnswer = probe;
        t.downNotified = false;
        t.lastPid = probe.doc.process.pid;
        if (action === 'restart') this.emit('restarted', key); // its page's session may be gone: the page offers Reload
        return finish(true, { code: action === 'restart' ? 'result.restarted' : 'result.started', params: { name, pid: probe.doc.process.pid } });
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    if (action === 'restart' && strayPid !== null && lastSeenPid === strayPid) {
      return finish(false, { code: 'result.strayHolds', params: { name, pid: strayPid, port: portOf(d.origin) ?? 0 } });
    }
    return finish(false, { code: action === 'stop' ? 'result.stillAnswering' : 'result.timeout', params: { name } });
  }

  async command(key: string, which: 'doctor' | 'update'): Promise<{ code: number | null; output: string; timedOut: boolean; refused?: string }> {
    const t = this.tracked.get(key);
    const argv = t?.entry.descriptor?.commands?.[which];
    if (!t || !argv) return { code: null, output: '', timedOut: false, refused: tr(this.o.lang(), 'result.noCommand', { command: tr(this.o.lang(), `command.${which}`) }) };
    if (t.busy) return { code: null, output: '', timedOut: false, refused: tr(this.o.lang(), 'result.busy', { name: this.name(t) }) };
    t.busy = which === 'doctor' ? 'doctor' : 'updating';
    this.changed();
    const [cmd, ...args] = argv.map((a, i) => (i === 0 ? expand(a) : a));
    // Its own process group, the descriptor-safe environment, killed with the group on timeout or quit (LC-02).
    const result = await runOwned(cmd!, args, { timeoutMs: COMMAND_TIMEOUT_MS });
    t.busy = null;
    const name = this.name(t);
    const command = tr(this.o.lang(), `command.${which}`);
    // P-4: a command that could not start (no such file, no permission) says so, not "exit code —".
    const reason: Reason = result.timedOut ? { code: 'result.commandTimeout', params: { command } }
      : result.code === null ? { code: 'result.commandFailed', params: { command, error: result.output.trim().split('\n').pop()?.slice(0, 200) ?? '' } }
      : { code: 'result.command', params: { command, code: result.code } };
    t.lastAction = { action: which, ok: !result.timedOut && result.code === 0, reason, at: new Date(this.now()).toISOString() };
    this.o.activity.addAppEvent(key, name, `service.${which}`, t.lastAction.ok ? 'info' : 'warning', `${name}: ${tr(this.o.lang(), reason.code, reason.params)}`);
    t.nextProbeAt = this.now();
    void this.tick();
    return result;
  }

  logs(key: string): { path: string; text?: string; error?: string }[] {
    const d = this.tracked.get(key)?.entry.descriptor;
    if (!d) return [];
    return (d.paths?.logs ?? []).map((p) => { // a remote placement keeps no logs here (DEC-0019)
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
    const seen = this.evidence(t);
    const { state, reasons } = deriveState({
      descriptor: t.entry.descriptor, problems: t.tokenProblem ? [...t.entry.problems, t.tokenProblem] : t.entry.problems, conflict: this.conflicts().get(t.entry.key),
      launchd: t.launchd, probe: seen.probe, firstUnansweredAt: seen.firstUnansweredAt, now: this.now(), busy: t.busy,
    });
    // P-12: an unreadable token file is a problem of this computer's file, not of the descriptor.
    if (t.tokenProblem && state === 'invalid' && !t.entry.problems.length) reasons.splice(0, reasons.length, { code: 'reason.token', params: { problem: t.tokenProblem } });
    // S-5: what another program says about itself is never shown as this service's own.
    const wk = seen.probe?.kind === 'answer' && state !== 'foreign' ? seen.probe.doc : null;
    if (wk?.update?.available) reasons.push({ code: 'reason.update', params: { version: wk.update.available } });
    return {
      key: t.entry.key, descriptorPath: t.entry.path, descriptor: t.entry.descriptor, problems: t.tokenProblem ? [...t.entry.problems, t.tokenProblem] : t.entry.problems, state, reasons,
      wellKnown: wk, launchd: t.launchd, usagePath: t.usagePath,
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
