# ADR-0012 — One entry per product: the instances of one service id are one product

Status: accepted · 2026-10-04 · supersedes the explicit presentation map drafted on branch
`codex/product-presentation` (`9e33f64`, never merged)

## Context

On 2026-10-04 the operator saw five entries in the sidebar for two products — `sshlg-growth.default`,
`.projection`, `.reader` and `sshlg-analytics.default`, `.projection` — and asked for one agent with
its sections inside, not several cards with the same interface. A service without a dashboard (for
example a communicator that only answers a bot) should sit apart from the agents with one.

The app drew one card per descriptor (`src/renderer/App.tsx`, before this change). A Codex session
drafted a fix the same day: an operator-owned presentation map in Settings, validated in the main
process, with a Save/Clear editor (FD-10, branch `codex/product-presentation`). It stopped at its
rate limit before the editor existed.

The Fabric Agent Contract already says which descriptors belong together:
`docs/specification/service.md` — «A second copy of the same service (a preview, a branch build)
MUST be a second `instance`, never a second `id`». Every one of the five entries above follows it.

## Decision

<a id="decision"></a>

1. **A product is a service `id`.** Every instance of one id is one entry in the sidebar and one
   card on Overview (`src/core/products.ts`, `groupProducts`). No map to edit, nothing to
   configure; a new instance joins its product as it is installed.
2. **The primary** — what a click on the product opens — is the `default` instance, else the first
   instance with a dashboard, else the first by key. A down or stopped primary stays primary: no
   other instance is promoted to stand in for it, so a reader never covers for a broken operator
   endpoint.
3. **The other instances are connections inside the product.** The service page shows a switch of
   every instance (`Main · online`, `projection · this Mac`, `reader · online`), each with its own
   state; choosing one opens that instance's page with its own key, session and controls.
4. **Grouping is presentation only.** Monitoring, Attention, Activity, notifications, the tray, the
   Dock badge, MCP, deep links and start/stop/restart keep the exact `id.instance` key. A product
   carries no state of its own: the sidebar shows the primary's state and adds a mark when another
   instance is in a problem state, never a raised or lowered state. MCP `list_services` names each
   service's `product`.
5. **Background.** A product none of whose instances has a dashboard surface — once one of them has
   answered — is listed under **Background** in the sidebar. A service that has never answered stays
   with the others, so a silent service does not drop out of view.

## Consequences

- The explicit map is not needed for the case the operator raised. It stays on its branch as the
  record of the alternative; if two different ids ever have to read as one product, that is a
  contract question (a declared relation between services), not a local settings editor.
- `sshlg-analytics.projection` groups under Analytics because of its id, although it projects
  Growth's read-only API. That naming belongs to its owner (`sshlg-projection`, scheduled for
  retirement), not to this app.
- The tray keeps one line per instance: it is the place to act on one exact service from the menu
  bar, and its problem section already sorts by attention.
