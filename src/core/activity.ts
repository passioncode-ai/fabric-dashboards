// The merged activity feed: every service's events plus the app's own, kept
// in the app's data directory so a restart neither loses nor repeats them.
// #region activity-store — docs: AGENTS.md#lifecycle
// Bounded and quiet on disk (lifecycle LC-08, LC-12): new rows are appended, never a rewrite of the
// whole feed; the file is compacted to the newest KEEP rows once it holds twice that; the small
// state (cursors, last seen, the app's id counter) is written on a debounce and on flush(). A crash
// between an append and the state write is safe: the next poll re-reads the page from the older
// cursor and the ids already on disk drop the repeats; the id counter resumes past every app id on
// disk.
import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite, readJson } from './fsutil';
import type { ActivityItem, ServiceEvent } from './types';

const KEEP = 5000;
const STATE_DELAY_MS = 2000;

export interface ActivityOptions {
  keep?: number;
  stateDelayMs?: number;
  /** R-1: a write that failed (a full disk). The store keeps the rows in memory and rewrites the file once a write succeeds; it never throws. */
  onWriteError?: (message: string) => void;
}

export class ActivityStore {
  private items: ActivityItem[] = [];
  private cursors: Record<string, string | null> = {};
  private lastSeen = '';
  private appCounter = 0;
  private fileRows = 0; // rows in activity.jsonl, compacted or appended
  private stateTimer: NodeJS.Timeout | null = null;
  private rev = 0;
  private readonly file: string;
  private readonly stateFile: string;
  private readonly keep: number;
  private readonly stateDelayMs: number;
  private readonly onWriteError: (message: string) => void;
  /** The file on disk is behind the rows in memory (a failed write): the next write compacts instead of appending. */
  private dirty = false;

