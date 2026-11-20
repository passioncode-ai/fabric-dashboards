// Copied from passioncode-ai/fabric-agent-contract src/fabric-links.ts @4c978495 (DEC-0040, DEC-0041, DEC-0189), unchanged
// between its region markers except the region's docs link, minus `deepLinkRules` (the contract's own rule runner) and
// its `findings` import; its credential detector is the contract's src/secret-shape.ts, copied beside it. Never edit
// here: re-copy when the contract changes; test/fabric-button.test.ts checks it against the contract's fixtures
// (test/fixtures/contract/*fabric-link*).
import { credentialName, nameWords, rawValues, secretValue } from "./secret-shape";

// The credential detector moved to src/secret-shape.ts (DEC-0044); what this module exported stays exported here.
export { CREDENTIAL_PAIRS, CREDENTIAL_WORDS, JWT_SHAPE, SECRET_VALUE, credentialName, nameWords, secretValue } from "./secret-shape";

// #region fabric-links — docs: docs/adr/0021-fabrics-button-in-the-host.md#decision
/**
 * `fabric://` deep links (DEC-0040, DEC-0189): what Fabric's button in a product, and any app that hands a person
 * to Fabric, opens. Four actions: a conversation with Fabric scoped to a service or a project, a new coding-agent
 * session in a project, an existing session's view, and the view that moves a runner's session into Fabric's
 * console. A link opens a view and nothing else; it never carries a secret.
 */

/** An agent id as the hub names one (`interop-agent-call.schema.json` `agentId`): a service id, optionally `.instance`. */
export const AGENT_ID = /^[a-z][a-z0-9-]{1,62}(\.[a-z][a-z0-9-]{0,31})?$/;
/** A project id or slug: no slash, no space, no percent sign left after decoding. */
export const PROJECT_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** A runner kind as the runner catalogue names one (`runners.schema.json`). */
export const RUNNER_KIND = /^[a-z][a-z0-9-]{1,62}$/;
/**
 * A session id (DEC-0189 SL-2): a Fabric session's or a runner session's UUID in its 8-4-4-4-12 hex form
 * (RFC 9562 §4), either case on input; the parser returns it in lower case.
 */
export const SESSION_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const MAX_LINK_LENGTH = 2048;

export type FabricLink =
  | { action: "chat"; service?: string; project?: string }
  | { action: "session.new"; project: string; runner?: string; from?: string }
  | { action: "session.open"; session: string; from?: string }
  | { action: "session.continue"; session: string; from?: string };

export type ParsedLink = { ok: true; link: FabricLink; ignored: string[] } | { ok: false; problems: string[] };

