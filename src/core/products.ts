// #region product-grouping — docs: docs/adr/0012-one-entry-per-product.md#decision
// One entry per product: every instance of one service `id` is one product (Fabric Agent
// Contract docs/specification/service.md — "a second copy of the same service MUST be a second
// `instance`, never a second `id`"). Presentation only: monitoring, notifications, the tray, MCP,
// deep links and controls keep the exact `id.instance` key of each member. Pure: the renderer and
// the main process share it.
import type { ListLayout, ProductKind, ServiceSnapshot } from './types';

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

// FD-21 (audit M-4): the key grammar lives in the shared package, so Fabric splits keys the same way.
import { instanceOf, productIdOf } from '@passioncode-ai/fabric-service-host/links';
export { instanceOf, productIdOf };

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

export interface Arranged {
  pinned: Product[];
  /** FD-78: agents on this Mac, online agents, and services (no dashboard of their own, or marked so by the person). */
  local: Product[];
  online: Product[];
  service: Product[];
  /** FD-78: what the person hid. Still watched and still alerting; listed in a folded section at the bottom. */
  hidden: Product[];
}

/** FD-78: a product's section. The person's choice wins; else a product whose members answered and none offers a
 *  dashboard is a service; an agent is online when its primary is placed remotely (DEC-0019). */
export type Category = 'local' | 'online' | 'service';
export function categoryOf(p: Product, kinds: Readonly<Record<string, ProductKind>> = {}): Category {
  const kind = kinds[p.id] ?? (p.background ? 'service' : 'agent');
  if (kind === 'service') return 'service';
  return p.primary.descriptor?.placement === 'remote' ? 'online' : 'local';
}

export function arrangeProducts(products: readonly Product[], list: Pick<ListLayout, 'sort' | 'pinned'> & Partial<Pick<ListLayout, 'hidden' | 'kinds' | 'order'>>): Arranged {
  const byId = new Map(products.map((p) => [p.id, p]));
  const hiddenIds = new Set(list.hidden ?? []);
  // A hidden product leaves every other section, the pinned one too; showing it again puts its pin back.
  const pinned = list.pinned.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p) && !hiddenIds.has(p!.id));
  const isPinned = new Set(pinned.map((p) => p.id));
  const byName = (a: Product, b: Product) => nameOf(a).localeCompare(nameOf(b)) || (a.id < b.id ? -1 : 1);
  // FD-121: the person's order; an agent they never moved (a new one) comes after the ones they did, by name.
  const at = new Map((list.order ?? []).map((id, i) => [id, i]));
  const placeOf = (p: Product) => at.get(p.id) ?? Number.MAX_SAFE_INTEGER;
  const cmp = list.sort === 'manual' ? (a: Product, b: Product) => placeOf(a) - placeOf(b) || byName(a, b)
    : list.sort === 'status' ? (a: Product, b: Product) => rankOf(a) - rankOf(b) || byName(a, b)
    : list.sort === 'activity' ? (a: Product, b: Product) => (lastOf(b) > lastOf(a) ? 1 : lastOf(b) < lastOf(a) ? -1 : 0) || byName(a, b)
    : byName;
  const rest = products.filter((p) => !isPinned.has(p.id) && !hiddenIds.has(p.id));
  const of = (c: Category) => rest.filter((p) => categoryOf(p, list.kinds) === c).sort(cmp);
  return { pinned, local: of('local'), online: of('online'), service: of('service'), hidden: products.filter((p) => hiddenIds.has(p.id)).sort(cmp) };
}

/** FD-78: hide or show again; a hidden product keeps its pin and its kind. */
export function toggleHidden(hidden: readonly string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
}

// #region agent-off — docs: docs/ux/scenarios.md#scn-072-hide-an-agent-without-stopping-it
/** FD-123 (SCN-072): turn an agent off (it is hidden too, never probed and never alerting) or back on (it stays hidden
 *  and watched until shown again). What to store, or null when nothing changes. */
export function setOff(list: Pick<ListLayout, 'hidden' | 'off'>, id: string, off: boolean): Pick<ListLayout, 'hidden' | 'off'> | null {
  if (off === list.off.includes(id)) return null;
  return off
    ? { off: [...list.off, id], hidden: list.hidden.includes(id) ? [...list.hidden] : [...list.hidden, id] }
    : { off: list.off.filter((x) => x !== id), hidden: [...list.hidden] };
}

/** FD-123: show a hidden agent again; one that was off is turned on, since only a hidden agent can be off. */
export function showAgain(list: Pick<ListLayout, 'hidden' | 'off'>, id: string): Pick<ListLayout, 'hidden' | 'off'> {
  return { hidden: list.hidden.filter((x) => x !== id), off: list.off.filter((x) => x !== id) };
}
// #endregion agent-off

/** FD-78: the kind the person sets; choosing what the app would guess anyway removes the override. */
export function setKind(kinds: Readonly<Record<string, ProductKind>>, p: Product, kind: ProductKind): Record<string, ProductKind> {
  const next = { ...kinds };
  if ((p.background ? 'service' : 'agent') === kind) delete next[p.id];
  else next[p.id] = kind;
  return next;
}

// #region list-move — docs: docs/ux/scenarios.md#scn-087-arrange-the-sidebar-width-and-order
/** FD-121 (SCN-087): a section of the sidebar an agent can be moved within; never from one section to another. */
export type MoveSection = 'pinned' | Category | 'hidden';

/** FD-121 (SCN-087): move one agent to `to` (its index in the section as shown) and say what to store. Pinned keeps its
 *  own order (the pin order); any other section freezes what the person sees, every section, into their own order and
 *  turns the sort to `manual`, so nothing else on screen jumps. An agent not in that section, or no move, is null. */
export function moveInSection(arranged: Arranged, section: MoveSection, id: string, to: number): Partial<ListLayout> | null {
  const ids = arranged[section].map((p) => p.id);
  const from = ids.indexOf(id);
  if (from < 0) return null;
  const target = Math.max(0, Math.min(ids.length - 1, Math.round(to)));
  if (target === from) return null;
  const moved = [...ids];
  moved.splice(from, 1);
  moved.splice(target, 0, id);
  if (section === 'pinned') return { pinned: moved };
  const of = (c: Exclude<MoveSection, 'pinned'>) => (c === section ? moved : arranged[c].map((p) => p.id));
  return { sort: 'manual', order: [...of('local'), ...of('online'), ...of('service'), ...of('hidden')] };
}
// #endregion list-move

/** Pin or unpin: a newly pinned product goes last; unpinning keeps the others' order. */
export function togglePin(pinned: readonly string[], id: string): string[] {
  return pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id];
}
// #endregion list-order
