// #region product-grouping — docs: docs/adr/0012-one-entry-per-product.md#decision
// One entry per product: every instance of one service `id` is one product (Fabric Agent
// Contract docs/specification/service.md — "a second copy of the same service MUST be a second
// `instance`, never a second `id`"). Presentation only: monitoring, notifications, the tray, MCP,
// deep links and controls keep the exact `id.instance` key of each member. Pure: the renderer and
// the main process share it.
import type { ServiceSnapshot } from './types';

export interface Product {
  /** The service `id` the members share. */
  id: string;
  /** The member a click on the product opens: `default`, else the first with a dashboard, else the first by key. */
  primary: ServiceSnapshot;
  /** Every member, primary first, the others by key. */
  members: ServiceSnapshot[];
  /** No member answered with a dashboard surface, and at least one answered at all: a background agent or service. */
  background: boolean;
  /** A member other than the primary is in a problem state — the primary's own state is never raised to cover it. */
  memberProblem: boolean;
}

const PROBLEM = new Set(['down', 'duplicate', 'foreign', 'conflict', 'invalid']);

/** The `id` part of a service key: an id carries no dot (ID_PATTERN), so the first dot splits it. */
export function productIdOf(key: string): string {
  const dot = key.indexOf('.');
  return dot > 0 ? key.slice(0, dot) : key;
}

export const instanceOf = (key: string): string => {
  const dot = key.indexOf('.');
  return dot > 0 ? key.slice(dot + 1) : 'default';
};

const hasDashboard = (s: ServiceSnapshot) => Boolean(s.wellKnown?.surfaces.dashboard);

/** Groups services into products, keeping the order of each product's first member in the input. */
export function groupProducts(services: readonly ServiceSnapshot[]): Product[] {
  const byId = new Map<string, ServiceSnapshot[]>();
  for (const s of services) {
    const id = productIdOf(s.key);
    const list = byId.get(id);
    if (list) list.push(s);
    else byId.set(id, [s]);
  }
  return [...byId.entries()].map(([id, list]) => {
    const sorted = [...list].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const primary = sorted.find((s) => instanceOf(s.key) === 'default') ?? sorted.find(hasDashboard) ?? sorted[0]!; // a group is never empty
    const members = [primary, ...sorted.filter((s) => s !== primary)];
    const answered = members.some((s) => s.wellKnown);
    return {
      id,
      primary,
      members,
      background: answered && !members.some(hasDashboard),
      memberProblem: members.some((s) => s !== primary && PROBLEM.has(s.state)),
    };
  });
}

/** The product a service key belongs to, or undefined when no such service is listed. */
export function productOf(products: readonly Product[], key: string): Product | undefined {
  return products.find((p) => p.members.some((m) => m.key === key));
}
// #endregion product-grouping

// #region list-order — docs: docs/adr/0020-agents-first-handoff-and-setup.md#decision
/** FD-39 (ADR-0020): pinned products first, in pin order and never re-sorted (Fabric's favourites rule);
 *  the rest by name, status (needing attention first) or recent activity, each section as before. */
const RANK: Record<string, number> = { down: 0, duplicate: 0, foreign: 0, conflict: 0, invalid: 0, degraded: 1, starting: 2, stopping: 2, ready: 3, stopped: 4 };
const nameOf = (p: Product) => (p.primary.descriptor?.name ?? p.primary.key).toLocaleLowerCase();
const rankOf = (p: Product) => (p.memberProblem ? 0 : Math.min(...p.members.map((m) => RANK[m.state] ?? 5)));
const lastOf = (p: Product) => p.members.reduce<string>((best, m) => (m.latestEvent?.at && m.latestEvent.at > best ? m.latestEvent.at : best), '');

export function arrangeProducts(products: readonly Product[], list: { sort: 'name' | 'status' | 'activity'; pinned: readonly string[] }): { pinned: Product[]; foreground: Product[]; background: Product[] } {
  const byId = new Map(products.map((p) => [p.id, p]));
  const pinned = list.pinned.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  const isPinned = new Set(pinned.map((p) => p.id));
  const byName = (a: Product, b: Product) => nameOf(a).localeCompare(nameOf(b)) || (a.id < b.id ? -1 : 1);
  const cmp = list.sort === 'status' ? (a: Product, b: Product) => rankOf(a) - rankOf(b) || byName(a, b)
    : list.sort === 'activity' ? (a: Product, b: Product) => (lastOf(b) > lastOf(a) ? 1 : lastOf(b) < lastOf(a) ? -1 : 0) || byName(a, b)
    : byName;
  const rest = products.filter((p) => !isPinned.has(p.id));
  return { pinned, foreground: rest.filter((p) => !p.background).sort(cmp), background: rest.filter((p) => p.background).sort(cmp) };
}

/** Pin or unpin: a newly pinned product goes last; unpinning keeps the others' order. */
export function togglePin(pinned: readonly string[], id: string): string[] {
  return pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id];
}
// #endregion list-order
