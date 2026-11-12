// #region setup-layers — docs: docs/ux/scenarios.md#scn-100-see-the-setup-as-steps-the-agent-works-through
// FD-208, FD-209 (passioncode-platform PLAT-148): the reader of fabric-agent-contract's `setup-step/1` and
// `setup-layer/1` (CT-290, design `docs/evidence/plans/2026-11-12-ct290-setup-step.md` at `dfaaf542`, rules SS-1 to
// SS-6; the decision follows with the organization slice's next cut). Each owner answers its own layer; this file
// checks an answer as the design's rules say, orders the layers and builds the person's sheet, and computes no step's
// state (SS-4). Until the launcher emits records (its PC-179), its doctor steps are mapped into the computer layer.
import { setupSteps, type DoctorGate, type DoctorReport } from './doctor';

export const SETUP_LAYERS = ['computer', 'places', 'organization', 'people'] as const;
export type SetupLayer = (typeof SETUP_LAYERS)[number];
/** SS-3: AP-4's seven `humanStep` gates and the three the platform's report adds; one closed list. */
export const SETUP_GATES = ['sign-in', 'consent', 'payment', 'secret', 'spend-above-limit', 'passkey', 'comparison', 'one-time-code', 'attest', 'publish'] as const;
export type SetupGate = (typeof SETUP_GATES)[number];
export const SETUP_STATES = ['done', 'next', 'working', 'waiting', 'blocked'] as const;
export type SetupState = (typeof SETUP_STATES)[number];
export type SetupActor = 'agent' | 'person' | 'machine';

export interface SetupStepRecord {
  id: string; layer: SetupLayer; order: number; title: string; state: SetupState; actor: SetupActor;
  waitsOn?: string[] | { until: string };
  gate?: SetupGate; why?: string; door?: { name: string } | { argv: string[] }; link?: string; evidence?: string[];
}
export interface SetupLayerAnswer { type: 'setup-layer/1'; layer: SetupLayer; owner: string; generatedAt: string; steps: SetupStepRecord[] }

/** The owner of the computer layer until the launcher has a descriptor of its own (answer `6559aeaf` on thread `638a2e88`). */
export const LAUNCHER_OWNER = 'passioncode.launcher';

