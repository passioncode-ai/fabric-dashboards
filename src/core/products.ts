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
