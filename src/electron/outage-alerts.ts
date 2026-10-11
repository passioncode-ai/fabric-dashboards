// #region outage-alerts — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48
// FD-48: the shared watcher's sender. It steps the episodes (src/core/outage-alerts.ts) on every monitor change and
// every 30 s, keeps their state across restarts, and delivers each message to the operator-channel service with
// retries — one eventId per episode and step, so a retry never doubles a message. Failed and attention banners from
// an events feed (ADR-0010) are forwarded the same way. Nothing is sent while no channel is chosen or found.
import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite } from '../core/fsutil';
import { callCapability } from '../core/mcp-client';
import { chooseChannel, emptyOutageState, notifyChannelOf, stepOutages, watchedOf, type AlertMessage, type OutageState, type Words } from '../core/outage-alerts';
import type { Notice } from '../core/monitor';
import { authHeaders, readTokenAsync } from '../core/probe';
import type { AppStatus, ServiceSnapshot, Settings } from '../core/types';

const FILE = 'outage-alerts.json';
const TICK_MS = 30_000;
const RETRY_MS = 60_000;
const MAX_TRIES = 5;

export class OutageAlerts {
  private state: OutageState;
  private timer: NodeJS.Timeout | null = null;
  private queue: { msg: AlertMessage; tries: number; due: number }[] = [];
  private sending = false;
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

  private load(): OutageState {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(this.o.dataDir, FILE), 'utf8')) as Partial<OutageState>;
      return { baselines: typeof raw.baselines === 'object' && raw.baselines ? raw.baselines : {}, open: typeof raw.open === 'object' && raw.open ? raw.open : {} };
    } catch { return emptyOutageState(); }
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
  }

  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  /** Step the episodes now (a monitor change or the 30-second tick). */
  tick(): void {
    const now = this.now();
    const services = this.o.snapshots().filter((s) => s.descriptor).map((s) => watchedOf(s, this.o.nameOf(s), this.o.reasonOf(s)));
    const { state, messages } = stepOutages(this.state, services, now, this.o.words(), (key) => this.o.allowed(key, new Date(now)));
    if (JSON.stringify(state) !== JSON.stringify(this.state)) {
      this.state = state;
      try { atomicWrite(path.join(this.o.dataDir, FILE), `${JSON.stringify(state)}\n`, 0o600); } catch (error) { this.o.log(`alerts: ${FILE} could not be written: ${(error as Error).message}`); }
    }
    for (const msg of messages) this.queue.push({ msg, tries: 0, due: now });
    void this.flush();
  }

  /** ADR-0010's failed and attention banners go to the channel too; asks stay on the Mac (a question needs its own record). */
  notice(n: Notice): void {
    if (n.intent !== 'failed' && n.intent !== 'attention') return;
    const now = this.now();
    this.queue.push({ msg: { serviceKey: n.serviceKey, kind: n.intent === 'failed' ? 'failure' : 'result', eventId: `notice:${n.serviceKey}:${now}`, subject: `${n.title}: ${n.subtitle ?? ''}`.trim(), text: n.body }, tries: 0, due: now });
    void this.flush();
  }

  status(): NonNullable<AppStatus['alerts']> {
    const services = this.o.snapshots();
    const chosen = chooseChannel(services, this.o.settings().notifications.channel);
    const candidates = services.map(notifyChannelOf).filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => c.key);
    const base = { candidates, ...(this.last ? { last: this.last } : {}) };
    if (!chosen) return { channel: null, ...base };
    if ('none' in chosen) return { channel: null, none: chosen.none, ...base };
    return { channel: { key: chosen.key, capability: chosen.capability }, ...base };
  }

  private async flush(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.queue.length) {
        const item = this.queue[0]!;
        if (item.due > this.now()) { setTimeout(() => void this.flush(), item.due - this.now()).unref(); break; }
        const services = this.o.snapshots();
        const channel = chooseChannel(services, this.o.settings().notifications.channel);
        if (!channel || 'none' in channel) { this.o.log(`alerts: not sent ${item.msg.eventId}: no channel (${channel && 'none' in channel ? channel.none : '?'})`); this.queue.shift(); continue; }
        const snap = services.find((s) => s.key === channel.key)!;
        try {
          const tokenFile = snap.descriptor?.auth.tokenFile;
          const headers = tokenFile ? authHeaders(snap.descriptor!, await readTokenAsync(tokenFile)) : {};
          const { serviceKey: _key, ...args } = item.msg;
          await callCapability({ origin: channel.origin, path: channel.path, headers }, channel.capability, { ...args, subject: args.subject.slice(0, 160), text: args.text.slice(0, 3500) }, this.o.version);
          this.o.log(`alerts: sent ${item.msg.kind} ${item.msg.eventId} via ${channel.key}`);
          this.last = { at: new Date(this.now()).toISOString(), ok: true, subject: item.msg.subject };
          this.queue.shift();
        } catch (error) {
          const text = (error as Error).message.replace(/\s+/g, ' ').slice(0, 300);
          item.tries += 1;
          this.o.log(`alerts: ${item.msg.eventId} failed (try ${item.tries} of ${MAX_TRIES}) via ${channel.key}: ${text}`);
          this.last = { at: new Date(this.now()).toISOString(), ok: false, subject: item.msg.subject, error: text };
          if (item.tries >= MAX_TRIES) this.queue.shift();
          else { item.due = this.now() + RETRY_MS; this.queue.push(this.queue.shift()!); }
        }
        this.o.changed();
      }
    } finally {
      this.sending = false;
    }
  }
}
// #endregion outage-alerts