  constructor(dir: string, options: ActivityOptions = {}) {
    this.keep = options.keep ?? KEEP;
    this.stateDelayMs = options.stateDelayMs ?? STATE_DELAY_MS;
    this.onWriteError = options.onWriteError ?? (() => undefined);
    this.file = path.join(dir, 'activity.jsonl');
    this.stateFile = path.join(dir, 'activity-state.json');
    const state = readJson<{ cursors?: Record<string, string | null>; lastSeen?: string; appCounter?: number }>(this.stateFile, {});
    this.cursors = state.cursors ?? {};
    this.lastSeen = state.lastSeen ?? '';
    this.appCounter = state.appCounter ?? 0;
    let text = '';
    try { text = fs.readFileSync(this.file, 'utf8'); } catch { /* first run */ }
    let torn = false;
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { this.items.push(JSON.parse(line) as ActivityItem); } catch { torn = true; /* a torn line is skipped */ }
    }
    this.fileRows = this.items.length;
    for (const i of this.items) {
      const n = i.source === 'app' ? /^app-(\d+)$/.exec(i.id) : null;
      if (n) this.appCounter = Math.max(this.appCounter, Number(n[1]));
    }
    const before = this.items.length;
    this.sort();
    // A torn line, or a file past its bound, is rewritten once now, so appends land on a clean end.
    if (torn || (text.length > 0 && !text.endsWith('\n')) || before > this.keep * 2) this.compact();
  }

  private sort(): void {
    this.items.sort((a, b) => (a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? -1 : 1));
    if (this.items.length > this.keep) this.items = this.items.slice(-this.keep);
  }

  private compact(): void {
    try {
      atomicWrite(this.file, this.items.length ? this.items.map((i) => JSON.stringify(i)).join('\n') + '\n' : '');
      this.fileRows = this.items.length;
      this.dirty = false;
    } catch (error) {
      this.dirty = true;
      this.onWriteError(`activity: could not rewrite ${path.basename(this.file)}: ${(error as Error).message}`);
    }
  }

  /**
   * Append rows; past 2 × keep rows, or after a failed write, the file is compacted instead.
   * Never throws (R-1): a full disk loses no notification and no cursor move — the rows stay in
   * memory and reach the file with the next write that succeeds.
   */
  private append(rows: ActivityItem[]): void {
    if (!rows.length) return;
    if (this.dirty || this.fileRows + rows.length > this.keep * 2) return this.compact();
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
      const fd = fs.openSync(this.file, 'a', 0o600);
      try {
        const data = Buffer.from(rows.map((i) => JSON.stringify(i)).join('\n') + '\n', 'utf8');
        let at = 0;
        while (at < data.length) at += fs.writeSync(fd, data, at, data.length - at); // a short write is finished, not torn
      } finally {
        fs.closeSync(fd);
      }
      this.fileRows += rows.length;
    } catch (error) {
      this.dirty = true; // what reached the file may end mid-line: the next write rewrites it whole
      this.onWriteError(`activity: could not append to ${path.basename(this.file)}: ${(error as Error).message}`);
    }
  }

  private touched(): void {
    this.rev += 1;
    if (this.stateTimer) return;
    this.stateTimer = setTimeout(() => { this.stateTimer = null; this.writeState(); }, this.stateDelayMs);
    this.stateTimer.unref?.();
  }

  private writeState(): void {
    try {
      atomicWrite(this.stateFile, JSON.stringify({ cursors: this.cursors, lastSeen: this.lastSeen, appCounter: this.appCounter }));
    } catch { /* a full disk loses a cursor, which only re-reads a page; never the app */ }
  }

  /** Write pending state now — on quit, and before another reader opens the same directory. */
  flush(): void {
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.stateTimer = null;
    this.writeState();
  }

  /** Grows on every change a person could see (rows, unread). */
  get revision(): number {
    return this.rev;
  }

  cursor(serviceKey: string): string | null {
    return this.cursors[serviceKey] ?? null;
  }

  /** Add a page from one service; returns the events that were new. Duplicates by id are dropped. */
  addServiceEvents(serviceKey: string, serviceName: string, events: ServiceEvent[], cursor: string | null): ActivityItem[] {
    const known = new Set(this.items.filter((i) => i.serviceKey === serviceKey && i.source === 'service').map((i) => i.id));
    const fresh = events.filter((e) => !known.has(e.id)).map((e) => ({ ...e, serviceKey, serviceName, source: 'service' as const }));
    if (!fresh.length && this.cursors[serviceKey] === cursor) return fresh; // nothing new: nothing written
    this.items.push(...fresh);
    this.cursors[serviceKey] = cursor;
    this.sort();
    this.append(fresh);
    this.touched();
    return fresh;
  }

  /** Record something the app itself observed or did. */
  addAppEvent(serviceKey: string, serviceName: string, kind: string, level: ServiceEvent['level'], text: string): ActivityItem {
    this.appCounter += 1;
    const item: ActivityItem = { id: `app-${this.appCounter}`, at: new Date().toISOString(), kind, level, text, serviceKey, serviceName, source: 'app' };
    this.items.push(item);
    this.sort();
    this.append([item]);
    this.touched();
    return item;
  }

  list(filter: { serviceKey?: string; minLevel?: ServiceEvent['level'] } = {}, limit = 500): ActivityItem[] {
    const levels = ['info', 'notice', 'warning', 'error'];
    const min = filter.minLevel ? levels.indexOf(filter.minLevel) : 0;
    return this.items
      .filter((i) => (!filter.serviceKey || i.serviceKey === filter.serviceKey) && levels.indexOf(i.level) >= min)
      .slice(-limit)
      .reverse();
  }

  latest(serviceKey: string): ActivityItem | null {
    for (let i = this.items.length - 1; i >= 0; i -= 1) if (this.items[i]!.serviceKey === serviceKey && this.items[i]!.source === 'service') return this.items[i]!;
    return null;
  }

  unread(): number {
    return this.items.filter((i) => i.at > this.lastSeen && i.level !== 'info').length;
  }

  markSeen(): void {
    this.lastSeen = new Date().toISOString();
    this.touched();
  }
}
// #endregion activity-store
