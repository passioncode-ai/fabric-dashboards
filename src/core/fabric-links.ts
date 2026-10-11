// Copied from passioncode-ai/fabric-agent-contract src/fabric-links.ts @7931c1dbb6e6 (DEC-0040, DEC-0041), unchanged
// between its region markers except the region's docs link, minus `deepLinkRules` (the contract's own rule
// runner) and its import. Never edit here: re-copy when the contract changes; test/fabric-button.test.ts checks
// it against the contract's fixtures (test/fixtures/contract/*fabric-link*).
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
/**
 * A parameter name's words: split at `.`, `_`, `-` and camelCase humps, lowercased — `refreshToken_v2-Id` is
 * `refresh token v2 id` and `APIKey` is `api key`. A credential word must be a whole word of the name, so
 * `themeCode`, `sortKey` and `tokenizer` are harmless (DEC-0041, CO-260).
 */
export function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}
/**
 * A name holding one of these words can only carry a credential (FL-4): the words, and the glued forms a name
 * written in one case (`accesstoken`, `sessionid`) leaves unsplit.
 */
export const CREDENTIAL_WORDS = [
  "token", "secret", "password", "passwd", "pass", "passphrase", "credential", "credentials", "cookie", "authorization",
  "bearer", "jwt", "otp", "apikey", "signature", "sig",
  "accesstoken", "idtoken", "authtoken", "refreshtoken", "sessionid", "sessiontoken", "logincode", "authcode", "privatekey",
  "clientsecret", "secretkey", "accesskey"
] as const;
/**
 * Words that carry a credential only beside a partner word in the same name (`api_key`, `authCode`, `sessionId`),
 * or as the whole name (`key`, `auth`, `session`, `code`): `sortKey`, `authorName` and `sessionLength` pass.
 */
export const CREDENTIAL_PAIRS: Readonly<Record<string, readonly string[]>> = {
  key: ["private", "api", "access", "secret", "session", "auth", "signing", "encryption", "master", "client", "login", "refresh"],
  auth: ["token", "code", "header"],
  session: ["token", "id"],
  code: ["login", "auth", "access", "session"]
};
/** A name's words, each also in the singular when it ends in `s`: `apiKeys` is `api key`, `secrets` is `secret`. */
const withSingulars = (words: string[]): string[] => [...words, ...words.filter((word) => word.length > 2 && word.endsWith("s")).map((word) => word.slice(0, -1))];
/** Whether a parameter name can only carry a credential. */
export function credentialName(name: string): boolean {
  const split = nameWords(name);
  const words = withSingulars(split);
  if (words.some((word) => (CREDENTIAL_WORDS as readonly string[]).includes(word))) return true;
  if (split.length === 1 && words.some((word) => Object.hasOwn(CREDENTIAL_PAIRS, word))) return true;
  return Object.entries(CREDENTIAL_PAIRS).some(([word, partners]) => words.includes(word) && partners.some((partner) => words.includes(partner)));
}
/** Words for Fabric to act on; a link carries ids only (FL-4). */
export const PROMPT_WORDS = ["prompt", "message", "msg", "text", "instruction", "instructions"] as const;
const promptName = (name: string) => nameWords(name).some((word) => (PROMPT_WORDS as readonly string[]).includes(word));
/** A JWT or JWS anywhere in a value: three base64url segments, the first a JSON object's `eyJ`. */
export const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*/;
/** A value that says it is a credential, or a provider key's shape (OpenAI, GitHub, Slack, AWS, GitLab). */
export const SECRET_VALUE = /(^bearer\s.+|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|glpat-[A-Za-z0-9_-]{20,})/i;
/**
 * A long secret: 40 or more characters of base64 or base64url (`+`, `/`, `=`, `-`, `_` included), mixing upper case,
 * lower case and digits. A hex digest is lower case and passes.
 */
const LONG_RUN = /[A-Za-z0-9+/=_-]{40,}/g;
const longSecret = (value: string) => (value.match(LONG_RUN) ?? []).some((run) => /[a-z]/.test(run) && /[A-Z]/.test(run) && /[0-9]/.test(run));
/** Whether a value could be a credential: a JWT anywhere, a provider key or `Bearer …`, or a long secret-shaped run. */
export const secretValue = (value: string): boolean => JWT_SHAPE.test(value) || SECRET_VALUE.test(value) || longSecret(value);
/** Percent-decode and keep `+` as `+`: `URLSearchParams` turns a raw `+` into a space, which would split a base64 run. */
const decodeKeepingPlus = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};
/** Each query or fragment piece's raw value, by its decoded name: what `URLSearchParams` hands over, with `+` kept. */
function rawValues(query: string): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (const piece of query.split("&")) {
    if (piece === "") continue;
    const at = piece.indexOf("=");
    const name = [...new URLSearchParams(at < 0 ? piece : piece.slice(0, at)).keys()][0] ?? "";
    values.set(name, [...(values.get(name) ?? []), at < 0 ? "" : decodeKeepingPlus(piece.slice(at + 1))]);
  }
  return values;
}

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
    if (credentialName(name) || secretValue(name) || all.some(secretValue) || (raw.get(name) ?? []).some(secretValue)) { problems.push(`the parameter ${name} could carry a credential; a link never does`); continue; }
    const grammar = Object.hasOwn(known, name) ? known[name] : undefined;
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
