// #region connections — docs: packages/service-host/README.md#connections
// FD-78, CT-70: what an agent uses (other agents of the estate, models, outside connectors, stores and channels) as
// the service declares it in its well-known document under `extensions`, key CONNECTIONS_EXTENSION: Fabric Agent
// Contract DEC-0096 (`extensions/connections/0.1`, FAC-SEM-127), a port of its `connectionsView`, run on its vectors. Pure: no Node import, so a renderer may import `@passioncode-ai/fabric-service-host/connections`.

/** The `extensions` key of a service's declared connections (DEC-0096). */
export const CONNECTIONS_EXTENSION = 'https://fabric.passioncode.ai/agent-contract/extensions/connections/0.1';

/** What a connection is to: another Fabric service (by key or product id), a model provider, an outside connector
 *  (Telegram, Google Ads, an API), a store (a database, a bucket) or a channel to a person. */
export type ConnectionKind = 'service' | 'model' | 'connector' | 'store' | 'channel';
/** How the connection works as the service sees it; `unknown` when it has not used it yet. */
export type ConnectionState = 'ok' | 'degraded' | 'down' | 'unknown';

export interface Connection {
  /** Stable within the service; a `degraded[].source` with the same name is this connection failing. */
  id: string;
  kind: ConnectionKind;
  /** For `service`: an `id.instance` key or a product `id`; otherwise the thing's own name ("telegram", "postgres"). */
  target: string;
  /** For `service`: the capability it calls, when it calls one. */
  capability?: string;
  /** What a person reads; the target when absent. */
  label?: string;
  /** What the service uses it for, in one line. */
  purpose?: string;
  state: ConnectionState;
  reason?: string;
  /** When the service last used it (RFC 3339). */
  lastAt?: string;
}

export interface ConnectionsView {
  /** A valid declaration is present. */
  declared: boolean;
  /** The key is present and its value is invalid: not declared, and reported (FAC-SEM-127). */
  reported: boolean;
  /** Each with `failing` when a `degraded[].source` names its id; empty unless `declared`. */
  connections: (Connection & { failing: boolean })[];
  /** Why the value is invalid; a reader shows none of it then, and says so. */
  errors: string[];
}

export const CONNECTIONS_MAX = 64;
const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const TARGET = /^[^\s]+$/;
const SERVICE_TARGET = /^[a-z0-9][a-z0-9-]{0,63}(\.[a-z0-9][a-z0-9-]{0,63})?$/;
const CAPABILITY = /^[a-z][a-z0-9._-]{1,127}$/;
const ONE_LINE = /^[^\n\r]+$/;
// RFC 3339 date-time, as the schema's `format: date-time` reads it: a full date, a time with seconds, an offset.
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-](\d{2}):(\d{2}))$/;
const KINDS = new Set<ConnectionKind>(['service', 'model', 'connector', 'store', 'channel']);
const STATES = new Set<ConnectionState>(['ok', 'degraded', 'down', 'unknown']);
const FIELDS = new Set(['id', 'kind', 'target', 'capability', 'state', 'label', 'purpose', 'reason', 'lastAt']);
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === 'string' && v.length >= 1 && v.length <= max;

function dateTime(v: string): boolean {
  const m = DATE_TIME.exec(v);
  if (!m) return false;
  const [y, mo, d, h, mi, se] = [1, 2, 3, 4, 5, 6].map((i) => Number(m[i]));
  const days = [31, (y! % 4 === 0 && y! % 100 !== 0) || y! % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mo! < 1 || mo! > 12 || d! < 1 || d! > days[mo! - 1]! || h! > 23 || mi! > 59 || se! > 60) return false;
  return m[9] === undefined || (Number(m[9]) <= 23 && Number(m[10]) <= 59);
}

// ── The contract's credential check (DEC-0096, its src/connections.ts and src/secret-shape.ts), ported as written.
const CREDENTIAL_WORDS = ['token', 'secret', 'password', 'passwd', 'pass', 'passphrase', 'credential', 'credentials', 'cookie', 'authorization',
  'bearer', 'jwt', 'otp', 'apikey', 'signature', 'sig', 'accesstoken', 'idtoken', 'authtoken', 'refreshtoken', 'sessionid', 'sessiontoken', 'logincode',
  'authcode', 'privatekey', 'clientsecret', 'secretkey', 'accesskey'];
