---
report:
  id: fabric-dashboards/2026-10-24-ui-ux-iteration
  title: "UI and UX release iteration 0.8.0: survey, canvas and waves"
  kind: audit
  project: fabric-dashboards
  domains: [ux, ui, accessibility, copy]
  as_of: 2026-10-24
  status: active
  valid_until: 2026-11-24
  summary: >-
    The operator asked on 2026-10-24 for a release iteration that improves the UI and UX of the whole product. Four
    read-only surveys (UX against the scenarios, visual and accessibility, interface copy in both languages, a harvest
    of the backlog, handoff, roadmap and issues) produced 126 findings with file:line evidence (inventory.json). This
    page is the canvas of 0.8.0: which findings land in which wave, which wait for the next pool, and the decisions
    taken without asking because a recorded decision already answers them.
---

# UI and UX release iteration 0.8.0

Run through task-pipeline's release iteration (`references/iteration.md`), with super-ux owning behaviour (scenarios
first), sheleg-design the visual layer and copywriting the words. The mobile lane is declined: this is a desktop app.

## Survey (wave 0)

| Survey | Findings | High | Source |
|---|---|---|---|
| UX against the scenarios (super-ux `ux-audit`, standard depth) | 27 | 2 | `UX-*` in [inventory.json](inventory.json) |
| Visual and accessibility (sheleg-design, web-design-guidelines, WCAG 2.1 AA) | 24 | 2 | `VIS-*` |
| Interface copy, English and Russian (copywriting, brand-voice) | 33 | 9 | `COPY-*` |
| Backlog, handoff, roadmap, issues | 42 (13 actionable) | | `FD-*`, `HV-*`, `GH-*` |

The visual survey took no screenshots: the 1-minute load average was 551 (limit 150). Its findings come from the code
and a contrast script over every token pair.

## Decisions taken without a question

Each is answered by a recorded decision or the operator's rules, so none waits:

- **Terms** follow ADR-0022: an item the app watches is an *agent*; a *service* is a helper agent with no dashboard of
  its own; the program the console starts is the *coding agent* («агент для кода»), never plain «агент».
- **The first action on a stopped or failing agent is Restart or Start**, on the agent page as on Overview; *Fix with
  agent* (a paid coding-agent session) comes second.
- **The light theme draws text and focus in the brand's readable gold** (`--pc-link` family from the vendored brand
  file); the brand files themselves stay untouched.
- **Words name the platform the app runs on** ("this Mac" on macOS, "this computer" elsewhere), as the app ships for
  Windows and Linux (FD-37).
- **The voice pack inherits Fabric's** by a pinned commit and holds only this product's differences (`docs/brand/`).

## Canvas: waves

| Wave | What | Findings |
|---|---|---|
| W1a | Theme and accessibility: readable accent and focus in the light theme, the row menu reachable by keyboard, a visible focus everywhere, one glyph per state, no state by colour alone, reduced motion for the cursor, tokens in place of literals | VIS-01, VIS-03, VIS-04, VIS-08, VIS-13, VIS-19, VIS-20, VIS-22, VIS-23 |
| W1b | Words: the brand pack; no em dash in composed strings and a test that sees them; one set of terms and state names; the Overview strip's counts after their label; platform-aware wording; protocol words out of what a person reads; the first-run empty state | COPY-01 to COPY-13, COPY-18, COPY-20, COPY-23, COPY-27 to COPY-29 |
| W2 | One truth about attention: one count for tray, sidebar, Dock and Overview; a limit that stopped work in Needs attention; Needs attention first and on one line per row; Restart before Fix on the agent page; an update visible in the compact bar; "Since you were last here" kept current | UX-01, UX-03 to UX-08, UX-12, UX-14, VIS-02, VIS-09, VIS-12 |
| W3 | Sessions get their own mode (operator review, 2026-10-24): a switch Agents / Sessions at the top of the sidebar; running, handed-over, stopped and ended coding sessions in one list, each state with an action; the console fills a session's page instead of dropping over another; notifications, a tray line, Settings → Sessions. Design: [sessions-and-navigation.md](sessions-and-navigation.md) | SES-01 to SES-09, UX-02, UX-10, UX-16 to UX-18, UX-25, UX-26, VIS-05, VIS-06, COPY-17 |
| W4 | Docs and reliability: screens.md and the scenarios brought back to the code (the login card, the drawer, Linux and Windows), screen records for Connections and the Sessions mode; FD-101; a safe e2e default on a loaded Mac; issue #103 closed | UX-24, UX-27, HV-02 to HV-05, FD-101, GH-103 |

## Next pool (not in 0.8.0)

UX-09, UX-11, UX-13, UX-15, UX-19 to UX-23; VIS-07, VIS-10, VIS-11, VIS-14 to VIS-18, VIS-21, VIS-24; COPY-14 to COPY-16,
COPY-19, COPY-21, COPY-22, COPY-24 to COPY-26, COPY-30 to COPY-33; FD-98 (needs its update-path test first); and the 29
blocked harvest items (the Observatory node, the contract, another machine, Electron, a person).

## Adopted 2026-10-24 by another session

The session that ran W1a stopped (W1b's agent hit a weekly usage limit at 13:29 UTC, the session then could not
continue). W1b's uncommitted edits were committed as `7ede492` on `feat/ui-ux-w1b` and merged into this branch
(`d298eac`) to be finished. The operator's review of the same day replaced W3 with the Sessions mode.