const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const OWNER = /^[a-z0-9][a-z0-9-]{0,62}\.[a-z0-9][a-z0-9-]{0,62}$/;
const RFC3339 = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/;
const ONE_LINE = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\r\n]/.test(v);
/** SS-6: no home folder and nothing shaped like a credential in a step's command. */
const HOME = /(^|[\s=:'"])(~\/|\/Users\/[^/\s]+|\/home\/[^/\s]+|[A-Za-z]:\\Users\\)/;
const SECRET = /(sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abpr]-|AKIA[0-9A-Z]{16}|Bearer\s+\S{12,}|(token|secret|password|passwd|api[-_]?key)=\S+)/i;

type Parsed = { ok: true; answer: SetupLayerAnswer } | { ok: false; error: string };
const no = (error: string): Parsed => ({ ok: false, error });

/** SS-1, SS-2, SS-6: an owner's answer, refused whole with the first broken rule (the DEC's one FAC-SEM code). */
export function parseSetupLayer(raw: unknown): Parsed {
  let d = raw;
  if (typeof raw === 'string') { try { d = JSON.parse(raw); } catch { return no('not JSON'); } }
  const a = d as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return no('not an object');
  if (a.type !== 'setup-layer/1') return no('type is not setup-layer/1');
  if (!(SETUP_LAYERS as readonly unknown[]).includes(a.layer)) return no('unknown layer');
  if (typeof a.owner !== 'string' || !OWNER.test(a.owner)) return no('owner is not a service key (id.instance)');
  if (typeof a.generatedAt !== 'string' || !RFC3339.test(a.generatedAt)) return no('generatedAt is not RFC 3339');
  if (!Array.isArray(a.steps) || a.steps.length > 256) return no('steps is not a list of at most 256');
  const steps: SetupStepRecord[] = [];
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const raw of a.steps as Record<string, unknown>[]) {
    const s = raw ?? {};
    const at = typeof s.id === 'string' ? s.id : '?';
    if (typeof s.id !== 'string' || !ID.test(s.id)) return no(`a step id is not ${ID.source}`);
    if (ids.has(s.id)) return no(`step ${at}: id twice`);
    ids.add(s.id);
    if (s.layer !== a.layer) return no(`step ${at}: layer is not the answer's`);
    if (!Number.isInteger(s.order) || (s.order as number) < 1) return no(`step ${at}: order is not a positive integer`);
    if (orders.has(s.order as number)) return no(`step ${at}: order twice`);
    orders.add(s.order as number);
    if (!ONE_LINE(s.title, 200)) return no(`step ${at}: title is not one line`);
    if (!(SETUP_STATES as readonly unknown[]).includes(s.state)) return no(`step ${at}: unknown state`);
    if (s.actor !== 'agent' && s.actor !== 'person' && s.actor !== 'machine') return no(`step ${at}: unknown actor`);
    const person = s.actor === 'person';
    if (person !== (s.gate !== undefined)) return no(`step ${at}: gate is for a person's step only, and every person's step has one`);
    if (person && !(SETUP_GATES as readonly unknown[]).includes(s.gate)) return no(`step ${at}: gate outside the ten of SS-3`);
    if ((s.actor === 'agent') !== (s.door !== undefined)) return no(`step ${at}: door is for an agent's step only, and every agent's step has one`);
    if (s.door !== undefined) {
      const door = s.door as Record<string, unknown>;
      const named = typeof door?.name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(door.name);
      const argv = Array.isArray(door?.argv) && door.argv.length > 0 && door.argv.length <= 64 && door.argv.every((x) => typeof x === 'string' && x.length <= 1000);
      if (named === argv) return no(`step ${at}: door is one of name or argv`);
      const text = named ? (door.name as string) : (door.argv as string[]).join(' ');
      if (SECRET.test(text)) return no(`step ${at}: door carries what looks like a secret`);
      if (HOME.test(text)) return no(`step ${at}: door names a home folder`);
    }
    const needsWhy = person || s.state === 'blocked';
    if (s.why !== undefined ? !ONE_LINE(s.why, 500) : needsWhy) return no(`step ${at}: why is required for a person's or a blocked step, one line`);
    if (s.link !== undefined && (typeof s.link !== 'string' || !/^(https:\/\/|fabric-dashboards:\/\/)\S{1,2000}$/.test(s.link))) return no(`step ${at}: link is not https or an open link`);
    if (s.evidence !== undefined) {
      if (s.state !== 'done') return no(`step ${at}: evidence is for a done step only`);
      if (!Array.isArray(s.evidence) || s.evidence.length < 1 || s.evidence.length > 8 || !s.evidence.every((e) => ONE_LINE(e, 300))) return no(`step ${at}: evidence is 1 to 8 references`);
    }
    if ((s.state === 'waiting') !== (s.waitsOn !== undefined)) return no(`step ${at}: waitsOn goes with waiting, and only with it`);
    if (s.waitsOn !== undefined) {
      const w = s.waitsOn as unknown;
      const list = Array.isArray(w) && w.length >= 1 && w.length <= 16 && w.every((x) => typeof x === 'string');
      const until = !Array.isArray(w) && typeof (w as { until?: unknown })?.until === 'string' && RFC3339.test((w as { until: string }).until);
      if (!list && !until) return no(`step ${at}: waitsOn is 1 to 16 step ids or { until }`);
    }
    steps.push(s as unknown as SetupStepRecord);
  }
  for (const s of steps) {
    if (Array.isArray(s.waitsOn)) for (const w of s.waitsOn) if (!ids.has(w) || w === s.id) return no(`step ${s.id}: waitsOn names a step not in this answer`);
  }
  // A cycle among waits: no step can ever start.
  const waits = new Map(steps.map((s) => [s.id, Array.isArray(s.waitsOn) ? s.waitsOn : []]));
  const seen = new Map<string, 1 | 2>();
  const cyclic = (id: string): boolean => {
    if (seen.get(id) === 2) return false;
    if (seen.get(id) === 1) return true;
    seen.set(id, 1);
    for (const w of waits.get(id) ?? []) if (cyclic(w)) return true;
    seen.set(id, 2);
    return false;
  };
  for (const s of steps) if (cyclic(s.id)) return no(`step ${s.id}: waitsOn makes a cycle`);
  steps.sort((x, y) => x.order - y.order);
  return { ok: true, answer: { type: 'setup-layer/1', layer: a.layer as SetupLayer, owner: a.owner, generatedAt: a.generatedAt, steps } };
}

