// #region access-grants — docs: docs/ux/scenarios.md#scn-123-see-who-holds-access-and-what-each-agent-holds
// FD-351, contract DEC-0187 (`access-grants/1`, AG-1 to AG-7, FAC-SEM-185): every product that issues access answers
// one shape, so a host joins Fabric's agent access, account seats, a service's client keys and a vault's provider keys
// by the holder's service key. This is the host's reading of one answer: the schema's structure, the semantic rule,
// and the state of one grant. A refused answer is named, never read in part. Pure: no I/O.

export type GrantHolder =
  | { kind: 'agent'; agent: string }
  | { kind: 'person' | 'machine'; ref: string }
  | { kind: 'unresolved'; label: string };

export type GrantSubject = { kind: 'agent'; agent: string } | { kind: 'account'; provider: string; ref: string };

export interface GrantAct {
  at: string;
  by: 'operator' | 'person' | 'agent' | 'service';
  via: 'dashboard' | 'agent' | 'config' | 'automatic';
  agent?: string;
  ref?: string;
  reason?: string;
}

export interface Grant {
  id: string;
  holder: GrantHolder;
  subject?: GrantSubject;
  scopes: string[];
  limitUsd?: number | null;
  limitPeriod?: 'day' | 'week' | 'month' | 'total';
  spentDayUsd?: number | null;
  issued: GrantAct;
  expiresAt?: string;
  revoked?: GrantAct;
}

export interface AccessGrants {
  protocol: 'access-grants/1';
  issuer: string;
  generatedAt: string;
  doors?: { issue?: string; revoke?: string };
  grants: Grant[];
  nextCursor?: string;
  degraded?: string[];
}

export const ACCESS_GRANTS_OPERATION = 'access.grants.list';
const SERVICE_KEY = /^[a-z][a-z0-9-]{1,62}\.[a-z][a-z0-9-]{0,31}$/;
const OPAQUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const OPERATION = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const SCOPE = /^[A-Za-z0-9*][A-Za-z0-9._:*/+-]{0,127}$/;
const PROVIDER = /^[a-z][a-z0-9-]{0,63}$/;
// RFC 3339 with a zone: a time a host compares, never a local one.
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const BY = new Set(['operator', 'person', 'agent', 'service']);
const VIA = new Set(['dashboard', 'agent', 'config', 'automatic']);
const PERIODS = new Set(['day', 'week', 'month', 'total']);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const timeOf = (v: unknown): number => (typeof v === 'string' && TIME.test(v) ? Date.parse(v) : Number.NaN);
const only = (o: Record<string, unknown>, keys: readonly string[], at: string): string | null => {
  const extra = Object.keys(o).find((k) => !keys.includes(k));
  return extra ? `${at}: ${extra} is not part of access-grants/1 (no key value, prefix or hash, no name)` : null;
};

function holderProblem(h: unknown, at: string): string | null {
  if (!isObj(h)) return `${at} is not an object`;
  if (h.kind === 'agent') return only(h, ['kind', 'agent'], at) ?? (typeof h.agent === 'string' && SERVICE_KEY.test(h.agent) ? null : `${at}.agent is not a service key <id>.<instance>`);
  if (h.kind === 'person' || h.kind === 'machine') return only(h, ['kind', 'ref'], at) ?? (typeof h.ref === 'string' && OPAQUE.test(h.ref) ? null : `${at}.ref is not an opaque reference (no @, no space)`);
  if (h.kind === 'unresolved') return only(h, ['kind', 'label'], at) ?? (typeof h.label === 'string' && h.label.length >= 1 && h.label.length <= 120 ? null : `${at}.label is not 1 to 120 characters`);
  return `${at}.kind is not agent, person, machine or unresolved`;
}

