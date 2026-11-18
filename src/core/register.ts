// #region register-link — docs: docs/ux/scenarios.md#scn-121-register-an-organizations-agents-from-a-link
// FD-193: a member of an organization adds the agents they hold a grant to, on a showcase the organization runs
// (studio-agent DEC-0075, its `docs/design/showcase.md` §4), from one link the organization's assistant gives them:
// `fabric-dashboards://register?origin=https://<showcase>&invite=<one-time code>`. The link carries no token: the main
// process redeems the code for a host token (`POST <origin>/auth/enroll` with `host: true`), keeps the token in a 0600
// file beside the descriptors, and writes one online descriptor (placement remote) for the showcase and one for each
// agent address its well-known names for this person. Nothing of the token reaches a page, a URL or a log (SECURITY.md).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { remoteOriginProblem, validateDescriptor } from '@passioncode-ai/fabric-service-host';
import { atomicWrite } from './fsutil';

/** The one-time invitation code: 192 bits in base64url (32 characters); a little room either side. */
const INVITE = /^[A-Za-z0-9_-]{22,128}$/;
/** What a showcase hands back: a device id and a host token, both opaque, never whitespace. */
const DEVICE = /^[A-Za-z0-9_-]{8,128}$/;
const TOKEN = /^[A-Za-z0-9._~+/=-]{16,512}$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const REGISTER_TIMEOUT_MS = 15_000;
/** The showcase's extension in its well-known, naming the agent address of each agent this person holds. */
export const SHOWCASE_EXTENSION = 'studio-agent:showcase';
/** At most this many agent addresses are registered from one link (a real showcase names a handful). */
export const REGISTER_MAX_HOSTS = 50;

export type RegisterLink = { origin: string; invite: string };

/** `register?origin=…&invite=…`, each once, nothing else; the origin as strict as an online descriptor's. */
export function parseRegisterLink(url: URL): RegisterLink | { reason: string } {
  if ((url.pathname && url.pathname !== '/') || url.hash) return { reason: 'register takes two parameters only: register?origin=…&invite=…' };
  for (const name of new Set(url.searchParams.keys())) {
    if (name !== 'origin' && name !== 'invite') return { reason: `unknown parameter ${JSON.stringify(name.slice(0, 40))}; a register link takes only origin= and invite=` };
    if (url.searchParams.getAll(name).length > 1) return { reason: `the parameter "${name}" appears more than once` };
  }
  const origin = url.searchParams.get('origin');
  const invite = url.searchParams.get('invite');
  if (origin === null || invite === null) return { reason: 'a register link names both origin= and invite=' };
  const problem = remoteOriginProblem(origin);
  if (problem) return { reason: problem };
  if (!INVITE.test(invite)) return { reason: 'the invitation code is not one a showcase gives' };
  return { origin: origin.toLowerCase(), invite };
}

/** FD-331: a pasted invitation: the whole `fabric-dashboards://register?…` link (spaces around it ignored). */
export function connectLinkOf(text: string): RegisterLink | { reason: string } {
  let url: URL;
  try { url = new URL(text.trim()); } catch { return { reason: 'paste the invitation link, fabric-dashboards://register?origin=…&invite=…' }; }
  if (url.protocol !== 'fabric-dashboards:' || url.hostname !== 'register') return { reason: 'paste the invitation link, fabric-dashboards://register?origin=…&invite=…' };
  return parseRegisterLink(url);
}

/** The host of an `https://` origin, without its port. */
export const hostOf = (origin: string): string => new URL(origin).hostname;

/** FD-193: an agent address a showcase names is used with the host token only when it is a DNS name under the
 *  showcase's own parent domain (`sc-x.example.com` beside `agents.example.com`), or under the showcase itself; a
 *  showcase never sends this person's token to another site. */
export function agentHostAllowed(apex: string, host: string): boolean {
  const labels = host.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || host.length > 253) return false;
  if (host.endsWith(`.${apex}`)) return true;
  const parent = apex.split('.').slice(1);
  return parent.length >= 2 && host.endsWith(`.${parent.join('.')}`);
}

export type RegisterFailure = { code: 'invite_refused' | 'not_for_host' | 'unreachable' | 'bad_answer' | 'nothing_written'; detail: string };
export type RegisterResult =
  | { ok: true; host: string; written: string[]; skipped: { key: string; why: string }[] }
  | ({ ok: false; host: string } & RegisterFailure);

export type RegisterDeps = {
  fetch: typeof fetch;
  servicesDir: string;
  /** The computer's name, sent as the device's label. */
  label: string;
  /** Who wrote the descriptors, as `installedBy` says it. */
  installedBy: string;
  now: () => Date;
  /** Keeps the device key's private half sealed by the app (macOS Keychain); false when it cannot. */
  keepKey: (host: string, pem: string) => boolean;
};

const fail = (host: string, code: RegisterFailure['code'], detail: string): RegisterResult => ({ ok: false, host, code, detail });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** A file name made of an origin's host: letters, digits, dots and dashes only. */
const fileHost = (host: string) => host.replace(/[^a-z0-9.-]/g, '-');

async function call(deps: RegisterDeps, url: string, init: RequestInit): Promise<Response> {
  return deps.fetch(url, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(REGISTER_TIMEOUT_MS) });
}

