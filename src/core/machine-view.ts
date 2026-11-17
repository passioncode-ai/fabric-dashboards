// #region machine-view — docs: docs/design/2026-11-15-organizations-and-this-machine.md#this-machine-fd-52
// FD-52 (SCN-116): what this computer gives each context: its agents by state and what they spent today, per context.
// Pure, so the page and MCP `this_machine` say the same. A context is the organization of Project Observatory's map
// until Fabric reports each instance's own (CO-422): every context here is therefore `confirmed: false`. People are
// counted only from an agent's own aggregate report, and only for a group of 5 or more; no agent reports one yet.
import type { ServiceState } from './types';
import { sumSpend, type SpendEntry } from './spend';
import type { SpendSum } from '@passioncode-ai/fabric-service-host/usage';

export interface MachineSubject { key: string; state: ServiceState; organization?: { name: string; label?: string | null; personal?: boolean } | null }
export interface MachineCounts { agents: number; running: number; attention: number; stopped: number }
export interface MachineContext extends MachineCounts {
  /** The organization's name; '' is "Context not reported". */
  name: string;
  label: string | null;
  personal: boolean;
  /** Whether Fabric reported this context (CO-422); false while it comes from Observatory's map. */
  confirmed: boolean;
  /** Today's spend of its agents that report usage; null unless `spendState` is `reported`. */
  spendToday: SpendSum | null;
  spendState: SpendState;
  keys: string[];
}
/** FD-296 (verdicts 1.0.0): a sum keeps "not read", "nobody reports" and "unknown" apart from a measured amount.
 *  `unread`: the reports are not read yet; `none`: none of its agents reports usage; `unknown`: the ones that do could
 *  not be read; `reported`: at least one report was read (the others make the sum a lower bound). */
export type SpendState = 'unread' | 'none' | 'unknown' | 'reported';
export interface MachineView { totals: MachineCounts & { spendToday: SpendSum | null; spendState: SpendState }; contexts: MachineContext[] }

const RUNNING: readonly ServiceState[] = ['ready', 'degraded'];
const ATTENTION: readonly ServiceState[] = ['degraded', 'down', 'conflict', 'foreign', 'foreign-user', 'duplicate', 'invalid'];

function counts(list: readonly MachineSubject[]): MachineCounts {
  return {
    agents: list.length,
    running: list.filter((s) => RUNNING.includes(s.state)).length,
    attention: list.filter((s) => ATTENTION.includes(s.state)).length,
    stopped: list.filter((s) => s.state === 'stopped').length,
  };
}

/** The view: the personal context first, then the others by label, then the agents with no context; a context with no
 *  agent here is not drawn (the Organizations settings list every one). */
export function machineView(services: readonly MachineSubject[], spend: readonly SpendEntry[] | null = null, personalName: string | null = null): MachineView {
  const by = new Map<string, MachineSubject[]>();
  for (const s of services) {
    const name = s.organization?.name ?? '';
    by.set(name, [...(by.get(name) ?? []), s]);
  }
  const spendOf = (keys: readonly string[]): { spendToday: SpendSum | null; spendState: SpendState } => {
    if (!spend) return { spendToday: null, spendState: 'unread' };
    const mine = spend.filter((e) => keys.includes(e.key));
    if (mine.some((e) => e.kind === 'report')) return { spendToday: sumSpend(mine, 'today'), spendState: 'reported' };
    return { spendToday: null, spendState: mine.some((e) => e.kind === 'error') ? 'unknown' : 'none' };
  };
  const contexts: MachineContext[] = [...by].map(([name, list]) => {
    const org = list.find((s) => s.organization)?.organization ?? null;
    const keys = list.map((s) => s.key);
    return { name, label: org?.label ?? null, personal: Boolean(name && (org?.personal || name === personalName)), confirmed: false, ...counts(list), ...spendOf(keys), keys };
  }).sort((a, b) => (a.name === '' ? 1 : b.name === '' ? -1 : a.personal ? -1 : b.personal ? 1 : (a.label ?? a.name).localeCompare(b.label ?? b.name)));
  return { totals: { ...counts(services), ...spendOf(services.map((s) => s.key)) }, contexts };
}
// #endregion machine-view
