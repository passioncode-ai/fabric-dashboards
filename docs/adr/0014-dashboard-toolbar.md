# ADR-0014 — A toolbar over every embedded dashboard, and an Overview that reads at a glance

Status: accepted · 2026-10-05

## Context

On 2026-10-05 the operator reported five things about the main screen and the service page:

- the button to reload a dashboard had disappeared. It existed only after a crash or a service
  restart (`DashboardHost` overlays);
- they could neither see nor copy the address of the page open inside an embedded dashboard;
- the Needs attention block took too much room: one row wrapped to two or three lines with a long
  reason;
- the service cards were loosely packed: tiles wrapped, labels took two lines, and rows had ragged
  bottoms;
- Overview should feel like the main dashboard.

## Decision

<a id="decision"></a>

1. **A toolbar above every embedded dashboard** (SCN-039, SCN-040) has Back, Forward, Reload page,
   Dashboard home, the page's address (read-only, selectable), **Copy address** and **Copy app
   link**.
   - The app link is the `fabric-dashboards://service/<id.instance>?path=…` that opens the same
     page here, signed in, for an agent or a teammate.
   - The main process owns the page. The view reports `did-navigate`, in-page routes and loading,
     and the renderer only shows that state (`PageState`).
   - Copying goes through the main process's clipboard.
2. **A login code is never shown or copied.** `pageAddress` (`src/electron/policy.ts`) maps the
   one-time sign-in URL, and any page off the service origin, to the dashboard itself.
3. **Overview opens with a status strip** (SCN-041), five cells each holding one number and one
   label:
   - agents ready, out of the total;
   - not answering or in conflict;
   - needing attention;
   - spent today;
   - spent in 30 days (both from ADR-0013's sums, «≥» and «unknown» kept).

   The spend cells open Spend. One read serves Overview and Spend for 30 s, and a hidden window
   reads nothing (LC-08).
4. **Needs attention is one line per row** (SCN-042): state, name, the reason cut to the line (the
   full text on hover), and the action. The first three rows show, and "Show all N" opens the
   rest. Severity order is unchanged.
5. **Denser cards.**
   - The grid fits four cards across a 1440 px window, and the cards in a row share one height.
   - Tile values take one line, labels at most two, and the full text is the tile's tooltip.
   - The latest event takes one line, at the card's foot.
6. **A session that ended signs in again by itself** (added 2026-10-05, from a finding by the
   Copylot owner session). When the main frame of a dashboard that requires sign-in answers `401`,
   the app runs the one-time login code again and reopens the same page. It does this at most once
   a minute per view, so a service that refuses every code cannot loop. The status is read from
   the service session's own requests, because a reload reports none through the navigation
   events. The app's light or dark theme also reaches the pages, through `nativeTheme`.
7. **No motion.** These surfaces are used tens of times a day (motion doctrine, frequency table).
   The only feedback is the Copy button reading "Copied" for 1.5 s. The visual layer stays the
   vendored PassionCode tokens, with no new colour, radius or type size.

## Consequences

- New IPC: `viewPage`, `viewNavigate` (back, forward, home, refresh) and `copyText`. The
  `onViewEvent` stream carries `navigated` with the page state.
- `FD_TEST_SPEND_FRESH_MS` shortens the spend cache in tests and is honoured only when the app is
  not packaged, like `FD_TEST_REMOTE`.
- Embedded pages are not captured by `page.screenshot`, so the e2e tests read the address and the
  clipboard instead. The test keeps the operator's clipboard and restores it afterwards.