const CREDENTIAL_PAIRS: Record<string, readonly string[]> = {
  key: ['private', 'api', 'access', 'secret', 'session', 'auth', 'signing', 'encryption', 'master', 'client', 'login', 'refresh'],
  auth: ['token', 'code', 'header'],
  session: ['token', 'id'],
  code: ['login', 'auth', 'access', 'session'],
};
const nameWords = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[\s._-]+/).filter(Boolean).map((w) => w.toLowerCase());
const withSingulars = (words: string[]) => [...words, ...words.filter((w) => w.length > 2 && w.endsWith('s')).map((w) => w.slice(0, -1))];
function credentialName(name: string): boolean {
  const split = nameWords(name);
  const words = withSingulars(split);
  if (words.some((w) => CREDENTIAL_WORDS.includes(w))) return true;
  if (split.length === 1 && words.some((w) => Object.hasOwn(CREDENTIAL_PAIRS, w))) return true;
  return Object.entries(CREDENTIAL_PAIRS).some(([w, partners]) => words.includes(w) && partners.some((p) => words.includes(p)));
}
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*/;
const SECRET_VALUE = /(^bearer\s.+|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|glpat-[A-Za-z0-9_-]{20,})/i;
const LONG_RUN = /[A-Za-z0-9+/=_-]{40,}/g;
const longSecret = (v: string) => (v.match(LONG_RUN) ?? []).some((r) => /[a-z]/.test(r) && /[A-Z]/.test(r) && /[0-9]/.test(r));
const secretValue = (v: string) => JWT_SHAPE.test(v) || SECRET_VALUE.test(v) || longSecret(v);
const BEARER_INSIDE = /\bbearer\s+(?=[A-Za-z0-9._~+/-]*\d)[A-Za-z0-9._~+/-]{12,}=*/i;
const PATH_LIKE = /^(?:[/~.]|[A-Za-z]:[\\/]|[a-z][a-z0-9+.-]*:\/\/)/i;
const pathLike = (piece: string) => PATH_LIKE.test(piece) || (/[\\/]/.test(piece) && (/\.[A-Za-z0-9]{1,8}$/.test(piece) || piece.split(/[\\/]/).some((seg) => /^[a-z][a-z0-9_-]{2,}$/.test(seg))));
const secretArgument = (v: string) => JWT_SHAPE.test(v) || SECRET_VALUE.test(v) || BEARER_INSIDE.test(v)
  || v.split(/[\s=]/).some((piece) => (pathLike(piece) ? piece.split(/[\\/]/).some((part) => longSecret(part)) : longSecret(piece)));
const decodeKeepingPlus = (raw: string) => { try { return decodeURIComponent(raw); } catch { return raw; } };
function rawValues(query: string): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (const piece of query.split('&')) {
    if (piece === '') continue;
    const at = piece.indexOf('=');
    const name = [...new URLSearchParams(at < 0 ? piece : piece.slice(0, at)).keys()][0] ?? '';
    values.set(name, [...(values.get(name) ?? []), at < 0 ? '' : decodeKeepingPlus(piece.slice(at + 1))]);
  }
  return values;
}
function secretUrl(v: string): boolean {
  if (secretArgument(v)) return true;
  let url: URL;
  try { url = new URL(v); } catch { return false; }
  if (url.password !== '') return true;
  for (const part of [url.search, url.hash]) for (const [name, vals] of rawValues(part.slice(1))) if (vals.some((raw) => (raw !== '' && credentialName(name)) || secretValue(raw))) return true;
  return false;
}
const KEY_SHAPE = /(?:^|[^A-Za-z0-9])(?:sk-(?=[A-Za-z0-9_-]*\d)(?:(?=[A-Za-z0-9_-]*[A-Z])[A-Za-z0-9_-]{16,}|[A-Za-z0-9_-]{32,})|gh[pousr]_[A-Za-z0-9]{20,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|glpat-[A-Za-z0-9_-]{20,}|(?:bot)?\d{6,12}:(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])[A-Za-z0-9_-]{34,35}(?![A-Za-z0-9_-]))/;
const SCHEME = /[a-z][a-z0-9+.-]*:\/\//gi;
const CLOSING = /[)\]}>"'.,;:!?]/;
function urlsIn(value: string): string[] {
  const urls: string[] = [];
  for (const piece of value.split(/\s+/)) {
    for (const match of piece.matchAll(SCHEME)) {
      const url = piece.slice(match.index);
      let end = url.length;
      while (end > 0 && CLOSING.test(url[end - 1]!)) end -= 1;
      for (let back = 0; back <= 1 && end + back <= url.length; back += 1) urls.push(url.slice(0, end + back));
    }
  }
  return urls;
}
const longRun = (value: string) => value.split(/\s+/).some((piece) => {
  const at = piece.search(SCHEME);
  const cut = at < 0 ? -1 : piece.indexOf('://', at);
  return longSecret(cut < 0 ? piece : piece.slice(0, cut));
});
const credential = (value: string, runs: boolean) => JWT_SHAPE.test(value) || KEY_SHAPE.test(value) || BEARER_INSIDE.test(value) || (runs && longRun(value)) || urlsIn(value).some(secretUrl);
const STRING_MEMBERS = ['id', 'target', 'capability', 'label', 'purpose', 'reason'] as const;