const SHAPE = /^fabric:\/\/(chat|session\/new|session\/open|session\/continue)\/?(?:\?([^#]*))?(?:#(.*))?$/;
const UNKNOWN_ACTION = "not fabric://chat, fabric://session/new, fabric://session/open or fabric://session/continue";
const KNOWN: Record<FabricLink["action"], Record<string, RegExp>> = {
  chat: { service: AGENT_ID, project: PROJECT_REF },
  "session.new": { project: PROJECT_REF, runner: RUNNER_KIND, from: AGENT_ID },
  "session.open": { session: SESSION_ID, from: AGENT_ID },
  "session.continue": { session: SESSION_ID, from: AGENT_ID }
};
/** What a value outside its grammar is called in a problem. */
const GRAMMAR_NAME: Record<string, string> = { service: "agent id", from: "agent id", runner: "runner kind", project: "project id or slug", session: "session id (a UUID)" };
/**
 * The one parameter whose name FL-4 reads as a credential but an action defines (DEC-0189 SL-3): `session` of
 * `session/open` and `session/continue`, whose value must be a UUID. Everywhere else `session` still refuses the link.
 */
const SESSION_ACTIONS: ReadonlySet<FabricLink["action"]> = new Set(["session.open", "session.continue"]);
/** Words for Fabric to act on; a link carries ids only (FL-4). */
export const PROMPT_WORDS = ["prompt", "message", "msg", "text", "instruction", "instructions"] as const;
const promptName = (name: string) => nameWords(name).some((word) => (PROMPT_WORDS as readonly string[]).includes(word));
/**
 * Parse a `fabric://` link. Unknown parameters are ignored and listed; a known one that repeats or does not
 * match its id grammar, a missing required one, an unknown action, and any parameter that could carry a
 * credential refuse the whole link.
 */
export function parseFabricLink(url: string): ParsedLink {
  if (url.length > MAX_LINK_LENGTH) return { ok: false, problems: [`a link is at most ${MAX_LINK_LENGTH} characters`] };
  // The scheme is case-insensitive (RFC 3986 §3.1); the action is not.
  const match = SHAPE.exec(url.replace(/^fabric:/i, "fabric:"));
  if (!match) return { ok: false, problems: [UNKNOWN_ACTION] };
  const action = (match[1] as string).replace("/", ".") as FabricLink["action"];
  // A malformed percent escape stays in the value and fails its id grammar, which admits no `%`.
  const params = new URLSearchParams(match[2] ?? "");
  const problems: string[] = [];
  // The fragment is ignored, but it is part of the link a page hands over: it carries no credential either.
  const fragment = match[3] ?? "";
  if (fragment) {
    // An anchor (`#auth-settings`, `#tokens`) names a place; a credential-named piece with a value carries one.
    const pieces = new URLSearchParams(fragment);
    const raw = [...rawValues(fragment).values()].flat();
    if (secretValue(fragment) || raw.some(secretValue) || [...pieces].some(([name, value]) => (value !== "" && credentialName(name)) || secretValue(value) || secretValue(name))) problems.push("the fragment could carry a credential; a link never does");
  }
  const ignored: string[] = [];
  const values: Record<string, string> = {};
  const known = KNOWN[action];
  const raw = rawValues(match[2] ?? "");
  for (const name of new Set(params.keys())) {
    const all = params.getAll(name);
    if (promptName(name)) { problems.push(`the parameter ${name} carries words to act on; a link carries ids only`); continue; }
    const definedSession = name === "session" && SESSION_ACTIONS.has(action);
    if ((credentialName(name) && !definedSession) || secretValue(name) || all.some(secretValue) || (raw.get(name) ?? []).some(secretValue)) { problems.push(`the parameter ${name} could carry a credential; a link never does`); continue; }
    const grammar = Object.hasOwn(known, name) ? known[name] : undefined;
    if (!grammar) { ignored.push(name); continue; }
    if (all.length > 1) { problems.push(`${name} is given ${all.length} times`); continue; }
    const value = all[0] ?? "";
    if (!grammar.test(value)) { problems.push(`${name} is not a valid ${GRAMMAR_NAME[name]}`); continue; }
    values[name] = name === "session" ? value.toLowerCase() : value;
  }
  if (action === "chat" && values.service === undefined && values.project === undefined && !problems.some((p) => /^(service|project) /.test(p))) problems.push("a chat link names a service, a project or both");
  if (action === "session.new" && values.project === undefined && !problems.some((p) => p.startsWith("project "))) problems.push("a session link names its project");
  if (SESSION_ACTIONS.has(action) && values.session === undefined && !problems.some((p) => /^(the parameter )?session /.test(p))) problems.push(`a ${action.replace(".", "/")} link names its session`);
  if (problems.length) return { ok: false, problems };
  const from = values.from ? { from: values.from } : {};
  const link: FabricLink = action === "chat"
    ? { action, ...(values.service ? { service: values.service } : {}), ...(values.project ? { project: values.project } : {}) }
    : action === "session.new"
      ? { action, project: values.project as string, ...(values.runner ? { runner: values.runner } : {}), ...from }
      : { action, session: values.session as string, ...from };
  return { ok: true, link, ignored };
}

/** Build the link for a parsed value; throws on a value the grammar refuses, so a page cannot emit a bad link. */
export function buildFabricLink(link: FabricLink): string {
  const query = new URLSearchParams();
  if (link.action === "chat") {
    if (link.service !== undefined) query.set("service", link.service);
    if (link.project !== undefined) query.set("project", link.project);
  } else if (link.action === "session.new") {
    query.set("project", link.project);
    if (link.runner !== undefined) query.set("runner", link.runner);
  } else {
    query.set("session", link.session);
  }
  if (link.action !== "chat" && link.from !== undefined) query.set("from", link.from);
  const url = `fabric://${link.action.replace(".", "/")}?${query.toString()}`;
  const parsed = parseFabricLink(url);
  if (!parsed.ok) throw new TypeError(parsed.problems.join("; "));
  return url;
}

// #endregion fabric-links
