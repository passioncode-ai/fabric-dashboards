// #region connections — docs: packages/service-host/README.md#connections
// FD-78: what an agent uses — other agents of the estate, models, outside connectors, stores and channels — as the
// service declares it in its well-known document under `extensions`, key CONNECTIONS_EXTENSION. Proposed to the Fabric
// Agent Contract on 2026-10-20 (board thread with fabric-agent-contract) beside DEC-0036 ED-9's dashboard extension:
// an `extensions` key is preserved and ignored by a reader that does not know it, so a service may send it before the
// decision lands. Pure: no Node import, so a renderer may import `@passioncode-ai/fabric-service-host/connections`.

/** The `extensions` key of a service's declared connections (proposed, version 0.1). */
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
  connections: Connection[];
  /** Why the value is invalid; a reader shows none of it then, and says so. */
  errors: string[];
}

export const CONNECTIONS_MAX = 64;
const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SERVICE_TARGET = /^[a-z0-9][a-z0-9-]{0,63}(\.[a-z0-9][a-z0-9-]{0,63})?$/;
const CAPABILITY = /^[a-z][a-z0-9._-]{0,127}$/;
const KINDS = new Set<ConnectionKind>(['service', 'model', 'connector', 'store', 'channel']);
const STATES = new Set<ConnectionState>(['ok', 'degraded', 'down', 'unknown']);
const FIELDS = new Set(['id', 'kind', 'target', 'capability', 'label', 'purpose', 'state', 'reason', 'lastAt']);
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === 'string' && v.length >= 1 && v.length <= max;

/** Every reason the declaration is invalid, by hand (as the dashboard profile's reader). */
export function connectionsErrors(v: unknown): string[] {
  if (!isPlain(v)) return ['/ type: must be object'];
  const out: string[] = [];
  for (const k of Object.keys(v)) if (k !== 'connections') out.push(`/ additionalProperties: ${k}`);
  const list = v.connections;
  if (!Array.isArray(list)) return [...out, '/connections: an array'];
  if (list.length > CONNECTIONS_MAX) out.push(`/connections: at most ${CONNECTIONS_MAX}`);
  const seen = new Set<string>();
  list.slice(0, CONNECTIONS_MAX).forEach((c, i) => {
    const at = `/connections/${i}`;
    if (!isPlain(c)) { out.push(`${at}: an object`); return; }
    for (const k of Object.keys(c)) if (!FIELDS.has(k)) out.push(`${at} additionalProperties: ${k}`);
    if (typeof c.id !== 'string' || !ID.test(c.id)) out.push(`${at}/id: a short lowercase name`);
    else if (seen.has(c.id)) out.push(`${at}/id: ${c.id} appears twice`);
    else seen.add(c.id);
    if (!KINDS.has(c.kind as ConnectionKind)) out.push(`${at}/kind: service, model, connector, store or channel`);
    if (!text(c.target, 200)) out.push(`${at}/target: 1…200 characters`);
    else if (c.kind === 'service' && !SERVICE_TARGET.test(c.target as string)) out.push(`${at}/target: a service key id.instance or a product id`);
    if (c.capability !== undefined && (c.kind !== 'service' || typeof c.capability !== 'string' || !CAPABILITY.test(c.capability))) out.push(`${at}/capability: only on a service connection, a capability name`);
    for (const f of ['label', 'purpose', 'reason'] as const) if (c[f] !== undefined && !text(c[f], 300)) out.push(`${at}/${f}: 1…300 characters`);
    if (!STATES.has(c.state as ConnectionState)) out.push(`${at}/state: ok, degraded, down or unknown`);
    if (c.lastAt !== undefined && (typeof c.lastAt !== 'string' || !Number.isFinite(Date.parse(c.lastAt)))) out.push(`${at}/lastAt: an RFC 3339 time`);
  });
  return out;
}

/** The service's declared connections. Never throws; an invalid value declares nothing and is reported. */
export function connectionsOf(wellKnown: unknown): ConnectionsView {
  const ext = isPlain(wellKnown) && isPlain(wellKnown.extensions) ? wellKnown.extensions : undefined;
  if (!ext || !Object.hasOwn(ext, CONNECTIONS_EXTENSION)) return { declared: false, connections: [], errors: [] };
  const value = ext[CONNECTIONS_EXTENSION];
  const errors = connectionsErrors(value);
  if (errors.length) return { declared: false, connections: [], errors };
  return { declared: true, connections: (value as { connections: Connection[] }).connections, errors: [] };
}
// #endregion connections
