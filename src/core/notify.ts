// Whether the operator wants to hear about something now. Pure: the monitor
// decides WHAT happened; this decides whether to raise a notification for it.
import fs from 'node:fs';
import { atomicWrite } from './fsutil';
import { t, type Lang } from './i18n';
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

// #region notification-policy — docs: docs/adr/0010-notifications-only-when-it-matters.md#decision
// Which service events become a banner, and what the banner says (ADR-0010). A service asks with
// `notify: true`; the host decides whether that request is worth interrupting the operator for.

/** What an agent wants from the operator. `quiet` goes to Activity only. */
export type Intent = 'ask' | 'failed' | 'attention' | 'quiet';

/** A question or a step only a person can take: the agent is blocked until the operator acts. */
const ASK = /(awaiting|approval|approve_requested|human_step\.opened|needs?_(you|review|decision|input)|review_requested|confirmation_requested|choice_needed)/;
/** Endings and progress: something got better or moved on. Never a banner. */
const SETTLED = /\.(recovered|cleared|back|resumed|closed|resolved|choice_made|approved|granted|cancelled|started|queued|delivered|done|finished|completed|ready|synced|written|checked|observed|planned)$/;

export function intentOf(e: Pick<ServiceEvent, 'kind' | 'level'>): Intent {
  const kind = e.kind.toLowerCase();
  if (SETTLED.test(kind)) return 'quiet';
  if (ASK.test(kind)) return 'ask';
  if (e.level === 'error') return 'failed';
  if (e.level === 'warning') return 'attention';
  return 'quiet';
}

/** How long one episode stays told. A question is asked once; a lasting warning is repeated twice a day at most. */
export const COOLDOWN_MS: Record<Exclude<Intent, 'quiet'>, number> = {
  failed: 6 * 3_600_000,
  attention: 12 * 3_600_000,
  ask: 24 * 3_600_000,
};
const FORGET_MS = 48 * 3_600_000;

/** One episode: a subject's event kind on one instance. A warning with no subject is a state of the
 *  agent's world (low disk, a provider down), so its instances share one episode. */
export function episodeKey(service: { key: string; id: string }, e: Pick<ServiceEvent, 'kind' | 'level' | 'text' | 'subject'>): string {
  if (e.subject?.id) return `${service.key}|${e.kind}|${e.subject.type}:${e.subject.id}`;
  if (intentOf(e) === 'attention') return `${service.id}|${e.kind}|`;
  return `${service.key}|${e.kind}|${e.text.slice(0, 200)}`;
}

/** When each episode was last told; persisted so a restarted app does not tell it again. */
export class NotifyLedger {
  private told: Record<string, number> = {};

  constructor(private readonly file: string | null) {
    if (!file) return;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v)) this.told[k] = v;
      }
    } catch { /* first run or a torn file: start empty */ }
  }

  /** True when this episode may be told now; records it. */
  admit(key: string, intent: Exclude<Intent, 'quiet'>, now: number): boolean {
    const last = this.told[key];
    if (last !== undefined && now - last < COOLDOWN_MS[intent]) return false;
    this.told[key] = now;
    for (const [k, at] of Object.entries(this.told)) if (now - at >= FORGET_MS) delete this.told[k];
    if (this.file) {
      try { atomicWrite(this.file, JSON.stringify(this.told)); } catch { /* a full disk loses the memory, never the notification */ }
    }
    return true;
  }
}

export { displayName } from './names';

const RANK: Record<Exclude<Intent, 'quiet'>, number> = { ask: 0, failed: 1, attention: 2 };

/** The banner for one service's admitted events: the agent in the title, what it wants in the
 *  subtitle, its own sentence in the body. Several at once tell the most urgent and open Activity. */
export function composeEventNotice(lang: Lang, name: string, items: { intent: Exclude<Intent, 'quiet'>; text: string; link?: string }[]): { title: string; subtitle: string; body: string; link?: string; target: 'service' | 'activity' } {
  const top = [...items].sort((a, b) => RANK[a.intent] - RANK[b.intent])[0]!;
  const what = t(lang, `notify.intent.${top.intent}`);
  if (items.length === 1) return { title: name, subtitle: what, body: top.text, link: top.link, target: 'service' };
  return { title: name, subtitle: t(lang, 'notify.many', { count: items.length, what: what.toLocaleLowerCase(lang) }), body: top.text, link: undefined, target: 'activity' };
}
// #endregion notification-policy
