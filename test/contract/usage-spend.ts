// Copied from passioncode-ai/fabric-agent-contract src/usage-rules.ts @96789f8aa80a (last changed in 1b930e9c3f17,
// DEC-0110): `usageSpend` and the declarations it reads, unchanged except its one kit import (`isObject`,
// `JsonObject`, src/findings.ts), declared here. Test-only: test/spend-fuzz.test.ts runs the host's sums against it
// (FD-101). Never edit here; re-copy when the contract changes.
type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

/** What a host shows for a set of usage rows (DEC-0110): money spent apart from a subscription's estimate. */
export interface UsageSpend {
  calls: number;
  moneyUsd: number | null; // the sum over rows not on a subscription; 0 when every call was on one, null when none is priced
  moneyLowerBound: boolean; // some of those calls are unpriced, so the money is at least moneyUsd
  estimateUsd: number | null; // what the subscription rows' calls would cost at list price; null when none of them is priced
  estimateLowerBound: boolean;
  subscriptionCalls: number;
}

const ROUTES = ["subscription", "key", "platform-metered"];
const known = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const sum = (values: number[]) => values.sort((a, b) => a - b).reduce((n, x) => n + x, 0);

/**
 * The host's sum over usage rows: `days[].byModel[]`, of one day or of several, the only rows that carry `route`
 * (a day's totals, `byProject` and `byGrant` mix routes and are never passed here). DEC-0110: money is the `costUsd` of
 * every row whose `route` is `key`, `platform-metered` or absent; a `subscription` row's `costUsd` is an estimate at list
 * price, summed apart and never into money. A window whose calls were all on a subscription spent 0, never null; money is
 * null only when it has calls off a subscription and none of them is priced (a row without calls never prices them),
 * and a lower bound while some are priced and some are not. A missing `unpricedCalls` reads as 0, as FAC-SEM-025's
 * pricedRow reads it; an unknown `route`, or counts or a cost the schema refuses, answers `undefined`, never a guess. It
 * never throws on a JSON value.
 */
export function usageSpend(rows: unknown): UsageSpend | undefined {
  if (!Array.isArray(rows)) return undefined;
  const money: number[] = [], estimate: number[] = [];
  let calls = 0, subscriptionCalls = 0;
  // Per side: calls, calls with a known price, and whether any call is unpriced.
  const paid = { calls: 0, priced: 0, unpriced: false }, sub = { calls: 0, priced: 0, unpriced: false };
  for (const row of rows) {
    if (!isObject(row)) return undefined;
    const route = row.route;
    if (route !== undefined && !(typeof route === "string" && ROUTES.includes(route))) return undefined;
    const rowCalls = row.calls, unpriced = row.unpricedCalls === undefined ? 0 : row.unpricedCalls, rowCost = row.costUsd;
    if (!Number.isSafeInteger(rowCalls) || (rowCalls as number) < 0 || !Number.isSafeInteger(unpriced) || (unpriced as number) < 0 || (unpriced as number) > (rowCalls as number)) return undefined;
    if (rowCost !== null && !known(rowCost)) return undefined;
    // FAC-SEM-025's own pairing: null exactly when every call of a row with calls is unpriced.
    if ((rowCalls as number) > 0 && (rowCost === null) !== (unpriced === rowCalls)) return undefined;
    calls += rowCalls as number;
    const side = route === "subscription" ? sub : paid;
    if (route === "subscription") subscriptionCalls += rowCalls as number;
    side.calls += rowCalls as number;
    side.priced += (rowCalls as number) - (unpriced as number);
    if ((unpriced as number) > 0) side.unpriced = true;
    if (known(rowCost)) (route === "subscription" ? estimate : money).push(rowCost);
  }
  // A side with calls and none of them priced is unknown (null), whatever a row without calls costs; a side without
  // calls is the sum of what its rows cost, 0 when none does.
  const total = (side: typeof paid, costs: number[]) => (side.calls > 0 && side.priced === 0 ? null : sum(costs));
  return {
    calls,
    moneyUsd: total(paid, money),
    moneyLowerBound: paid.priced > 0 && paid.unpriced,
    estimateUsd: total(sub, estimate),
    estimateLowerBound: sub.priced > 0 && sub.unpriced,
    subscriptionCalls
  };
}