export interface SetupLayerView { layer: SetupLayer; owner: string; read: boolean; generatedAt: string | null; steps: SetupStepRecord[] }
export interface SetupView { layers: SetupLayerView[]; sheet: SetupStepRecord[]; next: { steps: number; yours: number } }

/** SS-4 and SS-5: the layers that have an owner here, in the fixed order; a declared owner's layer with no answer reads
 *  `read: false` and shows no step; the sheet is the person's steps not done; `next` counts the steps not done. */
export function setupView(owners: { layer: SetupLayer; owner: string }[], answers: SetupLayerAnswer[]): SetupView {
  const layers = SETUP_LAYERS.flatMap((layer): SetupLayerView[] => {
    const owner = owners.find((o) => o.layer === layer)?.owner;
    if (!owner) return [];
    const answer = answers.find((a) => a.layer === layer && a.owner === owner);
    return [{ layer, owner, read: !!answer, generatedAt: answer?.generatedAt ?? null, steps: answer?.steps ?? [] }];
  });
  const open = layers.flatMap((l) => l.steps.filter((s) => s.state !== 'done'));
  const sheet = open.filter((s) => s.actor === 'person');
  return { layers, sheet, next: { steps: open.length, yours: sheet.length } };
}

const GATE: Record<DoctorGate, SetupGate> = { 'sign-in': 'sign-in', code: 'one-time-code', consent: 'consent', payment: 'payment', secret: 'secret' };
const SETUP_DOOR = ['npx', '--yes', '@passioncode-ai/passioncode@latest', 'setup'];

/** FD-208: the launcher's doctor steps (FD-185) as the computer layer, until the launcher emits `setup-step/1` itself
 *  (PC-179). A failing area is `blocked`, a warning one `next`; a step whose check names a gate is the person's. */
export function doctorLayer(report: DoctorReport, generatedAt: string, title: (area: string) => string): SetupLayerAnswer {
  const steps = setupSteps(report).steps.map((step, i): SetupStepRecord => {
    const base = { id: `computer.${step.area}`, layer: 'computer' as const, order: i + 1, title: title(step.area) };
    if (step.state === 'done') {
      const evidence = report.checks.filter((c) => c.area === step.area).slice(0, 8).map((c) => `doctor:${c.id}`);
      return { ...base, state: 'done', actor: 'agent', door: { argv: SETUP_DOOR }, ...(evidence.length ? { evidence } : {}) };
    }
    const state: SetupState = step.state === 'todo' ? 'blocked' : 'next';
    const why = ((step.gateCheck ?? step.first)?.detail.split(/\r?\n/)[0] ?? '').slice(0, 500) || 'The check names no detail.';
    if (step.gate) return { ...base, state, actor: 'person', gate: GATE[step.gate], why };
    return { ...base, state, actor: 'agent', door: { argv: SETUP_DOOR }, why };
  });
  return { type: 'setup-layer/1', layer: 'computer', owner: LAUNCHER_OWNER, generatedAt, steps };
}
// #endregion setup-layers
