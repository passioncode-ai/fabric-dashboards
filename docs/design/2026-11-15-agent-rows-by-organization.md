# One row per agent and organization (FD-244, last part)

Status: decided and built 2026-11-15 (0.8.99: `rowIds`, `snapshotRows`, `src/core/products.ts`; tests `test/listorder.test.ts`, `test/attention-queue.test.ts`). Owner: fabric-dashboards. Serves North Star §4 (the Dashboards row:
filtered by organization) and the operator's ask of 2026-11-14 (session `36babb6c`): one row per agent, pinned first,
its places as icons, no duplicates.

## Problem

`groupProducts` (`src/core/products.ts`) makes one product of every instance that shares a service id
(ADR-0012). An instance the operator runs for another organization (an organization's cloud copy of an agent, FD-197
gives it that organization) is therefore a member of the operator's own row: its state colours the row's online place
(FD-244, 0.8.95), and the organization filter (FD-162) cannot take it out, because the filter reads the product.

## Decision

1. **The row key.** A product's row id stays the service id for every member of the primary's organization. A member
   whose instance organization (`ServiceSnapshot.organization.name`, from `organizationOfInstance`) is known and differs
   from the primary's known organization forms its own row with id `<id>@<organization>`. When either side is not
   known, nothing splits (unknown is not "another organization").
2. **Stored lists keep their ids.** `pinned`, `hidden`, `off`, `order` and `kinds` already hold service ids; the
   operator's own rows keep exactly those, so no setting is migrated. A row of another organization is pinned, hidden
   or turned off under its `<id>@<organization>` id, on its own.
3. **One function names a member's row.** `rowIdOf(snapshot, primaryOrg)` replaces `productIdOf(key)` wherever a stored
   list is checked for one instance: `src/core/monitor.ts` (off, lines 850 to 874), `src/core/tray-model.ts:40`,
   `src/renderer/components/Settings.tsx:192`, and the MCP answers that name a product (`src/mcp/tools.ts` 204, 689 to
   705). `src/core/connections.ts` and `src/core/audit.ts` keep the service id: a connection or a finding is about the
   service, whoever runs it.
4. **The primary's organization** is the organization of the primary chosen as today (the `default` instance, else the
   first with a dashboard, else the first by key), so a product whose `default` instance runs for another organization
   is that organization's row, and the operator's own instances split away from it in the same way.
5. **MCP.** `list_services` gains `row` beside `product`; `arrange` takes a service key as today and acts on that key's
   row.

## Not chosen

- Splitting by repository owner: one repository serves several organizations (FD-197), so the owner is the wrong key.
- Moving every stored id to `<id>@<organization>`: it migrates every setting and breaks agents that already call
  `arrange` by product.

## Checks it needs

A unit test per rule above (`test/listorder.test.ts`, `test/agent-off.test.ts`, `test/mcp.test.ts`), the organization
filter over a split product, and the SCN-071 and SCN-094 steps updated in the same change.
