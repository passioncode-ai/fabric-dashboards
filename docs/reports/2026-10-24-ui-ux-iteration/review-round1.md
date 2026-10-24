# Review round 1 of 0.8.0 (2026-10-24)

Three blind readings (unit, seam, product) of `2b91e3a..f1b62ef` (W1a, W1b, S1, S2, W2, W4a), plus the orchestrator's
look at S3's screenshots after `64c54ce`. Each row is fixed in one fix cycle with a test that fails without it, or
stated as not fixed with the reason. `B` blocks the release, `R` is a risk fixed now because it is cheap.

## Code (node FIX-1)

| Id | Sev | Finding | Where | Fix and check |
|---|---|---|---|---|
| R1-U1 | B | Remove and Clear on an ended console row whose session Switchboard also lists bring it back as an `sb:` row (every hand-over) | `src/electron/console.ts` forgetRow; `src/core/sessions.ts` sbOf, sections 5 | keep the removed record (hidden by a dismissal) so it still claims its twin, or dismiss the matched `sb:` id too. Test: take a hand-over whose Switchboard record is in_place and launched within seconds; stop, Remove: rows []; Clear once: no ended row |
| R1-U2 | B | Remove or Clear on a declined stop re-arms automatic continue (decision 2) | console.ts held set, forgetRow, dismissSession, clearEnded | the decline outlives the row (held from declined records plus `st:` dismissals); only Continue undoes it. Test: decline, Remove, Clear, resumeAfterLimit on, pollRecovery: no `recovery claim` |
| R1-S1 | B | The renderer's generic settings channel can write `sessions`, so a record can carry any folder and Continue starts a coding agent there (Review R-4: a folder comes only from the folder dialog) | `src/electron/main.ts` settingsUpdate | strip `sessions` with `consoles`. Test through the handler |
| R1-S2 | B | Switchboard's `cancelled` (and other finished) stops show as waiting for a reset with a time days in the past, in Sessions and in MCP `audit` | console.ts pollRecovery, `src/mcp/tools.ts` limitStops, `src/core/recovery.ts` | keep only `waiting` and `claimed` rows in one shared place (parseRecovery or verdictOf). Test: a cancelled stop yields no row and no limitStops entry |
| R1-S3 | R | expectedAt copies Switchboard's backoff table instead of its `probe_at`; a stop Switchboard will never probe shows a time | sessions.ts PROBE_DELAY_S; recovery.ts parseRecovery | parse `probe_at`; null when absent; drop the copied table |
| R1-U3 | R | A taken hand-over still offered by Switchboard can reappear; keys compared with `endsWith` | sessions.ts section 3 | skip any hand-over a record or console names; compare with `handoverOwnKey(id)` |
| R1-U4 | R | Continue on an `sb:` row may resume a live conversation (no end time, no liveness check) | console.ts continueSession; recovery.ts transcriptIn | no endedAt: start a new session, or exclude transcripts written in the last minute or held by a live agent |
| R1-U5 | R | `sessionIds` survives into a new session on the same key | console.ts recordEnd, continueSession | delete after reading and in the new-session branch |
| R1-U6 | R | An unreadable recovery pushes status every tick (`since: now`) | console.ts sessionsStatus | keep the first failure time like handoverDegraded |
| R1-U7 | R | sbOf matches any record within 2 min in the folder, not the nearest, and Terminal sessions too | sessions.ts sbOf | nearest launchedAt; only in-place records match this app's consoles |
| R1-U8 | R | The tray icon stays calm on a failed action while the sidebar badge is red | `src/electron/tray.ts` trayLevel | derive "problem" from `attentionQueue(...).some(urgent)` |
| R1-S4 | R | Quitting records every running console as "ended by itself" | main.ts will-quit, console.ts recordEnd | a quit reason; the row reads as closed when the app quit |
| R1-P1 | R | A session that needs you leaves the tray icon calm with the window closed | tray | the tray icon reads "attention" (not "problem") while a session needs you; SCN-085 says so |
| R1-V1 | R | Sidebar session rows cut their second line, so origin and time are lost and two rows of one folder look alike | `src/renderer/components/Navigation.tsx` | second line: account · origin · time, the coding agent's name only when it is not Claude Code; time never cut (right-aligned on line one) |
| R1-V2 | R | The waiting-for-reset glyph is almost invisible | Navigation, Sessions, CSS tokens | a visible mark with a non-colour shape, contrast checked like the other marks |
| R1-V3 | R | "Ended in the last 24 hours: 2" wraps to two lines in the sidebar | Navigation | a short sidebar label: "Ended: 2" / «Завершены: 2»; the page keeps the long heading |
| R1-V4 | R | An idle-closed session shows "The session exited with code 0." under a header that says closed after idle | Sessions page | the strip says what the header says, or is not drawn for idle-closed and ended-by-you |
| R1-E1 | R | No e2e for SCN-080 and SCN-085 (a synthetic hand-over's page, Esc then Tab, the notification) | test/e2e | write it; run it when the screen is unlocked and the load is under the floor; else record it unrun |

## Docs (node DOCS-1)

| Id | Sev | Finding | Where |
|---|---|---|---|
| R1-P2 | B | W1b's renamed states and actions are still quoted with old labels (Off, Degraded, Invalid, Update with agent, Fix with agent, No services yet, Show folder, As on this Mac, Same as macOS); SCN-061 step 3 says "Off" | README.md, docs/ux/scenarios.md, docs/ux/foundation.md |
| R1-P3 | B | Six doc lines quote composed strings the product no longer shows (em dash joins, "All services ready", "stop your services") | scenarios.md, screens.md |
| R1-P4 | B | The attention count is documented two ways (SCN-023 step 1 "!", SCN-006 UI elements list a narrower count) | scenarios.md SCN-006, SCN-023 |
| R1-P5 | B | CHANGELOG Unreleased omits W1a, W1b, W2 user-visible changes (renames, the Dock number, counts now including updates and degraded agents, a limit in Needs attention, the compact bar's Restart/Start/Update, the revisit, the rail update, the light accent, the keyboard row menu); "decision 8" is unresolvable for a reader | CHANGELOG.md |
| R1-P6 | B | The brand pack is in no index; DOCMAP's string row names neither terminology.md nor test/copy.test.ts | docs/DOCMAP.md, AGENTS.md |
| R1-P7 | R | SCN-078's poll cadence differs from SCN-086, AGENTS.md and the code (15 s with the window shown, 60 s hidden) | scenarios.md |
| R1-P8 | R | Two continue paths for one idle-closed agent console (SCN-066 step 2 and SCN-084): say which clears the other | scenarios.md |
| R1-P9 | R | Cmd/Ctrl+1/2 against "every key reaches the coding agent"; Terminal copy has no Windows or Linux variant; the busy sentence leaves out Linux's swap refusal (SCN-063) | scenarios.md SCN-077, SCN-080, SCN-082 |
| R1-P10 | R | "Its spending limit daily stopped work." puts an id into prose (voice rule 4) | `src/core/i18n.ts` (W2's string; DOCS-1 owns this one string) |
| R1-P11 | R | SCN-022 says the app checks every 6 hours; it checks every 5 minutes | scenarios.md SCN-022 |
| R1-P12 | R | FD-104 and HANDOFF lag the merges; the dossier's tray line and "moved from General" contradict decision 7 and SCN-086 | docs/backlog.md, docs/HANDOFF.md, sessions-and-navigation.md |
| W4 | B | The rest of W4: UX-24 / HV-03 (no "Open at login / Not now" card; on by default since FD-72), UX-27 (SCN-046/047 tabs and rail, statuses of SCN-019, 020, 043, 044), HV-04 (SCR-10 still a side panel), HV-05 (SCN-052 Windows and Linux login item and updates shipped) | scenarios.md, screens.md |