function subjectProblem(s: unknown, at: string): string | null {
  if (!isObj(s)) return `${at} is not an object`;
  if (s.kind === 'agent') return only(s, ['kind', 'agent'], at) ?? (typeof s.agent === 'string' && SERVICE_KEY.test(s.agent) ? null : `${at}.agent is not a service key`);
  if (s.kind === 'account') {
    return only(s, ['kind', 'provider', 'ref'], at)
      ?? (typeof s.provider === 'string' && PROVIDER.test(s.provider) ? null : `${at}.provider is not a provider name`)
      ?? (typeof s.ref === 'string' && OPAQUE.test(s.ref) ? null : `${at}.ref is not an opaque reference`);
  }
  return `${at}.kind is not agent or account`;
}

function actProblem(a: unknown, at: string, revocation: boolean): string | null {
  if (!isObj(a)) return `${at} is not an object`;
  const extra = only(a, revocation ? ['at', 'by', 'via', 'agent', 'ref', 'reason'] : ['at', 'by', 'via', 'agent', 'ref'], at);
  if (extra) return extra;
  if (Number.isNaN(timeOf(a.at))) return `${at}.at is not an RFC 3339 time`;
  if (!BY.has(a.by as string)) return `${at}.by is not operator, person, agent or service`;
  if (!VIA.has(a.via as string)) return `${at}.via is not dashboard, agent, config or automatic`;
  if (a.agent !== undefined && !(typeof a.agent === 'string' && SERVICE_KEY.test(a.agent))) return `${at}.agent is not a service key`;
  if (a.ref !== undefined && !(typeof a.ref === 'string' && OPAQUE.test(a.ref))) return `${at}.ref is not an opaque reference`;
  if (revocation && a.reason !== undefined && !(typeof a.reason === 'string' && a.reason.length >= 1 && a.reason.length <= 500)) return `${at}.reason is not 1 to 500 characters`;
  // FAC-SEM-185: an act through an agent's call names that agent, and only then; an agent's own decision came that way.
  if (a.via === 'agent' && a.agent === undefined) return `${at}: an act through an agent's call names that agent`;
  if (a.via !== 'agent' && a.agent !== undefined) return `${at}.agent is present only with via agent`;
  if (a.by === 'agent' && a.via !== 'agent') return `${at}: an act an agent decided came through its call (via agent)`;
  return null;
}

function grantProblem(g: unknown, at: string, generated: number): string | null {
  if (!isObj(g)) return `${at} is not an object`;
  const extra = only(g, ['id', 'holder', 'subject', 'scopes', 'limitUsd', 'limitPeriod', 'spentDayUsd', 'issued', 'expiresAt', 'revoked'], at);
  if (extra) return extra;
  if (!(typeof g.id === 'string' && OPAQUE.test(g.id))) return `${at}.id is not an opaque reference`;
  const holder = holderProblem(g.holder, `${at}.holder`);
  if (holder) return holder;
  if (g.subject !== undefined) { const s = subjectProblem(g.subject, `${at}.subject`); if (s) return s; }
  if (!Array.isArray(g.scopes) || g.scopes.length > 64 || new Set(g.scopes).size !== g.scopes.length || g.scopes.some((s) => !(typeof s === 'string' && SCOPE.test(s)))) return `${at}.scopes is not a list of distinct scope names`;
  if (g.limitUsd !== undefined && g.limitUsd !== null && !(typeof g.limitUsd === 'number' && Number.isFinite(g.limitUsd) && g.limitUsd > 0)) return `${at}.limitUsd is not a positive number or null`;
  if (g.limitPeriod !== undefined && !PERIODS.has(g.limitPeriod as string)) return `${at}.limitPeriod is not day, week, month or total`;
  // FAC-SEM-185 (AG-4): a ceiling names its window, and a window belongs to a ceiling.
  if ((typeof g.limitUsd === 'number') !== (g.limitPeriod !== undefined)) return `${at}.limitPeriod is present exactly when limitUsd is a number`;
  if (g.spentDayUsd !== undefined && g.spentDayUsd !== null && !(typeof g.spentDayUsd === 'number' && Number.isFinite(g.spentDayUsd) && g.spentDayUsd >= 0)) return `${at}.spentDayUsd is not a non-negative number or null`;
  const issued = actProblem(g.issued, `${at}.issued`, false);
  if (issued) return issued;
  const issuedAt = timeOf((g.issued as Record<string, unknown>).at);
  if (!Number.isNaN(generated) && issuedAt > generated) return `${at}.issued.at is after generatedAt`;
  if (g.expiresAt !== undefined) {
    const expires = timeOf(g.expiresAt);
    if (Number.isNaN(expires)) return `${at}.expiresAt is not an RFC 3339 time`;
    if (expires <= issuedAt) return `${at}.expiresAt is not after issued.at`;
  }
  if (g.revoked !== undefined) {
    const r = actProblem(g.revoked, `${at}.revoked`, true);
    if (r) return r;
    const revokedAt = timeOf((g.revoked as Record<string, unknown>).at);
    if (revokedAt < issuedAt) return `${at}.revoked.at is before issued.at`;
    if (!Number.isNaN(generated) && revokedAt > generated) return `${at}.revoked.at is after generatedAt`;
  }
  return null;
}

