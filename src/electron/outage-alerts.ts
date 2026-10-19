// #region outage-alerts — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48
// FD-48: the shared watcher's sender. Every monitor change and every 30 s it looks at the services
// (src/core/outage-alerts.ts `observe`), sends what the state owes (`owed`) in order, and records a message as
// delivered only when the channel answered (`delivered`). The state is the queue and lives in `outage-alerts.json`,
// so a failed delivery, a missing channel or a restart loses nothing. Banners stay on the Mac (FD-76, the operator's
// rule of 2026-10-19 for the Telegram channel: only an outage over 15 minutes and its recovery, no routine).
import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite } from '../core/fsutil';
import { callCapability } from '../core/mcp-client';
import { chooseChannel, delivered, emptyOutageState, notifyChannelOf, observe, owed, watchedOf, type AlertMessage, type OutageState, type Words } from '../core/outage-alerts';
import { authHeaders, readTokenAsync } from '../core/probe';
import type { AppStatus, ServiceSnapshot, Settings } from '../core/types';

const FILE = 'outage-alerts.json';
const TICK_MS = 30_000;
const RETRY_MS = 60_000;

export class OutageAlerts {
  private state: OutageState;
  private interval: NodeJS.Timeout | null = null;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private sending = false;
  /** When each outage message may be tried again (a failed try waits RETRY_MS). */
  private retryAt = new Map<string, number>();
  private last: NonNullable<AppStatus['alerts']>['last'];

  constructor(private readonly o: {
    dataDir: string;
    snapshots: () => ServiceSnapshot[];
    settings: () => Settings;
    words: () => Words;
    nameOf: (s: ServiceSnapshot) => string;
    reasonOf: (s: ServiceSnapshot) => string;
    allowed: (key: string, now: Date) => boolean;
    version: string;
    log: (line: string) => void;
    changed: () => void;
    now?: () => number;
  }) {
    this.state = this.load();
  }

  private now(): number { return (this.o.now ?? Date.now)(); }
  private file(): string { return path.join(this.o.dataDir, FILE); }

  /** The saved state, else its last good copy; a damaged file is said in the log, never silently reset. */
  private load(): OutageState {
    for (const file of [this.file(), `${this.file()}.bak`]) {
      let text: string;
      try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
      try {
        const raw = JSON.parse(text) as Partial<OutageState>;
        if (typeof raw.baselines === 'object' && raw.baselines && typeof raw.episodes === 'object' && raw.episodes) return { baselines: raw.baselines, episodes: raw.episodes };
        this.o.log(`alerts: ${path.basename(file)} has no episodes; ignored`);
      } catch (error) {
        this.o.log(`alerts: ${path.basename(file)} is damaged (${(error as Error).message}); trying its copy`);
      }
    }
    return emptyOutageState();
  }

  private save(next: OutageState): void {
    if (JSON.stringify(next) === JSON.stringify(this.state)) return;
    this.state = next;
    try {
      if (fs.existsSync(this.file())) fs.copyFileSync(this.file(), `${this.file()}.bak`);
      atomicWrite(this.file(), `${JSON.stringify(next)}\n`, 0o600);
    } catch (error) {
      this.o.log(`alerts: ${FILE} could not be written: ${(error as Error).message}`);
    }
  }

  start(): void {
    this.interval = setInterval(() => this.tick(), TICK_MS);
    this.interval.unref();
  }

  /** Nothing is sent once the app quits. */
  stop(): void {
    this.stopped = true;
    if (this.interval) clearInterval(this.interval);
    if (this.timer) clearTimeout(this.timer);
    this.interval = null;
    this.timer = null;
  }

  /** Look at the services now (a monitor change or the 30-second tick), then send what is owed. */
  tick(): void {
    if (this.stopped) return;
    try {
      const services = this.o.snapshots().filter((s) => s.descriptor).map((s) => watchedOf(s, this.o.nameOf(s), this.o.reasonOf(s)));
      this.save(observe(this.state, services, this.now()));
    } catch (error) {
      this.o.log(`alerts: the look failed: ${(error as Error).message}`);
    }
    this.schedule(0);
  }

  status(): NonNullable<AppStatus['alerts']> {
    const services = this.o.snapshots();
    const chosen = chooseChannel(services, this.o.settings().notifications.channel);
    const candidates = services.map(notifyChannelOf).filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => c.key);
    const base = { candidates, ...(this.last ? { last: this.last } : {}) };
    return 'none' in chosen ? { channel: null, none: chosen.none, ...base } : { channel: { key: chosen.key, capability: chosen.capability }, ...base };
  }

  private schedule(ms: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, ms);
    this.timer.unref();
  }

  private async deliver(channel: { key: string; origin: string; path: string; capability: string }, msg: AlertMessage): Promise<void> {
    const snap = this.o.snapshots().find((s) => s.key === channel.key);
    const tokenFile = snap?.descriptor?.auth.tokenFile;
    const headers = tokenFile ? authHeaders(snap!.descriptor!, await readTokenAsync(tokenFile)) : {};
    const { serviceKey: _key, ...args } = msg;
    await callCapability({ origin: channel.origin, path: channel.path, headers }, channel.capability, { ...args, subject: args.subject.slice(0, 160), text: args.text.slice(0, 3500) }, this.o.version);
  }

  private failed(msg: AlertMessage, via: string, error: unknown): void {
    const text = (error as Error).message.replace(/\s+/g, ' ').slice(0, 300);
    this.o.log(`alerts: ${msg.eventId} not delivered via ${via}: ${text}`);
    this.last = { at: new Date(this.now()).toISOString(), ok: false, subject: msg.subject, error: text };
  }

  /** Send what is owed, oldest first; the first failure stops the round, so nothing is told out of order. */
  private async flush(): Promise<void> {
    if (this.sending || this.stopped) return;
    this.sending = true;
    let more = false;
    try {
      const now = this.now();
      const due = owed(this.state, now, this.o.words(), (key) => this.o.allowed(key, new Date(now)));
      const outages = due.filter((d) => (this.retryAt.get(d.msg.eventId) ?? 0) <= now);
      more = due.length > outages.length;
      if (!outages.length) return;
      const channel = chooseChannel(this.o.snapshots(), this.o.settings().notifications.channel);
      if ('none' in channel) {
        // No channel now (its service between restarts, say): everything waits. `off` owes nothing to wait for.
        if (channel.none !== 'off') { more = true; this.o.log(`alerts: ${outages.length} message(s) wait: no channel (${channel.none})`); }
        return;
      }
      for (const d of outages) {
        if (this.stopped) return;
        try {
          await this.deliver(channel, d.msg);
        } catch (error) {
          this.retryAt.set(d.msg.eventId, this.now() + RETRY_MS);
          this.failed(d.msg, channel.key, error);
          more = true;
          return;
        }
        this.save(delivered(this.state, d.id, d.step));
        this.retryAt.delete(d.msg.eventId);
        this.o.log(`alerts: sent ${d.msg.kind} ${d.msg.eventId} via ${channel.key}`);
        this.last = { at: new Date(this.now()).toISOString(), ok: true, subject: d.msg.subject };
      }
    } catch (error) {
      more = true;
      this.o.log(`alerts: the round failed: ${(error as Error).message}`);
    } finally {
      this.sending = false;
      this.o.changed();
      if (more) this.schedule(RETRY_MS);
    }
  }
}
// #endregion outage-alerts