/** Every reason the declaration is invalid (the schema by hand, then a repeated id and a credential, DEC-0096). */
export function connectionsErrors(v: unknown): string[] {
  if (!isPlain(v)) return ['/ type: must be object'];
  const out: string[] = [];
  for (const k of Object.keys(v)) if (k !== 'connections') out.push(`/ additionalProperties: ${k}`);
  const list = v.connections;
  if (!Array.isArray(list)) return [...out, '/connections: an array'];
  if (list.length > CONNECTIONS_MAX) out.push(`/connections: at most ${CONNECTIONS_MAX}`);
  list.forEach((c, i) => {
    const at = `/connections/${i}`;
    if (!isPlain(c)) { out.push(`${at}: an object`); return; }
    for (const k of Object.keys(c)) if (!FIELDS.has(k)) out.push(`${at} additionalProperties: ${k}`);
    if (typeof c.id !== 'string' || !ID.test(c.id)) out.push(`${at}/id: a short lowercase name`);
    if (!KINDS.has(c.kind as ConnectionKind)) out.push(`${at}/kind: service, model, connector, store or channel`);
    if (!text(c.target, 200) || !TARGET.test(c.target as string)) out.push(`${at}/target: 1…200 characters, no space`);
    else if (c.kind === 'service' && !SERVICE_TARGET.test(c.target as string)) out.push(`${at}/target: a service key id.instance or a product id`);
    if (c.capability !== undefined && (c.kind !== 'service' || typeof c.capability !== 'string' || !CAPABILITY.test(c.capability))) out.push(`${at}/capability: only on a service connection, a capability name`);
    for (const f of ['label', 'purpose', 'reason'] as const) if (c[f] !== undefined && (!text(c[f], 300) || !ONE_LINE.test(c[f] as string))) out.push(`${at}/${f}: one line of 1…300 characters`);
    if (!STATES.has(c.state as ConnectionState)) out.push(`${at}/state: ok, degraded, down or unknown`);
    if (c.lastAt !== undefined && (typeof c.lastAt !== 'string' || !dateTime(c.lastAt))) out.push(`${at}/lastAt: an RFC 3339 time`);
  });
  if (out.length) return out;
  const seen = new Set<string>();
  (list as Connection[]).forEach((c, i) => {
    if (seen.has(c.id)) out.push(`/connections/${i}/id: ${c.id} appears twice`);
    seen.add(c.id);
    for (const m of STRING_MEMBERS) {
      const value = c[m];
      const runs = m !== 'id' && m !== 'capability' && !(m === 'target' && c.kind === 'model');
      if (typeof value === 'string' && credential(value, runs)) out.push(`/connections/${i}/${m}: a connection never carries a credential`);
    }
  });
  return out;
}

/** The service's declared connections (DEC-0096 `connectionsView`). Never throws; an invalid value declares nothing
 *  and is reported; a declared connection is `failing` when a `degraded[].source` names its id. */
export function connectionsOf(wellKnown: unknown): ConnectionsView {
  const ext = isPlain(wellKnown) && isPlain(wellKnown.extensions) ? wellKnown.extensions : undefined;
  if (!ext || !Object.hasOwn(ext, CONNECTIONS_EXTENSION)) return { declared: false, reported: false, connections: [], errors: [] };
  const value = ext[CONNECTIONS_EXTENSION];
  const errors = connectionsErrors(value);
  if (errors.length) return { declared: false, reported: true, connections: [], errors };
  const degraded = isPlain(wellKnown) && Array.isArray(wellKnown.degraded) ? wellKnown.degraded : [];
  const failing = new Set(degraded.filter(isPlain).map((d) => d.source).filter((x): x is string => typeof x === 'string'));
  return { declared: true, reported: false, connections: (value as { connections: Connection[] }).connections.map((c) => ({ ...c, failing: failing.has(c.id) })), errors: [] };
}
// #endregion connections
