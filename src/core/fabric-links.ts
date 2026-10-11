// Copied from passioncode-ai/fabric-agent-contract src/fabric-links.ts @8e49fbd (DEC-0040), unchanged
// between its region markers except the region's docs link, minus `deepLinkRules` (the contract's own rule
// runner) and its import.
// Never edit here: re-copy when the contract changes; test/fabric-button.test.ts checks it against the
// contract's fixtures (test/fixtures/contract/*fabric-link*).
// #region fabric-links — docs: docs/adr/0021-fabrics-button-in-the-host.md#decision
/**
 * `fabric://` deep links (DEC-0040): what Fabric's button in a product opens. Two actions — a conversation
 * with Fabric scoped to a service or a project, and a coding-agent session in a project. A link opens a view
 * and nothing else; it never carries a secret.
 */

/** An agent id as the hub names one (`interop-agent-call.schema.json` `agentId`): a service id, optionally `.instance`. */
export const AGENT_ID = /^[a-z][a-z0-9-]{1,62}(\.[a-z][a-z0-9-]{0,31})?$/;
/** A project id or slug: no slash, no space, no percent sign left after decoding. */
export const PROJECT_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** A runner kind as the runner catalogue names one (`runners.schema.json`). */
export const RUNNER_KIND = /^[a-z][a-z0-9-]{1,62}$/;
export const MAX_LINK_LENGTH = 2048;

export type FabricLink =
  | { action: "chat"; service?: string; project?: string }
  | { action: "session.new"; project: string; runner?: string };

export type ParsedLink = { ok: true; link: FabricLink; ignored: string[] } | { ok: false; problems: string[] };

const SHAPE = /^fabric:\/\/(chat|session\/new)\/?(?:\?([^#]*))?(?:#(.*))?$/;
const KNOWN: Record<FabricLink["action"], Record<string, RegExp>> = {
  chat: { service: AGENT_ID, project: PROJECT_REF },
  "session.new": { project: PROJECT_REF, runner: RUNNER_KIND }
};
/** Parameter names that can only carry a credential; a link carrying one is refused whole, not trimmed. */
const SECRET_NAME = /(^|[._-])(token|access[_-]?token|id[_-]?token|secret|password|passwd|pass|key|api[_-]?key|code|login[_-]?code|auth|authorization|bearer|cookie|session[_-]?id|credential|credentials|jwt|otp|signature|sig)([._-]|$)/i;
/** Parameter names that carry words for Fabric to act on; a link carries ids only (FL-4). */
const PROMPT_NAME = /(^|[._-])(prompt|message|msg|text|instruction|instructions)([._-]|$)/i;
/** `authToken` → `auth_token`, so a camelCase name meets the same word boundaries as a snake_case one. */
const words = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
const refusedName = (name: string) => SECRET_NAME.test(words(name)) || PROMPT_NAME.test(words(name));
/** Values shaped like a bearer credential: a JWT/JWS, or a value that says it is one. */
const SECRET_VALUE = /^(eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*|bearer\s.+|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,})$/i;

/**
 * Parse a `fabric://` link. Unknown parameters are ignored and listed; a known one that repeats or does not
 * match its id grammar, a missing required one, an unknown action, and any parameter that could carry a
 * credential refuse the whole link.
 */
export function parseFabricLink(url: string): ParsedLink {
  if (url.length > MAX_LINK_LENGTH) return { ok: false, problems: [`a link is at most ${MAX_LINK_LENGTH} characters`] };
  // The scheme is case-insensitive (RFC 3986 §3.1); the action is not.
  const match = SHAPE.exec(url.replace(/^fabric:/i, "fabric:"));
  if (!match) return { ok: false, problems: ["not fabric://chat or fabric://session/new"] };
  const action: FabricLink["action"] = match[1] === "chat" ? "chat" : "session.new";
  // A malformed percent escape stays in the value and fails its id grammar, which admits no `%`.
  const params = new URLSearchParams(match[2] ?? "");
  const problems: string[] = [];
  // The fragment is ignored, but it is part of the link a page hands over: it carries no credential either.
  const fragment = match[3] ?? "";
  if (fragment) {
    const pieces = new URLSearchParams(fragment);
    if (SECRET_VALUE.test(fragment) || [...pieces].some(([name, value]) => SECRET_NAME.test(words(name)) || SECRET_VALUE.test(value))) problems.push("the fragment could carry a credential; a link never does");
  }
  const ignored: string[] = [];
  const values: Record<string, string> = {};
  const known = KNOWN[action];
  for (const name of new Set(params.keys())) {
    const all = params.getAll(name);
    if (PROMPT_NAME.test(words(name))) { problems.push(`the parameter ${name} carries words to act on; a link carries ids only`); continue; }
    if (refusedName(name) || all.some((value) => SECRET_VALUE.test(value))) { problems.push(`the parameter ${name} could carry a credential; a link never does`); continue; }
    const grammar = known[name];
    if (!grammar) { ignored.push(name); continue; }
    if (all.length > 1) { problems.push(`${name} is given ${all.length} times`); continue; }
    const value = all[0] ?? "";
    if (!grammar.test(value)) { problems.push(`${name} is not a valid ${name === "service" ? "agent id" : name === "runner" ? "runner kind" : "project id or slug"}`); continue; }
    values[name] = value;
  }
  if (action === "chat" && values.service === undefined && values.project === undefined && !problems.some((p) => /^(service|project) /.test(p))) problems.push("a chat link names a service, a project or both");
  if (action === "session.new" && values.project === undefined && !problems.some((p) => p.startsWith("project "))) problems.push("a session link names its project");
  if (problems.length) return { ok: false, problems };
  const link: FabricLink = action === "chat"
    ? { action, ...(values.service ? { service: values.service } : {}), ...(values.project ? { project: values.project } : {}) }
    : { action, project: values.project as string, ...(values.runner ? { runner: values.runner } : {}) };
  return { ok: true, link, ignored };
}

/** Build the link for a parsed value; throws on a value the grammar refuses, so a page cannot emit a bad link. */
export function buildFabricLink(link: FabricLink): string {
  const query = new URLSearchParams();
  if (link.action === "chat") {
    if (link.service !== undefined) query.set("service", link.service);
    if (link.project !== undefined) query.set("project", link.project);
  } else {
    query.set("project", link.project);
    if (link.runner !== undefined) query.set("runner", link.runner);
  }
  const url = `fabric://${link.action === "chat" ? "chat" : "session/new"}?${query.toString()}`;
  const parsed = parseFabricLink(url);
  if (!parsed.ok) throw new TypeError(parsed.problems.join("; "));
  return url;
}

// #endregion fabric-links
