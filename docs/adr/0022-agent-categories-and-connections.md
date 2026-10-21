# ADR-0022: Agents, online agents and services apart; hidden agents; what an agent is connected to

Status: accepted, 2026-10-20 (FD-78), amended 2026-10-21 (review, 0.7.18). Requested by the operator on 2026-10-20:
«для каждого агента вкладочка коннекторов и потоков данных ... видеть всю цепочку ... разделение локальный, онлайн,
служебный ... каких-то агентов я хочу просто скрыть ... отдельную категорию снизу».

## Context

The sidebar listed agents and, under **Background**, the services without a dashboard (ADR-0012 §5). The operator works
with a few agents and many services that keep them running; the list mixed them, and nothing showed what an agent
depends on. The well-known document says what a service offers (surfaces, MCP capabilities), never what it uses.

## Decision

1. **Three sections, one rule.** A product is **On this Mac**, **Online** (its primary is placed remotely, DEC-0019) or
   a **Service**. A product is a service when its members answered and none offers a dashboard (ADR-0012 §5's rule,
   now named Services), or when the person said so. The person's choice per product id lives in
   `settings.layout.list.kinds`; choosing what the app would guess removes the entry. Pinned products stay above all
   three (ADR-0020). `categoryOf` in `src/core/products.ts` is the only place that decides.
2. **Hidden is for room, not for silence.** A hidden product (`settings.layout.list.hidden`) leaves every section,
   Pinned too, and waits in a folded **Hidden: N** section at the bottom of the sidebar and Overview. It is still
   probed, still in Needs attention, its outages still reach the operator channel, and the fold carries "!" when one
   needs attention. Showing it again restores its pin.
3. **Each row has one small menu** (the operator's interface rule: one primary action, the rest in a menu): pin, show
   as a service or an agent, hide or show again.
4. **Connections are the agent's own declaration, under `extensions`.** The key
   `https://fabric.passioncode.ai/agent-contract/extensions/connections/0.1` carries at most 64 connections
   (`kind` service, model, connector, store, channel; a `state`; a `degraded[].source` with a connection's `id` is that
   connection failing). It travels as DEC-0036 ED-9's dashboard key does: a reader that does not know it ignores it, so
   a service may send it before the contract decides. Proposed to the contract on 2026-10-20 (board thread
   `131648c0`); Dashboards re-pins to the decision's schema. Reader: `packages/service-host/src/connections.ts`.
5. **What the app sees fills the gap, labelled as such.** Without a declaration the Connections tab shows the models of
   the agent's spend report, its runner (DEC-0046), the parts it reports failing and the agents that name it; an
   invalid declaration is shown as invalid, never guessed past.
6. **The chain is drawn, bounded.** A connection to an installed agent carries the worse of its declared state and that
   agent's own, and that agent's connections below it, three levels deep, an agent never repeated in one chain. The tab
   names the worst state of the agent itself and the whole chain.
7. **Agents read the same thing.** MCP `connections` returns the tab's graph; `list_services` and `service_status`
   carry `category` and `hidden`, read from the app's settings without writing them.

## Consequences

- ADR-0012 §5 is amended: Background is now Services, and the person can move a product either way.
- Until agents declare connections, the tab is partial by design and says so; the kits of fabric-agent-adapter are asked
  to emit the key once the contract decides.
- The settings file is shared with the MCP server read-only; a damaged list reads as the app's guesses.

## Proof

`test/listorder.test.ts` *FD-78*, `test/connections.test.ts`, `packages/service-host/test/connections.test.ts`,
`test/mcp.test.ts` *FD-78*, `test/e2e/connections.test.ts`, `test/e2e/focus-console.test.ts` *FD-78*; scenarios SCN-071
to SCN-073.
