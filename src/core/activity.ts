// The merged activity feed: every service's events plus the app's own, kept
// in the app's data directory so a restart neither loses nor repeats them.
import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite, readJson } from './fsutil';
import type { ActivityItem, ServiceEvent } from './types';

const KEEP = 5000;

export class ActivityStore {
  private items: ActivityItem[] = [];
  private cursors: Record<string, string | null> = {};
  private lastSeen = '';
  private appCounter = 0;
  private readonly file: string;
  private readonly stateFile: string;

  constructor(dir: string) {
    this.file = path.join(dir, 'activity.jsonl');
    this.stateFile = path.join(dir, 'activity-state.json');
    const state = readJson<{ cursors?: Record<string, string | null>; lastSeen?: string; appCounter?: number }>(this.stateFile, {});
    this.cursors = state.cursors ?? {};
    this.lastSeen = state.lastSeen ?? '';
    this.appCounter = state.appCounter ?? 0;
    try {
      for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try { this.items.push(JSON.parse(line) as ActivityItem); } catch { /* a torn last line is skipped */ }
      }
    } catch { /* first run */ }
    this.sort();
  }

  private sort(): void {
    this.items.sort((a, b) => (a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? -1 : 1));
    if (this.items.length > KEEP) this.items = this.items.slice(-KEEP);
  }

  private persist(): void {
    atomicWrite(this.file, this.items.map((i) => JSON.stringify(i)).join('\n') + '\n');
    atomicWrite(this.stateFile, JSON.stringify({ cursors: this.cursors, lastSeen: this.lastSeen, appCounter: this.appCounter }));
  }

  cursor(serviceKey: string): string | null {
    return this.cursors[serviceKey] ?? null;
  }

  /** Add a page from one service; returns the events that were new. Duplicates by id are dropped. */
  addServiceEvents(serviceKey: string, serviceName: string, events: ServiceEvent[], cursor: string | null): ActivityItem[] {
    const known = new Set(this.items.filter((i) => i.serviceKey === serviceKey && i.source === 'service').map((i) => i.id));
    const fresh = events.filter((e) => !known.has(e.id)).map((e) => ({ ...e, serviceKey, serviceName, source: 'service' as const }));
    this.items.push(...fresh);
    this.cursors[serviceKey] = cursor;
    this.sort();
    this.persist();
    return fresh;
  }

  /** Record something the app itself observed or did. */
  addAppEvent(serviceKey: string, serviceName: string, kind: string, level: ServiceEvent['level'], text: string): ActivityItem {
    this.appCounter += 1;
    const item: ActivityItem = { id: `app-${this.appCounter}`, at: new Date().toISOString(), kind, level, text, serviceKey, serviceName, source: 'app' };
    this.items.push(item);
    this.sort();
    this.persist();
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
    this.persist();
  }
}
