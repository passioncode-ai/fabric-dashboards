// #region instance-facts — docs: packages/service-host/README.md#instance-facts
// extensions/instance-facts/0.1 (contract DEC-0173, FAC-SEM-180): who an instance serves, how it keeps data apart and
// the space it runs in, declared by the service in its descriptor, its well-known document or both, and never verified.
// A port of the contract's reference reading `instanceFacts` (src/instance-facts.ts at fabric-agent-contract 1161cbf3,
// release v0.1.0+2026-11-16.2, DEC-0174),
// run against its vectors (test/fixtures/contract/vectors_instance-facts.json). The schema is checked by hand, as the
// other readings here do. Pure: no Node import, so a renderer may import `@passioncode-ai/fabric-service-host/instance-facts`.

export const INSTANCE_FACTS_EXTENSION = 'https://fabric.passioncode.ai/agent-contract/extensions/instance-facts/0.1';

export type Audience = 'operator' | 'organization' | 'public';
export type Entry = 'host-signin' | 'own-signin' | 'none';
export type TenancyMode = 'single' | 'per-organization' | 'shared';
export type SpaceKind = 'user' | 'container' | 'vm' | 'system';
/** The five facts a host reads, each on its own (IF-5); an absent one is not declared. */
export interface InstanceFacts { audience?: Audience; entry?: Entry; mode?: TenancyMode; kind?: SpaceKind; account?: string }
export type FactsDocument = 'descriptor' | 'wellKnown';
export type FactField = keyof InstanceFacts;
/** A declared value a clause of IF-6 refuses: never read; the field is read from the other document. */
export interface RefusedFact { document: FactsDocument; field: FactField; reason: string }
export interface InstanceFactsView {
  /** At least one fact is read; a dashboard's login alone never makes one (IF-5). */
  declared: boolean;
  facts: InstanceFacts;
  refused: RefusedFact[];
  /** A document whose extension value fails the schema: none of its facts is read. */
  invalid: FactsDocument[];
  /** The well-known document answers as another service than the descriptor: it gives nothing (IF-5). */
  foreign: boolean;
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (o: Obj, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** CT-327: a service's key as the identity rule FAC-SEM-009 builds it (the contract's `serviceKey`), so both agree. */
const show = (v: unknown): string => { if (typeof v === 'string') return v; try { return String(v); } catch { return JSON.stringify(v) ?? typeof v; } };
const serviceKey = (o: Obj) => `${show(o.id)}.${show(o.instance ?? 'default')}`;
function answersAsAnother(descriptor: unknown, wellKnown: unknown): boolean {
  if (!isObject(descriptor) || !isObject(wellKnown)) return false;
  return serviceKey(descriptor) !== serviceKey(isObject(wellKnown.service) ? wellKnown.service : {});
}

const FIELDS: ReadonlyArray<[FactField, 'access' | 'tenancy' | 'space', string]> = [
  ['audience', 'access', 'audience'],
  ['entry', 'access', 'entry'],
  ['mode', 'tenancy', 'mode'],
  ['kind', 'space', 'kind'],
  ['account', 'space', 'account'],
];

const ACCOUNT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** service-instance-facts-extension.schema.json, by hand: every member optional and closed; a present tenancy names its
 *  mode, a present space its kind. */
function fitsSchema(value: unknown): boolean {
  const closed = (o: unknown, allowed: string[]): o is Obj => isObject(o) && Object.keys(o).every((k) => allowed.includes(k));
  const oneOf = (o: Obj, k: string, values: string[]) => !has(o, k) || values.includes(o[k] as string);
  if (!closed(value, ['access', 'tenancy', 'space'])) return false;
  if (has(value, 'access')) {
    const a = value.access;
    if (!closed(a, ['audience', 'entry']) || !oneOf(a, 'audience', ['operator', 'organization', 'public']) || !oneOf(a, 'entry', ['host-signin', 'own-signin', 'none'])) return false;
  }
  if (has(value, 'tenancy')) {
    const t = value.tenancy;
    if (!closed(t, ['mode']) || !has(t, 'mode') || !oneOf(t, 'mode', ['single', 'per-organization', 'shared'])) return false;
  }
  if (has(value, 'space')) {
    const s = value.space;
    if (!closed(s, ['kind', 'account']) || !has(s, 'kind') || !oneOf(s, 'kind', ['user', 'container', 'vm', 'system'])) return false;
    if (has(s, 'account') && (typeof s.account !== 'string' || !ACCOUNT.test(s.account))) return false;
  }
  return true;
}

function declaredIn(document: unknown): { valid: boolean; values: Partial<Record<FactField, unknown>> } {
  const extensions = isObject(document) && isObject(document.extensions) ? document.extensions : undefined;
  if (extensions === undefined || !has(extensions, INSTANCE_FACTS_EXTENSION)) return { valid: true, values: {} };
  const value = extensions[INSTANCE_FACTS_EXTENSION];
  if (!fitsSchema(value)) return { valid: false, values: {} };
  const values: Partial<Record<FactField, unknown>> = {};
  for (const [field, member, name] of FIELDS) {
    const object = (value as Obj)[member];
    if (isObject(object) && has(object, name)) values[field] = object[name];
  }
  return { valid: true, values };
}

// The contract's credential detector (src/secret-shape.ts `secretArgument`, DEC-0151) as it reads a value the schema's
// account pattern admits: no whitespace, `/`, `%`, `\` or `:`, and an alphanumeric first character, so no bearer, path,
// percent or escape form can occur, and the shape boundary is the start or any other character.
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*/;
const KEY_SHAPE = /(?:^|[^A-Za-z0-9])(?:sk-(?=[A-Za-z0-9_-]{0,255}?\d)(?:(?=[A-Za-z0-9_-]{0,255}?[A-Z])[A-Za-z0-9_-]{16,}|[A-Za-z0-9_-]{32,})|gh[pousr]_[A-Za-z0-9]{20,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|glpat-[A-Za-z0-9_-]{20,})/;
const LONG_RUN = /[A-Za-z0-9+/=_-]{40,}/g;
const longSecret = (v: string) => (v.match(LONG_RUN) ?? []).some((run) => /[a-z]/.test(run) && /[A-Z]/.test(run) && /[0-9]/.test(run));
/** Whether a label is shaped like a credential (a label never is one). */
export const credentialShaped = (label: string): boolean => JWT_SHAPE.test(label) || KEY_SHAPE.test(label) || longSecret(label);

interface Setting { peer?: boolean; local?: boolean; subscription?: boolean; login?: boolean }
function settingOf(descriptor: unknown, wellKnown: unknown): Setting {
  const setting: Setting = {};
  if (isObject(descriptor)) {
    setting.peer = isObject(descriptor.peer);
    setting.local = descriptor.placement !== 'remote';
    setting.subscription = isObject(descriptor.runner) && descriptor.runner.credentialKind === 'subscription';
  }
  if (isObject(wellKnown) && isObject(wellKnown.surfaces) && isObject(wellKnown.surfaces.dashboard) && typeof wellKnown.surfaces.dashboard.login === 'boolean') {
    setting.login = wellKnown.surfaces.dashboard.login;
  }
  return setting;
}

/** The reason a clause of IF-6 refuses a declared value in a document, or undefined when it stands (the contract's
 *  wording, so a refusal reads the same in every host). */
function refusal(field: FactField, value: unknown, document: FactsDocument, setting: Setting): string | undefined {
  if (field === 'audience') {
    if (value === 'operator' && setting.peer === true) return 'operator beside peer: a service offered to others serves more than its operator';
    if (value === 'organization' && setting.peer === false && setting.local === true) return 'organization on a local placement needs peer: a host routes others only to a service that declares it (DEC-0061)';
    if (value === 'public' && setting.local === true) return 'public is a remote placement\'s: a local origin is reached from outside the computer only through peer, which no hub routes to anyone at large';
    if (value === 'public' && setting.subscription === true) return 'public beside a subscription runner: a service others reach never runs on the operator\'s subscription (DEC-0046, DEC-0061 item 3)';
    // DEC-0174: an organization's members reaching a remote surface with their own keys still run on its runner, and a
    // subscription serves only its owner's own sessions.
    if (value === 'organization' && setting.subscription === true) return 'organization beside a subscription runner: a subscription serves only its owner\'s own sessions, never an organization\'s members (DEC-0061, DEC-0174)';
  }
  if (field === 'entry' && setting.login !== undefined && (value === 'host-signin') !== setting.login) {
    return setting.login ? 'the dashboard requires a host\'s login code (surfaces.dashboard.login)' : 'the dashboard takes no host\'s login code (surfaces.dashboard.login is false)';
  }
  if (field === 'mode' && value === 'shared' && setting.local === true) return 'shared is a remote service\'s: a local placement names one context and at most one grant (DEC-0082 item 4)';
  if (field === 'mode' && (value === 'shared' || value === 'per-organization') && setting.subscription === true) return `${value} beside a subscription runner: an instance holding others' data serves more than its owner's own sessions (DEC-0061, DEC-0174)`;
  if (field === 'kind' && value === 'system' && setting.local === true) return 'system is a remote placement\'s: a local service runs under a counted OS account (DEC-0154)';
  if (field === 'account') {
    if (document === 'wellKnown' && setting.local === true) return 'a local service\'s well-known document is read by every counted OS account on the computer; the label stays in its descriptor (IF-4)';
    if (typeof value === 'string' && credentialShaped(value)) return 'the label is shaped like a credential; it names a space, never a credential';
  }
  return undefined;
}

/**
 * DEC-0173 IF-5: each field from the well-known document where it declares a value no clause refuses, else from the
 * descriptor's; a refused value is reported and never read. `entry` reads `host-signin` whenever the well-known
 * document's dashboard requires a host's login code and either document declares a fact; a service that declares none
 * reads none. A well-known document that answers as another service gives nothing. Either document may be absent; it
 * never throws.
 */
export function instanceFacts(descriptor: unknown, given: unknown): InstanceFactsView {
  const foreign = answersAsAnother(descriptor, given);
  const wellKnown = foreign ? undefined : given;
  const setting = settingOf(descriptor, wellKnown);
  const sources: Array<[FactsDocument, ReturnType<typeof declaredIn>]> = [['wellKnown', declaredIn(wellKnown)], ['descriptor', declaredIn(descriptor)]];
  const view: InstanceFactsView = { declared: false, facts: {}, refused: [], foreign, invalid: sources.filter(([, read]) => !read.valid).map(([document]) => document) };
  const declaresAny = sources.some(([, read]) => Object.keys(read.values).length > 0);
  for (const [field] of FIELDS) {
    let decided = false;
    for (const [document, read] of sources) {
      if (!has(read.values, field)) continue;
      const value = read.values[field];
      const reason = refusal(field, value, document, setting);
      if (reason !== undefined) { view.refused.push({ document, field, reason }); continue; }
      if (!decided) (view.facts as Record<string, unknown>)[field] = value;
      decided = true;
    }
  }
  if (setting.login === true && declaresAny) view.facts.entry = 'host-signin';
  view.declared = Object.keys(view.facts).length > 0;
  return view;
}
// #endregion instance-facts
