// #region outage-alerts — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48
// FD-48: the shared watcher's sender. Every monitor change and every 30 s it looks at the services
// (src/core/outage-alerts.ts `observe`), sends what the state owes (`owed`) in order, and records a message as
// delivered only when the channel answered (`delivered`). The state is the queue and lives in `outage-alerts.json`,
// so a failed delivery, a missing channel or a restart loses nothing. Banners stay on the Mac (FD-76, the operator's
// rule of 2026-10-19 for the Telegram channel: only an outage over 15 minutes and its recovery, no routine).
import fs from 'node:fs';
import path from 'node:path';
import { healthDelivered, observeHealth, owedHealth } from '../core/agent-health';
import { atomicWrite } from '../core/fsutil';
import { callCapability } from '../core/mcp-client';
import { askDelivered, askIdOf, chooseChannel, HELD_RETRY_MS, heldRefusal, notifyArguments, sideOf, delivered, emptyOutageState, enqueueAsk, notifyChannelOf, observe, owed, owedAsks, watchedOf, type AlertMessage, type Ask, type OutageState, type Words } from '../core/outage-alerts';
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
  /** FD-287: messages the channel refused with a code, and that code; each said once in the log. */
  private held = new Map<string, string>();
  private last: NonNullable<AppStatus['alerts']>['last'];

  constructor(private readonly o: {
    dataDir: string;
    snapshots: () => ServiceSnapshot[];
    settings: () => Settings;
    words: () => Words;
    nameOf: (s: ServiceSnapshot) => string;
    /** FD-285: a product's name in a health message (Switchboard for fabric-switchboard). */
    productName?: (product: string) => string;
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
        if (typeof raw.baselines === 'object' && raw.baselines && typeof raw.episodes === 'object' && raw.episodes) {
          return { baselines: raw.baselines, episodes: raw.episodes, ...(raw.asks && typeof raw.asks === 'object' ? { asks: raw.asks } : {}), ...(raw.health && typeof raw.health === 'object' ? { health: raw.health } : {}) };
        }
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

  // #region operator-asks — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-27-a-decision-reaches-the-operator-away-from-the-mac-fd-125
  /** FD-125: an agent waits for the operator's decision (an events-feed row with `notify` whose intent is `ask`):
   *  queue it for the channel, once per event, and send it now if the person's rules allow. */
  ask(serviceKey: string, eventId: string, ask: Omit<Ask, 'delivered' | 'serviceKey' | 'side'>): void {
    if (this.stopped) return;
    const side = sideOf(this.o.snapshots().find((s) => s.key === serviceKey)?.organization);
    this.save(enqueueAsk(this.state, askIdOf(serviceKey, eventId), { ...ask, serviceKey, side }));
    this.schedule(0);
  }
  // #endregion operator-asks

  /** FD-285: one reading of a product's `agent-health/1` answer (`null`: no answer); an episode it opens or closes
   *  is sent now if the person's rules allow. */
  health(product: string, answer: unknown): void {
    if (this.stopped) return;
    this.save({ ...this.state, health: observeHealth(this.state.health ?? {}, product, answer, this.now()) });
    this.schedule(0);
  }

  /** FD-285: the health book as the MCP `agent_health` reads it. */
  healthBook(): NonNullable<OutageState['health']> { return this.state.health ?? {}; }

  status(): NonNullable<AppStatus['alerts']> {
    const services = this.o.snapshots();
    const chosen = chooseChannel(services, this.o.settings().notifications.channel);
    const candidates = services.map(notifyChannelOf).filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => c.key);
    const held = [...new Set(this.held.values())];
    const base = { candidates, ...(this.last ? { last: this.last } : {}), ...(this.held.size ? { held: { count: this.held.size, codes: held } } : {}) };
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
    await callCapability({ origin: channel.origin, path: channel.path, headers }, channel.capability, notifyArguments(msg), this.o.version);
  }

  /** A failed send waits a minute; one the channel refused with a code waits an hour and is logged once (FD-287). */
  private failed(msg: AlertMessage, via: string, error: unknown): void {
    const text = (error as Error).message.replace(/\s+/g, ' ').slice(0, 300);
    const code = heldRefusal(text);
    this.retryAt.set(msg.eventId, this.now() + (code ? HELD_RETRY_MS : RETRY_MS));
    if (!code) {
      this.held.delete(msg.eventId);
      this.o.log(`alerts: ${msg.eventId} not delivered via ${via}: ${text}`);
    } else if (this.held.get(msg.eventId) !== code) {
      this.held.set(msg.eventId, code);
      this.o.log(`alerts: ${msg.eventId} refused by ${via} (${code}); it waits an hour, said once: ${text}`);
    }
    this.last = { at: new Date(this.now()).toISOString(), ok: false, subject: msg.subject, error: text };
  }

  /** Send what is owed, oldest first; the first failure stops the round, so nothing is told out of order. */
  private async flush(): Promise<void> {
    if (this.sending || this.stopped) return;
    this.sending = true;
    let more = false;
    try {
      const now = this.now();
      const allowed = (key: string) => this.o.allowed(key, new Date(now));
      // Outages first, in order; then the decisions agents wait for (FD-125), oldest first.
      const due: { id: string; step: 'failure' | 'recovery' | 'ask' | 'health-failure' | 'health-recovery'; msg: AlertMessage }[] = [
        ...owed(this.state, now, this.o.words(), allowed),
        ...owedAsks(this.state, now, this.o.words(), allowed).map((a) => ({ ...a, step: 'ask' as const })),
        ...healthOwed(this.state.health, this.o.words().health, this.o.productName, allowed),
      ];
      const owedIds = new Set(due.map((d) => d.msg.eventId));
      for (const id of [...this.held.keys()]) if (!owedIds.has(id)) this.held.delete(id);
      const outages = due.filter((d) => (this.retryAt.get(d.msg.eventId) ?? 0) <= now);
      more = due.length > outages.length;
      if (!outages.length) return;
      // FD-269: each message goes only through a channel of its agent's side (`chooseChannel`); a side with no channel
      // now waits (its service between restarts, say). `off` owes nothing to wait for.
      const snapshots = this.o.snapshots();
      const choice = this.o.settings().notifications.channel;
      const waiting = new Map<string, number>();
      const out: Array<typeof outages[number] & { channel: { key: string; origin: string; path: string; capability: string } }> = [];
      for (const d of outages) {
        const now = snapshots.find((s) => s.key === d.msg.serviceKey);
        const side = now ? sideOf(now.organization) : d.msg.side;
        const channel = chooseChannel(snapshots, choice, side);
        if ('none' in channel) { if (channel.none !== 'off') waiting.set(`${side} (${channel.none})`, (waiting.get(`${side} (${channel.none})`) ?? 0) + 1); continue; }
        out.push({ ...d, channel });
      }
      if (waiting.size) { more = true; this.o.log(`alerts: message(s) wait: no channel for ${[...waiting].map(([k, n]) => `${n} of ${k}`).join(', ')}`); }
      // Wave 4 (C-06): one message the channel refuses waits for its own retry, the ones behind it still go; three
      // failures in a row mean the channel itself is out, and the round ends there.
      let failures = 0;
      for (const d of out) {
        const channel = d.channel;
        if (this.stopped) return;
        try {
          await this.deliver(channel, d.msg);
          failures = 0;
        } catch (error) {
          this.failed(d.msg, channel.key, error);
          more = true;
          if (++failures >= 3) return;
          continue;
        }
        this.save(d.step === 'ask' ? askDelivered(this.state, d.id)
          : d.step === 'health-failure' || d.step === 'health-recovery' ? { ...this.state, health: healthDelivered(this.state.health ?? {}, d.id, d.step === 'health-failure' ? 'failure' : 'recovery') }
          : delivered(this.state, d.id, d.step));
        this.retryAt.delete(d.msg.eventId);
        this.held.delete(d.msg.eventId);
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
/** FD-285: what the health book owes, as steps the flush tells apart from FD-48's outages. */
function healthOwed(book: OutageState['health'], words: Words['health'], nameOf: ((product: string) => string) | undefined, allowed: (key: string) => boolean) {
  if (!book || !words) return [];
  return owedHealth(book, words, nameOf ?? ((p) => p), allowed).map((d) => ({ ...d, step: d.step === 'failure' ? 'health-failure' as const : 'health-recovery' as const }));
}
// #endregion outage-alerts
