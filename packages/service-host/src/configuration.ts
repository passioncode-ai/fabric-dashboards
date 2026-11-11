// #region configuration — docs: packages/service-host/README.md#health
// Scenario walk 2026-11-11 (SCN-068): the well-known `configuration` (DEC-0046) is the service's own JSON. Before
// this, nothing checked it, and a malformed value (`slots` not an array, `models` not a list) threw in the page that
// draws it and blanked the window. `configurationOf` checks it in the style of `loadOf` and `connectionsOf`: an
// invalid value declares nothing, so a reader treats it as absent. Pure: no Node import, so a renderer may import
// `@passioncode-ai/fabric-service-host/configuration`.
import type { WellKnown } from './protocol';

export type Configuration = NonNullable<WellKnown['configuration']>;

const SLOTS = ['runner', 'model'] as const;
const FROM = ['request', 'agent', 'binding', 'estate'] as const;
const ROUTES = ['subscription', 'key'] as const;

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The first thing that makes `value` not a valid `configuration`, or null. */
export function configurationProblem(value: unknown): string | null {
  if (!isPlain(value)) return 'configuration: an object';
  if (!Array.isArray(value.slots) || !value.slots.every((s) => (SLOTS as readonly unknown[]).includes(s))) return 'configuration/slots: an array of runner and model';
  if (value.resolved === undefined) return null;
  const r = value.resolved;
  if (!isPlain(r)) return 'configuration/resolved: an object';
  if (r.from !== undefined && !(FROM as readonly unknown[]).includes(r.from)) return 'configuration/resolved/from: request, agent, binding or estate';
  if (r.route !== undefined && !(ROUTES as readonly unknown[]).includes(r.route)) return 'configuration/resolved/route: subscription or key';
  for (const k of ['runnerProfile', 'runnerKind', 'modelProfile'] as const) {
    if (r[k] !== undefined && typeof r[k] !== 'string') return `configuration/resolved/${k}: a string`;
  }
  if (r.models !== undefined && (!Array.isArray(r.models) || !r.models.every((m) => typeof m === 'string'))) return 'configuration/resolved/models: an array of strings';
  return null;
}

/** The service's configuration, checked; undefined when it declares none or declares an invalid one. Never throws. */
export function configurationOf(wellKnown: unknown): Configuration | undefined {
  if (!isPlain(wellKnown) || wellKnown.configuration === undefined) return undefined;
  const c = wellKnown.configuration;
  if (configurationProblem(c) !== null) return undefined;
  const v = c as { slots: Configuration['slots']; resolved?: Record<string, unknown> };
  const r = v.resolved ?? {};
  const resolved: Configuration['resolved'] = {};
  if (r.from !== undefined) resolved.from = r.from as Configuration['resolved']['from'];
  if (r.runnerProfile !== undefined) resolved.runnerProfile = r.runnerProfile as string;
  if (r.runnerKind !== undefined) resolved.runnerKind = r.runnerKind as string;
  if (r.route !== undefined) resolved.route = r.route as Configuration['resolved']['route'];
  if (r.modelProfile !== undefined) resolved.modelProfile = r.modelProfile as string;
  if (r.models !== undefined) resolved.models = [...(r.models as string[])];
  return { slots: [...v.slots], resolved };
}
// #endregion configuration