/**
 * The first problem of an `access-grants/1` answer, or null when it reads whole (schema and FAC-SEM-185). With
 * `issuer`, an answer naming another service is refused: a product answers for the grants it issued (AG-1).
 */
export function checkAccessGrants(value: unknown, expected: { issuer?: string } = {}): string | null {
  if (!isObj(value)) return 'the answer is not an object';
  const extra = only(value, ['protocol', 'issuer', 'generatedAt', 'doors', 'grants', 'nextCursor', 'degraded'], 'the answer');
  if (extra) return extra;
  if (value.protocol !== 'access-grants/1') return `protocol is ${JSON.stringify(value.protocol)}, not access-grants/1`;
  if (!(typeof value.issuer === 'string' && SERVICE_KEY.test(value.issuer))) return 'issuer is not a service key';
  if (expected.issuer && value.issuer !== expected.issuer) return `issuer is ${value.issuer}, not the service asked (${expected.issuer})`;
  const generated = timeOf(value.generatedAt);
  if (Number.isNaN(generated)) return 'generatedAt is not an RFC 3339 time';
  if (value.doors !== undefined) {
    if (!isObj(value.doors)) return 'doors is not an object';
    const d = only(value.doors, ['issue', 'revoke'], 'doors');
    if (d) return d;
    for (const k of ['issue', 'revoke'] as const) {
      const op = value.doors[k];
      if (op !== undefined && !(typeof op === 'string' && op.length <= 128 && OPERATION.test(op))) return `doors.${k} is not an operation name`;
    }
  }
  if (!Array.isArray(value.grants) || value.grants.length > 500) return 'grants is not a list of at most 500';
  const ids = new Set<string>();
  for (let i = 0; i < value.grants.length; i += 1) {
    const p = grantProblem(value.grants[i], `grants[${i}]`, generated);
    if (p) return p;
    const id = (value.grants[i] as Record<string, unknown>).id as string;
    if (ids.has(id)) return `grants[${i}].id ${id} appears twice`;
    ids.add(id);
  }
  if (value.nextCursor !== undefined && !(typeof value.nextCursor === 'string' && value.nextCursor.length >= 8 && value.nextCursor.length <= 256)) return 'nextCursor is not 8 to 256 characters';
  if (value.degraded !== undefined && !(Array.isArray(value.degraded) && value.degraded.length <= 16 && value.degraded.every((d) => typeof d === 'string' && d.length >= 1 && d.length <= 200))) return 'degraded is not a list of at most 16 short strings';
  return null;
}

export type GrantState = 'active' | 'revoked' | 'expired';

/** The state a host shows for one grant at `now` (AG-5): revoked wins over expired. */
export function grantState(grant: Pick<Grant, 'revoked' | 'expiresAt'>, now: number): GrantState {
  if (grant.revoked) return 'revoked';
  const expires = grant.expiresAt ? Date.parse(grant.expiresAt) : Number.NaN;
  return !Number.isNaN(expires) && expires <= now ? 'expired' : 'active';
}
// #endregion access-grants
