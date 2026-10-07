// #region spend-limits — docs: docs/adr/0013-spend-from-the-agents.md#decision
// DEC-0027 on the Spend page: every limit an agent applies, in words a person reads — which limit,
// over what window, how much of it is spent, and whether it stopped work, is breached, is only an
// approval threshold or is not enforced. An unknown kind shows by its own name. Pure: the renderer
// and tests call it with their own translator.
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';

type T = (key: string, params?: Record<string, string | number>) => string;
const KNOWN = new Set(['per_job', 'approval', 'daily', 'monthly', 'velocity', 'pool', 'emergency']);

export function limitUsd(x: number | null, t: T): string {
  if (x === null) return t('spend.unknown');
  if (x > 0 && x < 0.01) return '<$0.01';
  return `$${x.toFixed(2)}`;
}

/** «Daily · project demo»; an unknown kind keeps its own name. */
export function limitName(l: LimitView, t: T): string {
  const kind = KNOWN.has(l.kind) ? t(`limit.kind.${l.kind}`) : l.kind;
  const scope = l.scope === 'project' || l.scope === 'pool' ? t(`limit.scope.${l.scope}`, { name: l.subject ?? '' }) : t(`limit.scope.${l.scope}`);
  return `${kind} · ${scope}`;
}

/** A rolling window as people say it: hours up to two days («24 h»), whole days beyond, else minutes. */
export function windowSpan(seconds: number, t: T): string {
  if (seconds % 3600 === 0 && seconds <= 2 * 86_400) return t('duration.h', { n: seconds / 3600 });
  if (seconds % 86_400 === 0) return t('duration.d', { n: seconds / 86_400 });
  if (seconds >= 60) return t('duration.m', { n: Math.round(seconds / 60) });
  return t('duration.s', { n: seconds });
}

export function limitWindow(l: LimitView, t: T, date: (iso: string) => string): string {
  if (l.period) return t(`limit.window.${l.period}`);
  if (l.windowSeconds !== undefined) return t('limit.window.rolling', { span: windowSpan(l.windowSeconds, t) });
  if (l.since) return t('limit.window.since', { date: date(l.since) });
  return l.kind === 'per_job' || l.kind === 'approval' ? t('limit.window.order') : t('limit.window.none');
}

/** «$6.00 of $5.00», «up to $2.00» for a per-order limit, «relative» for a line with no amount. */
export function limitAmount(l: LimitView, t: T): string {
  if (l.limitUsd === null) return l.spentUsd === null ? t('limit.relative') : `${limitUsd(l.spentUsd, t)} · ${t('limit.relative')}`;
  if (l.spentUsd === null) return t('limit.amountOnly', { limit: limitUsd(l.limitUsd, t) });
  return t('limit.amount', { spent: limitUsd(l.spentUsd, t), limit: limitUsd(l.limitUsd, t) });
}

/** The Spend table's one-cell summary: the limit that most needs a person, and how many more. */
export function limitHeadline(limits: LimitView[], t: T): { text: string; state: LimitView['state'] } | null {
  const top = limits[0];
  if (!top) return null;
  const more = limits.length > 1 ? ` ${t('limit.more', { n: limits.length - 1 })}` : '';
  const lead = top.state === 'tripped' || top.state === 'breach' ? `${t(`limit.state.${top.state}`)}: ` : '';
  return { text: `${lead}${limitAmount(top, t)} · ${limitName(top, t)}${more}`, state: top.state };
}
// #endregion spend-limits