/** The well-known of one address with the host token, or why it could not be read. */
async function wellKnown(deps: RegisterDeps, origin: string, token: string): Promise<Record<string, unknown> | string> {
  let res: Response;
  try {
    res = await call(deps, `${origin}/.well-known/fabric-service`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  } catch (error) {
    return `${hostOf(origin)} could not be reached: ${(error as Error).message}`;
  }
  if (!res.ok) return `${hostOf(origin)} answered HTTP ${res.status}`;
  try {
    const body = await res.json();
    return isObj(body) ? body : `${hostOf(origin)} answered something that is not a well-known`;
  } catch {
    return `${hostOf(origin)} answered something that is not JSON`;
  }
}

/** One online descriptor for an address, from its own well-known; null with why when it is not a usable one. */
export function descriptorFor(origin: string, known: Record<string, unknown>, tokenFile: string, installedBy: string, at: Date): { key: string; descriptor: Record<string, unknown> } | { why: string } {
  const service = isObj(known.service) ? known.service : null;
  if (!service) return { why: `${hostOf(origin)}'s well-known names no service` };
  const name = typeof service.name === 'string' ? service.name.trim().slice(0, 80) : '';
  const descriptor = {
    protocol: 'fabric-service/0.1',
    id: service.id,
    instance: service.instance,
    name: name || hostOf(origin),
    placement: 'remote',
    origin,
    lifecycle: { manager: 'none' },
    auth: { tokenFile },
    installedAt: at.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    installedBy,
  };
  const problems = validateDescriptor(descriptor);
  if (problems.length) return { why: `${hostOf(origin)}: ${problems[0]}` };
  return { key: `${descriptor.id as string}.${descriptor.instance as string}`, descriptor };
}

/** Redeem the invitation, keep the token, and write a descriptor for the showcase and each agent address it names. */
export async function register(link: RegisterLink, deps: RegisterDeps): Promise<RegisterResult> {
  const host = hostOf(link.origin);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  let res: Response;
  try {
    res = await call(deps, `${link.origin}/auth/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code: link.invite, jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, label: deps.label.slice(0, 80), host: true }),
    });
  } catch (error) {
    return fail(host, 'unreachable', `${host} could not be reached: ${(error as Error).message}`);
  }
  if (res.status === 401) return fail(host, 'invite_refused', 'the invitation is wrong, expired or already used');
  if (res.status === 403) return fail(host, 'not_for_host', 'the invitation is for a browser, not for this app');
  if (!res.ok) return fail(host, 'bad_answer', `${host} answered HTTP ${res.status}`);
  let answer: unknown;
  try { answer = await res.json(); } catch { return fail(host, 'bad_answer', `${host} answered something that is not JSON`); }
  const token = isObj(answer) ? answer.hostToken : undefined;
  if (!isObj(answer) || typeof answer.device !== 'string' || !DEVICE.test(answer.device) || typeof token !== 'string' || !TOKEN.test(token)) {
    return fail(host, 'bad_answer', `${host} gave no host token`);
  }
  // The code is spent now: the token is kept before anything else can fail, so a failure below never loses it.
  fs.mkdirSync(deps.servicesDir, { recursive: true, mode: 0o700 });
  const tokenFile = path.join(deps.servicesDir, `showcase-${fileHost(host)}.token`);
  atomicWrite(tokenFile, token, 0o600);
  deps.keepKey(host, privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());

  const written: string[] = [];
  const skipped: { key: string; why: string }[] = [];
  const at = deps.now();
  const write = (origin: string, known: Record<string, unknown>) => {
    const made = descriptorFor(origin, known, tokenFile, deps.installedBy, at);
    if ('why' in made) { skipped.push({ key: hostOf(origin), why: made.why }); return; }
    const file = path.join(deps.servicesDir, `${made.key}.json`);
    try {
      const before = JSON.parse(fs.readFileSync(file, 'utf8')) as { origin?: unknown };
      if (before.origin !== origin) { skipped.push({ key: made.key, why: `${made.key} is already installed for ${String(before.origin)}` }); return; }
    } catch { /* no descriptor yet, or one that cannot be read: written below */ }
    atomicWrite(file, `${JSON.stringify(made.descriptor, null, 2)}\n`, 0o600);
    written.push(made.key);
  };
  const apex = await wellKnown(deps, link.origin, token);
  if (typeof apex === 'string') return fail(host, 'nothing_written', `the token is kept, but ${apex}`);
  write(link.origin, apex);
  const ext = isObj(apex.extensions) && isObj(apex.extensions[SHOWCASE_EXTENSION]) ? apex.extensions[SHOWCASE_EXTENSION] : null;
  const hosts = ext && isObj(ext.hosts) ? Object.values(ext.hosts) : [];
  for (const agentHost of hosts.slice(0, REGISTER_MAX_HOSTS)) {
    if (typeof agentHost !== 'string' || !agentHostAllowed(host, agentHost.toLowerCase())) {
      skipped.push({ key: String(agentHost).slice(0, 80), why: 'an agent address outside the showcase\'s own domain is never sent the token' });
      continue;
    }
    const origin = `https://${agentHost.toLowerCase()}`;
    const known = await wellKnown(deps, origin, token);
    if (typeof known === 'string') skipped.push({ key: agentHost, why: known });
    else write(origin, known);
  }
  if (!written.length) return fail(host, 'nothing_written', `the token is kept, but ${skipped[0]?.why ?? 'no address could be registered'}`);
  return { ok: true, host, written, skipped };
}
// #endregion register-link
