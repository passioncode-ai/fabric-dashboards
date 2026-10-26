// #region actions-declaration — docs: packages/service-host/README.md#actions
// FD-110: what a person can do on a service's pages and the agent tool that does the same (Fabric Agent Contract
// DEC-0121, docs/specification/service.md §Actions, AP-1). The well-known document declares `actions[]` of
// `{id, title, tool, gate, humanStep?}` under ACTIONS_EXTENSION. FAC-SEM-142: a value that is not its schema's is not
// declared, and is reported; an id named twice, a `humanStep` that disagrees with `gate`, and a `tool` a present
// `surfaces.mcp.capabilities` does not list (a button without an agent twin) are findings on a valid one. The contract's
// reference is `actionsView` and `actionsExtensionRules` in its src/actions.ts; this is a port of both, checked on its
// fixtures and vectors. Pure: no Node import, so a renderer may import `@passioncode-ai/fabric-service-host/actions`.

/** The `extensions` key of a service's actions declaration (DEC-0121, protocol `fabric-actions/0.1`). */
export const ACTIONS_EXTENSION = 'https://fabric.passioncode.ai/agent-contract/extensions/actions/0.1';

export type ActionGate = 'none' | 'relayed' | 'human';
export type HumanStep = 'sign-in' | 'consent' | 'payment' | 'secret' | 'spend-above-limit' | 'passkey';
export interface DeclaredAction { id: string; title: string; tool: string; gate: ActionGate; humanStep?: HumanStep }

/** One FAC-SEM-142 finding: where in the well-known document, and what is wrong. */
export interface ActionFinding { code: 'FAC-SEM-142'; instancePath: string; message: string }

export interface ActionsView {
  /** A valid declaration is present. */
  declared: boolean;
  /** The key is present and its value is invalid: not declared, and reported (FAC-SEM-142). */
  reported: boolean;
  /** The declared actions; empty unless `declared`. */
  actions: DeclaredAction[];
  /** Why the value is invalid. */
  errors: string[];
  /** Every FAC-SEM-142 finding on the document, in the contract's order. */
  findings: ActionFinding[];
}

const GATES: readonly string[] = ['none', 'relayed', 'human'];
const STEPS: readonly string[] = ['sign-in', 'consent', 'payment', 'secret', 'spend-above-limit', 'passkey'];
const REQUEST_KEY = /^[A-Za-z0-9_.-]{1,64}$/; // interop-common.schema.json#/$defs/requestKey
const CAPABILITY = /^[a-z][a-z0-9._-]{1,127}$/; // common.schema.json#/$defs/capabilityName
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Every reason an actions declaration is invalid (service-actions-extension.schema.json, by hand). */
export function actionDeclarationErrors(v: unknown): string[] {
  if (!isPlain(v)) return ['/ type: must be object'];
  const out: string[] = [];
  for (const k of Object.keys(v)) if (k !== 'actions') out.push(`/ additionalProperties: ${k}`);
  if (!has(v, 'actions')) return [...out, '/ required: actions'];
  const list = v.actions;
  if (!Array.isArray(list)) return [...out, '/actions type: must be array'];
  if (list.length < 1) out.push('/actions minItems: must have at least 1 item');
  if (list.length > 128) out.push('/actions maxItems: must have at most 128 items');
  list.forEach((a, i) => {
    const at = `/actions/${i}`;
    if (!isPlain(a)) { out.push(`${at} type: must be object`); return; }
    for (const k of Object.keys(a)) if (!['id', 'title', 'tool', 'gate', 'humanStep'].includes(k)) out.push(`${at} additionalProperties: ${k}`);
    for (const k of ['id', 'title', 'tool', 'gate']) if (!has(a, k)) out.push(`${at} required: ${k}`);
    if (has(a, 'id') && !(typeof a.id === 'string' && REQUEST_KEY.test(a.id))) out.push(`${at}/id pattern`);
    if (has(a, 'title') && !(typeof a.title === 'string' && a.title.length >= 1 && [...a.title].length <= 80)) out.push(`${at}/title length: 1 to 80`);
    if (has(a, 'tool') && !(typeof a.tool === 'string' && CAPABILITY.test(a.tool))) out.push(`${at}/tool pattern`);
    if (has(a, 'gate') && !GATES.includes(a.gate as string)) out.push(`${at}/gate enum`);
    if (has(a, 'humanStep') && !STEPS.includes(a.humanStep as string)) out.push(`${at}/humanStep enum`);
  });
  return out;
}

const pointerToken = (token: string) => token.replace(/~/g, '~0').replace(/\//g, '~1');
const KEY_PATH = `/extensions/${pointerToken(ACTIONS_EXTENSION)}`;
const flag = (instancePath: string, message: string): ActionFinding => ({ code: 'FAC-SEM-142', instancePath, message });

/** A service's actions as its well-known document declares them, with FAC-SEM-142's findings (DEC-0121). */
export function actionsOf(wellKnown: unknown): ActionsView {
  const none: ActionsView = { declared: false, reported: false, actions: [], errors: [], findings: [] };
  const extensions = isPlain(wellKnown) && isPlain(wellKnown.extensions) ? wellKnown.extensions : undefined;
  if (!extensions || !has(extensions, ACTIONS_EXTENSION)) return none;
  const value = extensions[ACTIONS_EXTENSION];
  const errors = actionDeclarationErrors(value);
  if (errors.length) {
    return { ...none, reported: true, errors, findings: [flag(KEY_PATH, `the actions declaration is invalid (${errors.join('; ')}); a reader treats it as not declared and reports it (DEC-0121)`)] };
  }
  const actions = (value as { actions: DeclaredAction[] }).actions;
  const surfaces = isPlain(wellKnown) && isPlain(wellKnown.surfaces) ? wellKnown.surfaces : {};
  const mcp = isPlain(surfaces.mcp) ? surfaces.mcp : {};
  const capabilities = Array.isArray(mcp.capabilities) ? (mcp.capabilities as unknown[]) : undefined;
  const findings: ActionFinding[] = [];
  const seen = new Set<string>();
  actions.forEach((action, i) => {
    const at = `${KEY_PATH}/actions/${i}`;
    if (seen.has(action.id)) findings.push(flag(`${at}/id`, `action ${action.id} is declared twice`));
    seen.add(action.id);
    if ((action.gate === 'human') !== (action.humanStep !== undefined)) findings.push(flag(`${at}/humanStep`, 'humanStep is present exactly when gate is human (DEC-0121 AP-4)'));
    if (capabilities !== undefined && !capabilities.includes(action.tool)) findings.push(flag(`${at}/tool`, `the MCP surface does not serve ${action.tool}: a button without an agent twin (DEC-0121 AP-1)`));
  });
  return { declared: true, reported: false, actions, errors: [], findings };
}
// #endregion actions-declaration
