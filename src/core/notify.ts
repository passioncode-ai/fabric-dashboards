// Whether the operator wants to hear about something now. Pure: the monitor
// decides WHAT happened; this decides whether to raise a notification for it.
import type { ServiceEvent, Settings } from './types';

/** A confirmed outage is notified once its silence, counted from the first missed probe, passes
 *  this — decided by a probe that failed after it, never by the clock alone (ADR-0008). */
export const DOWN_NOTIFY_AFTER_MS = 60_000;

export type Happening =
  | { kind: 'down' | 'back' | 'duplicate' | 'foreign'; serviceKey: string }
  | { kind: 'event'; serviceKey: string; level: ServiceEvent['level'] }
  | { kind: 'update'; serviceKey: string };

function minutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

export function inQuietHours(settings: Settings, now: Date): boolean {
  const q = settings.notifications.quietHours;
  if (!q.enabled) return false;
  const from = minutes(q.from);
  const to = minutes(q.to);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (from === to) return false;
  return from < to ? cur >= from && cur < to : cur >= from || cur < to; // across midnight
}

export function shouldNotify(settings: Settings, h: Happening, now: Date): boolean {
  const n = settings.notifications;
  if (!n.enabled) return false;
  if (n.pausedUntil && new Date(n.pausedUntil) > now) return false;
  if (inQuietHours(settings, now)) return false;
  const per = n.perService[h.serviceKey];
  if (per && !per.enabled) return false;
  if (h.kind === 'event') {
    const levels = ['info', 'notice', 'warning', 'error'];
    return levels.indexOf(h.level) >= levels.indexOf(per?.minLevel ?? 'notice');
  }
  return true;
}
