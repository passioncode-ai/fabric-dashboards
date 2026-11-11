// The monitor: descriptors in, service snapshots, activity and notifications out.
// It reads the services directory, probes every service, controls them through
// launchd only, and never starts a service process itself (ADR-0002).
import { supervises } from './platform';
import { controlService } from './control';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { ActivityStore } from './activity';
import { runOwned } from './children';
import { placeCommand, userLaunchJobs, type LaunchJob } from './remote-console';
import { execRunner } from './launchd';
import os from 'node:os';
import { productIdOf } from '@passioncode-ai/fabric-service-host/links';
import { SystemdReader, authHeaders, claimConflicts, dashboardMinWidth, deriveState, elsewhereOf, isSystemJob, PlacementReader, SpaceDaemonReader, type Elsewhere, expand, fetchWellKnown, heldButSilent, loopbackOwnerOf, portOf, readDirectory, RemoteTokenLatch, REMOTE_TIMEOUT_MS, type DescriptorEntry, type WellKnownOptions, type WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { tail } from './fsutil';
import { commandReason, type CommandResult } from './outcome';
import { duration, t as tr, type Lang } from './i18n';
import { Launchd } from './launchd';
import type { InstanceContext, Organization } from './organizations';
import { composeEventNotice, displayName, DOWN_NOTIFY_AFTER_MS, episodeKey, intentOf, NotifyLedger, shouldNotify, type Happening, type Intent } from './notify';
import { fetchEvents, PROBE_TIMEOUT_MS, readTokenAsync } from './probe';
import { tlsFor } from './testhooks';
import type { Busy, Reason, ServiceSnapshot, Settings } from './types';

export { CONTROL_TIMEOUT_MS } from './control';
export const COMMAND_TIMEOUT_MS = 120_000;
/** Consecutive failed probes before silence counts at all (ADR-0008). Fewer keep the last answer. */
export const DOWN_AFTER_MISSES = 3;

export interface Notice { serviceKey: string; title: string; subtitle?: string; body: string; link?: string; target: 'service' | 'activity'; /** FD-48: set on an events-feed banner — what it wants (ADR-0010). */ intent?: Exclude<Intent, 'quiet'> }

/** FD-201: how long an unknown loopback owner must last before it reads as `foreign-user`, and how soon it is read again. */
export const UNKNOWN_OWNER_CONFIRM_MS = 15_000;
export const UNKNOWN_OWNER_RECHECK_MS = 6_000;

export interface MonitorOptions {
  /** FD-200: this user's launchd jobs, for the route of an agent placed elsewhere (default `~/Library/LaunchAgents`). */
  launchJobs?: () => LaunchJob[];
  /** FD-200: runs the ssh probe that asks whether that route may edit (default the plain runner); tests pass a fake. */
  remoteProbe?: (cmd: string, args: string[], timeoutMs: number) => Promise<{ code: number | null; stdout: string; stderr: string }>;
  /** The operating system whose supervisor runs services (default `process.platform`; ADR-0019 §7). */
  platform?: NodeJS.Platform;
  servicesDir: string;
  activity: ActivityStore;
  settings: () => Settings;
  lang: () => Lang;
  launchd?: Launchd;
  /** FD-55: systemd's MainPID on Linux (a fake in tests). */
  systemd?: Pick<SystemdReader, 'status'>;
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
  token?: (tokenFile: string) => string | Promise<string>;
  /** FD-132: this machine's placement record (default: Observatory's file, read again only when it changed). */
  placement?: Pick<PlacementReader, 'get' | 'error'>;
  /** FD-167: which launchd labels are system daemons of this user's space (default: Observatory's root-owned record). */
  daemons?: Pick<SpaceDaemonReader, 'isSystem'>;
  /** FD-135: the name the agent's own repository gives this service key (`.fabric/names.json`, ADR-0026), or null. */
  customName?: (key: string, repository: string | undefined) => string | null;
  /** FD-162: the organization of an agent's repository, from Project Observatory's registry; undefined when no map was
   *  ever read (the snapshot then carries none). */
  organizationOf?: (instance: InstanceContext) => Organization | null | undefined;
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
  /** FD-158: the last probe answered from a socket that is not this macOS user's own. */
  foreignUser?: boolean | 'unknown';
  /** FD-201: when the port's owner was first read as unknown in this run of unknowns; null once it is told. */
  unknownOwnerSince?: number | null;
  launchdAt: number | null; // when launchd was last read for this service
  polledAt: number | null; // when its events feed was last read
  /** The usage path its own last answer declared (ADR-0013): kept while it is down, so Spend says it could not read it instead of "not reporting". */
  usagePath: string | null;
  /** S-2: the descriptor (as JSON) whose online origin answered as another service — no token goes there again until it changes. */
}

// #region idle-cadence — docs: AGENTS.md#lifecycle
/** How long a descriptor must stay absent before the service counts as removed (audit MEDIUM-5). */
export const REMOVAL_GRACE_MS = 1500;

const DEFAULT_INTERVALS = {
  rescan: 60_000, visible: 5_000, background: 30_000, events: 15_000, eventsBackground: 30_000,
  remote: 60_000, launchdRefresh: 5 * 60_000, disabledTtl: 60_000, maxBackoff: 60_000,
};
/** The earliest a scheduled wake may come after the last one. */
const MIN_WAKE_MS = 250;
// #endregion idle-cadence

/** FD-125: an events-feed row asking the operator for a decision, for the operator channel. */
export interface AskNotice { serviceKey: string; name: string; id: string; at: number; text: string; link: string | null; episode: string }

export class Monitor extends EventEmitter {
  private readonly tracked = new Map<string, Tracked>();
  private readonly launchd: Launchd;
  private readonly systemd: Pick<SystemdReader, 'status'>;
  private readonly now: () => number;
  private readonly platform: NodeJS.Platform;
  private readonly intervals: typeof DEFAULT_INTERVALS;
  private readonly wellKnown: (origin: string, options?: WellKnownOptions) => Promise<WellKnownResult>;
  private readonly ledger: NotifyLedger;
  private readonly events: typeof fetchEvents;
  private readonly token: (tokenFile: string) => string | Promise<string>;
  private readonly latch = new RemoteTokenLatch();
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
  /** Descriptors absent from the folder since this time; one is gone only once it stays absent (REMOVAL_GRACE_MS). */
  private readonly missingSince = new Map<string, number>();
  /** U-16: a NEW descriptor that does not parse or validate yet, since this time. A writer that is not
   *  atomic leaves a half-written file for a moment; it is shown (and logged as installed) only once it
   *  stays invalid for REMOVAL_GRACE_MS — a file that becomes valid meanwhile simply appears. */
  private readonly unsettledSince = new Map<string, number>();
  private polling = false;
  private changeTimer: NodeJS.Timeout | null = null;
  private lastEmitted: string | null = null;
  private disabled: { at: number; table: string } | null = null;
  private disabledSystem: { at: number; table: string } | null = null;
  private readonly daemons: Pick<SpaceDaemonReader, 'isSystem'>;

  constructor(private readonly o: MonitorOptions) {
    super();
    this.launchd = o.launchd ?? new Launchd();
    this.systemd = o.systemd ?? new SystemdReader();
    this.platform = o.platform ?? process.platform;
    this.now = o.now ?? Date.now;
    this.intervals = { ...DEFAULT_INTERVALS, ...(o.intervals ?? {}) };
    this.wellKnown = o.wellKnown ?? ((origin, options) => fetchWellKnown(origin, portOf(origin) === null ? REMOTE_TIMEOUT_MS : PROBE_TIMEOUT_MS, options));
    this.ledger = o.ledger ?? new NotifyLedger(null);
    this.events = o.events ?? fetchEvents;
    this.token = o.token ?? readTokenAsync;
    this.placement = o.placement ?? new PlacementReader();
    this.daemons = o.daemons ?? new SpaceDaemonReader({ platform: this.platform });
  }

  /** FD-167, FD-180: a job whose plist is in /Library/LaunchDaemons, or that Observatory installed as a system daemon of
   *  this space, is read in `system`. */
  private where(d: NonNullable<DescriptorEntry['descriptor']>): 'gui' | 'system' {
    return isSystemJob(d, this.daemons, this.now()) ? 'system' : 'gui';
  }

  // #region placed-elsewhere — docs: docs/ux/scenarios.md#scn-089-see-which-agents-are-placed-on-the-other-machine
  private readonly placement: Pick<PlacementReader, 'get' | 'error'>;
  private placementError: string | null = null;

  /** FD-132: where the placement record puts this service; a changed reason the record cannot be used is said once. */
  private elsewhere(t: Tracked): Elsewhere | null {
    const placement = this.placement.get(this.now());
    if (this.placement.error !== this.placementError) {
      this.placementError = this.placement.error;
      this.emit('placement-error', this.placementError);
    }
    return elsewhereOf(placement, t.entry.descriptor);
  }

  /** FD-199: where the placement record puts this agent, when it is another machine; null for an unknown key. */
  placedElsewhere(key: string): Elsewhere | null {
    const t = this.tracked.get(key);
    return t ? this.elsewhere(t) : null;
  }
  // #endregion placed-elsewhere

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
      for (const since of this.missingSince.values()) next = Math.min(next, since + REMOVAL_GRACE_MS); // confirm a removal
      for (const since of this.unsettledSince.values()) next = Math.min(next, since + REMOVAL_GRACE_MS); // U-16: settle a new file
      for (const t of this.tracked.values()) if (!t.busy && !this.isOff(t)) next = Math.min(next, t.nextProbeAt);
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
    return JSON.stringify([this.snapshots().map((s) => ({ ...s, lastAnswerAt: null })), this.offServices(), this.meta(), this.o.activity.revision]);
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
      const confirmRemoval = [...this.missingSince.values(), ...this.unsettledSince.values()].some((since) => now - since >= REMOVAL_GRACE_MS);
      if (forceRescan || this.rescanPending || confirmRemoval || now - this.lastRescan >= this.rescanEvery()) {
        this.rescanPending = false;
        this.lastRescan = now;
        this.rescan();
      }
      this.syncOff();
      const due = [...this.tracked.values()].filter((t) => t.nextProbeAt <= now && !t.busy && !this.isOff(t));
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
  private async disabledTable(where: 'gui' | 'system' = 'gui'): Promise<string> {
    const now = this.now();
    const cached = where === 'system' ? this.disabledSystem : this.disabled;
    if (cached && now - cached.at < this.intervals.disabledTtl) return cached.table;
    const table = await this.launchd.disabledTable(where);
    if (where === 'system') this.disabledSystem = { at: now, table };
    else this.disabled = { at: now, table };
    return table;
  }

  private rescan(): void {
    let entries: DescriptorEntry[];
    try {
      entries = readDirectory(this.o.servicesDir); // paths in this machine's own grammar; `platform` models the supervisor
      this.dirError = null;
    } catch (error) {
      this.dirError = (error as Error).message;
      return;
    }
    const seen = new Set(entries.map((e) => e.key));
    const now = this.now();
    for (const key of [...this.missingSince.keys()]) if (seen.has(key)) this.missingSince.delete(key);
    for (const key of [...this.unsettledSince.keys()]) if (!seen.has(key)) this.unsettledSince.delete(key);
    for (const [key, t] of this.tracked) {
      if (!seen.has(key)) {
        // Audit 2026-10-07 MEDIUM-5: a writer that deletes and recreates its descriptor (no atomic
        // rename) is not a removal — a removal ends the service's console and its stored session.
        // Gone means absent on two scans at least REMOVAL_GRACE_MS apart.
        const since = this.missingSince.get(key);
        if (since === undefined) { this.missingSince.set(key, now); continue; }
        if (now - since < REMOVAL_GRACE_MS) continue;
        this.missingSince.delete(key);
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
      if (!entry.descriptor && !this.scanning) {
        const since = this.unsettledSince.get(entry.key);
        if (since === undefined) { this.unsettledSince.set(entry.key, now); continue; }
        if (now - since < REMOVAL_GRACE_MS) continue;
      }
      this.unsettledSince.delete(entry.key);
      const t: Tracked = {
        // R-18: launchd is not read yet — not "not loaded". Until the first probe it reads `starting`, never Off with Start.
        entry, probe: null, launchd: { managed: supervises(this.platform, entry.descriptor?.lifecycle.manager), loaded: true, pid: null, disabled: false },
        firstUnansweredAt: null, lastAnswerAt: null, misses: 0, lastAnswer: null, nextProbeAt: this.now(), backoff: 0, busy: null, lastAction: null, tokenProblem: null, usagePath: null,
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
      try {
        options = { headers: authHeaders(d, await this.token(d.auth.tokenFile)), ...tlsFor(d.origin) };
      } catch (error) {
        t.tokenProblem = (error as Error).message;
        t.probe = null;
        t.nextProbeAt = this.now() + this.intervals.background;
        this.observe(t);
        return;
      }
    }
    const ask = async (o?: WellKnownOptions): Promise<WellKnownResult> => {
      try {
        return await this.wellKnown(d.origin, o);
      } catch (error) {
        return { kind: 'no-answer', detail: (error as Error).message };
      }
    };
    // S-2, T-2: an online origin that answered as another service, or without the protocol, gets no
    // token again (RemoteTokenLatch: reason.remote.foreign and reason.remote.protocol say so).
    const probe = d.placement === 'remote'
      ? await this.latch.probe(d, (withToken) => ask(withToken ? options : tlsFor(d.origin)))
      : await ask(options);
    // FD-158, DEC-0154 HA-2: an answer on loopback, or a silent listener, is this user's agent only when this user's own
    // process listens on the port.
    const port = d.placement !== 'remote' && (probe.kind !== 'no-answer' || heldButSilent(probe)) ? portOf(d.origin) : null;
    const owner = port === null ? null : await loopbackOwnerOf(port);
    // FD-201: an owner the tables could not tell once (a pid that exited between netstat and ps while launchd restarts the
    // job, a port read between two lists) is not yet another user's program: it becomes `foreign-user` only when it is
    // still unknown at a read UNKNOWN_OWNER_CONFIRM_MS later. Until then the last verdict stands, and the next probe comes
    // soon. A token is never sent on this: every request that carries one asks the owner again (FD-156, FD-168).
    if (owner === 'unknown') {
      t.unknownOwnerSince ??= this.now();
      if (this.now() - t.unknownOwnerSince >= UNKNOWN_OWNER_CONFIRM_MS) t.foreignUser = 'unknown';
    } else {
      t.unknownOwnerSince = null;
      t.foreignUser = owner === false;
    }
    // #region launchd-reads — docs: AGENTS.md#lifecycle
    // launchd is read on every probe while a window shows it. Hidden, a `launchctl print` (a process
    // spawn) runs only when it can change the verdict: the probe missed, the answering pid moved, or
    // launchd's view is older than `launchdRefresh` (a duplicate behind a steady answer).
    if (supervises(this.platform, d.lifecycle.manager) && d.lifecycle.label) {
      const steady = probe.kind === 'answer' && pidBefore === probe.doc.process.pid && t.launchd.managed;
      const fresh = t.launchdAt !== null && this.now() - t.launchdAt < this.intervals.launchdRefresh;
      if (this.visible || !steady || !fresh) {
        const where = this.where(d);
        const s = await this.launchd.status(d.lifecycle.label, where === 'system' ? await this.disabledTable('system') : await disabledTable(), where);
        t.launchd = { managed: true, ...s, ...(where === 'system' ? { domain: 'system' as const } : {}) };
        t.launchdAt = this.now();
      }
    } else if (this.platform === 'linux' && d.lifecycle.manager === 'systemd' && d.lifecycle.unit) {
      // FD-55 (DEC-0057): systemd's MainPID is the supervisor's pid, read on the same cadence as launchd.
      const steady = probe.kind === 'answer' && pidBefore === probe.doc.process.pid && t.launchd.managed;
      const fresh = t.launchdAt !== null && this.now() - t.launchdAt < this.intervals.launchdRefresh;
      if (this.visible || !steady || !fresh) {
        t.launchd = { managed: true, by: 'systemd', ...(await this.systemd.status(d.lifecycle.unit)) };
        t.launchdAt = this.now();
      }
    } else {
      // The Task Scheduler (and no supervisor) gives no pid: a waiting copy is not shown, never an outage.
      t.launchd = { managed: false, loaded: false, pid: null, disabled: false };
    }
    // #endregion launchd-reads
    t.probe = probe;
    if (probe.kind === 'answer') {
      const own = probe.doc.service.id === d.id && probe.doc.service.instance === d.instance;
      if (own) t.usagePath = probe.doc.surfaces.usage?.path ?? null;
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
    // FD-201: an unknown owner not yet confirmed is read again soon, whatever the window.
    if (t.unknownOwnerSince != null && t.foreignUser !== 'unknown') t.nextProbeAt = Math.min(t.nextProbeAt, now + UNKNOWN_OWNER_RECHECK_MS);
    this.observe(t);
    if (probe.kind === 'no-answer') this.checkDown(t, now);
    // #endregion probe-confirmation
  }

  /** What the state is derived from. Until DOWN_AFTER_MISSES probes in a row have failed, a miss
   *  keeps the last answer — unless launchd says that answer is gone (job off, or another pid). */
  private evidence(t: Tracked): { probe: WellKnownResult | null; firstUnansweredAt: number | null } {
    if (t.probe?.kind !== 'no-answer' || t.misses >= DOWN_AFTER_MISSES) return { probe: t.probe, firstUnansweredAt: t.firstUnansweredAt };
    // R-19 (FD-21): a TLS refusal or a redirect is the origin's own verdict, not a slow host — the state
    // vectors already read it as down at once (state.ts); the grace for silence must not hide it.
    if (t.probe.cause === 'tls' || t.probe.cause === 'redirect') return { probe: t.probe, firstUnansweredAt: t.firstUnansweredAt };
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
    // T-5: only a local placement has one process; an online origin may answer from several replicas.
    const pid = t.probe?.kind === 'answer' && snap.state !== 'foreign' && snap.state !== 'foreign-user' && t.entry.descriptor?.placement !== 'remote' ? t.probe.doc.process.pid : null;
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
    if (snap.state === 'foreign-user') {
      this.appEvent(t.entry.key, t, 'service.foreign-user', 'warning', 'app.event.foreignUser');
      this.notify({ kind: 'foreign-user', serviceKey: t.entry.key }, t, 'notify.foreignUser.title', snap.reasons[0]?.code ?? 'reason.foreign.user', snap.reasons[0]?.params ?? {});
    }
  }

  private readonly outageStart = new Map<string, number>();

  // #region log-reason — docs: docs/ux/scenarios.md#scn-012-another-program-answers-on-the-services-port
  // FD-198 (telegram-gateway TG-260): a service that cannot answer as itself (silent, a stranger on its port, two copies)
  // often says why on stderr, which launchd writes to the file its descriptor names in `paths.logs`. The last line of
  // that file, when it was written during this episode, is shown as one more reason and added to the notification on
  // this Mac; never to the operator channel (FD-48 sends the first reason only): a log may carry more than a person
  // should forward. Read only for a local service, at most once per file change.
  private readonly logLines = new Map<string, { mtimeMs: number; size: number; line: string | null }>();

  private logReason(t: Tracked, state: string): Reason | null {
    const d = t.entry.descriptor;
    if (!d || d.placement === 'remote' || !LOG_REASON_STATES.has(state)) return null;
    const since = Math.min(t.firstUnansweredAt ?? Infinity, this.now() - LOG_FRESH_MS) - 60_000;
    for (const p of d.paths?.logs ?? []) {
      const file = expand(p);
      let stat: fs.Stats;
      try { stat = fs.statSync(file); } catch { continue; }
      if (!stat.isFile() || stat.mtimeMs < since) continue;
      let cached = this.logLines.get(file);
      if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
        let line: string | null = null;
        try { line = lastLogLine(tail(file, 20, 16 * 1024)); } catch { /* unreadable: no line */ }
        cached = { mtimeMs: stat.mtimeMs, size: stat.size, line };
        this.logLines.set(file, cached);
      }
      if (cached.line) return { code: 'reason.log', params: { line: cached.line } };
    }
    return null;
  }
  // #endregion log-reason

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
    const d = this.named(t.entry.descriptor, t.entry.key);
    if (d) return displayName(d.name, d.instance);
    return t.probe?.kind === 'answer' ? displayName(t.probe.doc.service.name, t.probe.doc.service.instance) : t.entry.key;
  }

  private appEvent(key: string, t: Tracked, kind: string, level: 'info' | 'notice' | 'warning' | 'error', textKey: string, params: Record<string, string | number> = {}): void {
    const lang = this.o.lang();
    this.o.activity.addAppEvent(key, this.name(t), kind, level, tr(lang, textKey, { name: this.name(t), ...params }));
    this.changed();
  }

  private notify(h: Happening, tracked: Tracked, titleKey: string, bodyKey: string, params: Record<string, string | number>, link?: string): void {
    if (this.isOff(tracked)) return; // FD-123: an agent turned off never alerts, even from a probe already in flight
    if (!shouldNotify(this.o.settings(), h, new Date(this.now()))) return;
    const lang = this.o.lang();
    const name = this.name(tracked);
    // FD-198: the episode's notification says what the service's own log said, when it said something.
    const logged = h.kind === 'down' || h.kind === 'duplicate' || h.kind === 'foreign' || h.kind === 'foreign-user' ? this.logReason(tracked, h.kind) : null;
    const body = [tr(lang, bodyKey, { name, ...params }), logged ? tr(lang, logged.code, logged.params) : ''].filter(Boolean).join(' ');
    this.emit('notify', { serviceKey: h.serviceKey, title: tr(lang, titleKey, { name, ...params }), body, link, target: 'service' } satisfies Notice);
  }

  // --- events feed ----------------------------------------------------------------
  async pollEvents(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    const now = this.now();
    this.lastPollAt = now;
    try {
      // An online service's feed is read no faster than `remote`, like its probe.
      const due = [...this.tracked.values()].filter((t) => !this.isOff(t)).filter((t) => t.entry.descriptor?.placement !== 'remote' || t.polledAt === null || now - t.polledAt >= this.intervals.remote - MIN_WAKE_MS);
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
    if (!d || t.probe?.kind !== 'answer' || ['foreign', 'foreign-user'].includes(this.snapshotOf(t).state)) { t.feedError = null; return; }
    t.polledAt = this.now();
    const path = t.probe.doc.surfaces.events.path;
    let token: string;
    try {
      token = await this.token(d.auth.tokenFile);
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
        // FD-125: a decision the agent waits for also goes to the operator channel, whatever the banner rules say;
        // the channel's sender applies the person's own rules (pause, quiet hours, a muted agent) when it sends.
        if (intent === 'ask') this.emit('ask', { serviceKey: t.entry.key, name: this.name(t), id: e.id, at: Date.parse(e.at) || now, text: e.text, link: e.link ?? null, episode: episodeKey({ key: t.entry.key, id: d.id }, e) } satisfies AskNotice);
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
    // FD-20: the sequence is src/core/control.ts's, shared with the MCP tool; here it becomes a Reason
    // and the tracked state the window shows.
    const oldPid = t.probe?.kind === 'answer' ? t.probe.doc.process.pid : null;
    const out = await controlService(d, action, {
      elsewhere: this.elsewhere(t),
      systemDaemon: this.where(d) === 'system',
      platform: this.platform,
      launchd: this.launchd,
      wellKnown: (origin) => fetchWellKnown(origin, 1500),
      now: () => this.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      onLaunch: () => {
        t.busy = action === 'restart' ? 'restarting' : action === 'stop' ? 'stopping' : 'starting';
        this.changed();
      },
    }, { oldPid, duplicate: t.lastState === 'duplicate' });
    switch (out.kind) {
      case 'refused':
        if (out.why === 'unsupervised-here') return finish(false, { code: 'result.unsupervisedHere', params: { name } });
        if (out.why === 'plist-missing') return finish(false, { code: 'result.plistMissing', params: { name, path: out.plist } });
        if (out.why === 'placed-elsewhere') return finish(false, { code: 'result.placedElsewhere', params: { name, machine: out.machine } });
        if (out.why === 'system-daemon') return finish(false, { code: 'result.systemDaemon', params: { name } });
        if (out.why === 'not-here') return finish(false, { code: 'result.notHere', params: { name, machine: out.machine } });
        return finish(false, { code: 'result.unmanaged', params: { name } });
      case 'launchctl-failed':
        return finish(false, { code: 'result.launchctl', params: { detail: out.detail } });
      case 'stopped': {
        t.probe = out.probe;
        t.firstUnansweredAt = null;
        t.misses = 0;
        t.lastAnswer = null;
        const s = await this.launchd.status(d.lifecycle.label!);
        t.launchd = { managed: true, ...s };
        t.lastState = 'stopped';
        return finish(true, { code: 'result.stopped', params: { name } });
      }
      case 'answered':
        t.probe = out.probe;
        t.firstUnansweredAt = null;
        t.lastAnswerAt = this.now();
        t.misses = 0;
        t.lastAnswer = out.probe;
        t.downNotified = false;
        t.lastPid = out.pid;
        if (action === 'restart') this.emit('restarted', key); // its page's session may be gone: the page offers Reload
        return finish(true, { code: action === 'restart' ? 'result.restarted' : 'result.started', params: { name, pid: out.pid } });
      case 'stray-holds':
        return finish(false, { code: 'result.strayHolds', params: { name, pid: out.pid, port: out.port } });
      case 'still-answering':
        return finish(false, { code: 'result.stillAnswering', params: { name } });
      default:
        return finish(false, { code: 'result.timeout', params: { name } });
    }
  }

  async command(key: string, which: 'doctor' | 'update'): Promise<CommandResult & { refused?: string }> {
    const t = this.tracked.get(key);
    const argv = t?.entry.descriptor?.commands?.[which];
    if (!t || !argv) return { code: null, output: '', timedOut: false, refused: tr(this.o.lang(), 'result.noCommand', { command: tr(this.o.lang(), `command.${which}`) }) };
    if (t.busy) return { code: null, output: '', timedOut: false, refused: tr(this.o.lang(), 'result.busy', { name: this.name(t) }) };
    t.busy = which === 'doctor' ? 'doctor' : 'updating'; // R-8: taken before anything is awaited, so a second press is refused
    this.changed();
    // FD-200: an agent placed on another machine runs its command there, by whoever may edit there; never here.
    const expanded = argv.map((a, i) => (i === 0 ? expand(a) : a));
    const place = await placeCommand({ elsewhere: this.elsewhere(t), origin: t.entry.descriptor!.origin, argv: expanded, home: os.homedir(), key, which,
      jobs: this.o.launchJobs ?? userLaunchJobs, probe: this.o.remoteProbe ?? execRunner });
    if (place.kind === 'refused') {
      t.busy = null;
      this.changed();
      return { code: null, output: '', timedOut: false, refused: tr(this.o.lang(), place.code, { name: this.name(t), machine: place.machine, command: tr(this.o.lang(), `command.${which}`) }) };
    }
    const [cmd, ...args] = place.kind === 'there' ? place.argv : expanded;
    // Its own process group, the descriptor-safe environment, killed with the group on timeout or quit (LC-02).
    const result = await runOwned(cmd!, args, { timeoutMs: COMMAND_TIMEOUT_MS });
    t.busy = null;
    const name = this.name(t);
    const command = tr(this.o.lang(), `command.${which}`);
    // P-4, T-6: a command that could not start says so; one ended by a signal names the signal.
    const reason: Reason = commandReason(result, command);
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
      launchd: t.launchd, probe: seen.probe, firstUnansweredAt: seen.firstUnansweredAt, now: this.now(), busy: t.busy, elsewhere: this.elsewhere(t), foreignUser: t.foreignUser,
    });
    // P-12: an unreadable token file is a problem of this computer's file, not of the descriptor.
    if (t.tokenProblem && state === 'invalid' && !t.entry.problems.length) reasons.splice(0, reasons.length, { code: 'reason.token', params: { problem: t.tokenProblem } });
    // S-5: what another program says about itself is never shown as this service's own.
    const wk = seen.probe?.kind === 'answer' && state !== 'foreign' && state !== 'foreign-user' ? seen.probe.doc : null;
    if (wk?.update?.available) reasons.push({ code: 'reason.update', params: { version: wk.update.available } });
    const logged = this.logReason(t, state); // FD-198
    if (logged) reasons.push(logged);
    // FD-135: a name from the agent's repository replaces its own everywhere a name is read; its own is kept beside it.
    const descriptor = this.named(t.entry.descriptor, t.entry.key);
    const renamed = descriptor !== t.entry.descriptor && t.entry.descriptor;
    return {
      key: t.entry.key, descriptorPath: t.entry.path, descriptor, ...(renamed ? { agentName: renamed.name } : {}), ...this.organized(t), problems: t.tokenProblem ? [...t.entry.problems, t.tokenProblem] : t.entry.problems, state, reasons,
      wellKnown: wk && renamed ? { ...wk, service: { ...wk.service, name: descriptor!.name } } : wk, dashboardMinWidth: dashboardMinWidth(wk), launchd: t.launchd, usagePath: t.usagePath,
      firstUnansweredAt: t.firstUnansweredAt ? new Date(t.firstUnansweredAt).toISOString() : null,
      lastAnswerAt: t.lastAnswerAt ? new Date(t.lastAnswerAt).toISOString() : null,
      busy: t.busy, lastAction: t.lastAction, latestEvent: this.o.activity.latest(t.entry.key), feedError: t.feedError,
    };
  }

  /** The services the app watches. FD-123: an agent turned off is not among them (offServices names it), so no count,
   *  badge, tray entry, outage alert or spend read sees a state nobody measured. */
  snapshots(): ServiceSnapshot[] {
    return [...this.tracked.values()].filter((t) => !this.isOff(t)).map((t) => this.snapshotOf(t)).sort((a, b) => (a.descriptor?.name ?? a.key).localeCompare(b.descriptor?.name ?? b.key));
  }

  snapshot(key: string): ServiceSnapshot | null {
    const t = this.tracked.get(key);
    return t && !this.isOff(t) ? this.snapshotOf(t) : null;
  }

  // #region agent-off — docs: docs/ux/scenarios.md#scn-072-hide-an-agent-without-stopping-it
  /** FD-123: the product ids turned off, as the settings say now (an agent's MCP `arrange` writes them too). */
  private offIds(): ReadonlySet<string> {
    return new Set(this.o.settings().layout.list.off ?? []);
  }

  private isOff(t: Tracked): boolean {
    return this.offIds().has(productIdOf(t.entry.key));
  }

  private wasOff: ReadonlySet<string> = new Set();

  /** An agent turned back on starts from nothing: no stale outage, no old feed replayed as news, probed at once. */
  private syncOff(): void {
    const off = this.offIds();
    for (const t of this.tracked.values()) {
      const id = productIdOf(t.entry.key);
      if (!this.wasOff.has(id) || off.has(id)) continue;
      Object.assign(t, {
        probe: null, firstUnansweredAt: null, misses: 0, lastAnswer: null, nextProbeAt: this.now(), backoff: 0, feedError: null,
        downNotified: false, lastState: null, baselined: false, launchdAt: null, polledAt: null,
        launchd: { managed: supervises(this.platform, t.entry.descriptor?.lifecycle.manager), loaded: true, pid: null, disabled: false },
      } satisfies Partial<Tracked>);
      this.outageStart.delete(t.entry.key);
    }
    this.wasOff = off;
  }

  /** FD-123: the services of agents turned off: on disk, never probed; the window lists them greyed in Hidden. */
  offServices(): { key: string; product: string; name: string }[] {
    return [...this.tracked.values()].filter((t) => this.isOff(t))
      .map((t) => ({ key: t.entry.key, product: productIdOf(t.entry.key), name: this.named(t.entry.descriptor, t.entry.key)?.name ?? t.entry.key }))
      .sort((a, b) => a.name.localeCompare(b.name) || (a.key < b.key ? -1 : 1));
  }

  /** The list layout changed (the window, or settings written outside the app): apply who is off now. */
  listChanged(): void {
    this.syncOff();
    this.changed();
    this.schedule(0);
  }
  // #endregion agent-off

  // #region agent-names — docs: docs/adr/0026-agent-names-in-their-repositories.md#decision
  /** FD-135: the descriptor with the name its repository gives it, or itself when there is none. */
  private named<D extends { name: string; source?: { repository?: string } } | null>(d: D, key: string): D {
    const custom = d && this.o.customName?.(key, d.source?.repository);
    return d && custom && custom !== d.name ? { ...d, name: custom } : d;
  }

  /** FD-162: the agent's organization, or nothing when no map was ever read. */
  private organized(t: Tracked): { organization?: Organization | null } {
    const d = t.entry.descriptor;
    const org = this.o.organizationOf?.({ key: t.entry.key, repository: d?.source?.repository, placement: d?.placement, origin: d?.origin });
    return org === undefined ? {} : { organization: org };
  }

  /** A name changed in an agent's repository (read, or renamed here): show it now. */
  namesChanged(): void {
    this.changed();
    this.schedule(0);
  }
  // #endregion agent-names

  meta(): { servicesDir: string; dirError: string | null; scanning: boolean } {
    return { servicesDir: this.o.servicesDir, dirError: this.dirError, scanning: this.scanning };
  }
}

// #region log-reason — docs: docs/ux/scenarios.md#scn-012-another-program-answers-on-the-services-port
/** FD-198: the states a service's own log may explain, and how recent its last write must be to count for this episode. */
export const LOG_REASON_STATES: ReadonlySet<string> = new Set(['down', 'foreign', 'foreign-user', 'duplicate']);
export const LOG_FRESH_MS = 15 * 60_000;
const LOG_LINE_MAX = 240;

/** FD-198: the last non-empty line of a log's tail, without terminal colours or control characters, at most 240 characters. */
export function lastLogLine(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim());
  const last = lines.reverse().find((l) => l.length > 0);
  if (!last) return null;
  return last.length > LOG_LINE_MAX ? `${last.slice(0, LOG_LINE_MAX - 1)}…` : last;
}
// #endregion log-reason
