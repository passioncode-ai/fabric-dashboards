# Plan — focus on the dashboard, and an agent console beside it (0.6.0)

Brief: [2026-10-06-focus-and-console-brief.md](2026-10-06-focus-and-console-brief.md) ·
Design: [ADR-0017](../../adr/0017-focus-layout-and-agent-console.md) · Scenarios SCN-046…050 (validated
2026-10-06) · Branch `agent/focus-console-060`.

Each task is test-first where the unit allows it, and reviewed after it lands.

| Task | What | Implements | Test |
|---|---|---|---|
| T1 | `Settings.layout` (sidebar, header, console open and width) and `Settings.consoles[key]` (runtime, folder); merge and clamp | REQ-01, REQ-03, REQ-04, REQ-05, REQ-06 | `test/parts.test.ts` settings cases |
| T2 | Compact service bar, problem chip, details toggle; tabs move into the bar | REQ-01, REQ-02, REQ-15 | unit (`problemChip`), e2e |
| T3 | Sidebar rail; View → Hide Sidebar (⌃⌘S) | REQ-03, REQ-15 | e2e |
| T4 | `src/core/runtimes.ts`: known runtimes, login-shell `PATH`, detection, argv for New/Continue | REQ-05, REQ-09 | `test/console.test.ts` (fake PATH) |
| T5 | `src/core/repofind.ts`: `source.repository` → local checkout by `.git/config` origin | REQ-06 | `test/console.test.ts` (fake repos, worktrees, URL forms) |
| T6 | `src/core/switchboard.ts`: locate, `project show`, `--in-place` support, launch argv (in place, Terminal) | REQ-07 | `test/console.test.ts` (fake `switchboard`) |
| T7 | `src/electron/console.ts`: sessions per service on an injected PTY, ring buffer, env scrub, owned, ends on quit and removal, counts as busy for auto-install; IPC | REQ-08, REQ-09, REQ-12 | `test/console.test.ts` (fake PTY), `test/lifecycle.test.ts` |
| T8 | Open in Terminal (plain, or through Switchboard) | REQ-10, REQ-07 | unit (argv) |
| T9 | `ConsolePanel.tsx`: xterm + fit, states, picker, folder, actions, resize handle; CSP `style-src 'unsafe-inline'` | REQ-04, REQ-08, REQ-15 | e2e |
| T10 | Shell layout: console column; dashboard view bounds follow every panel change; overlays hide the console too | REQ-11 | e2e (view bounds vs host) |
| T11 | Packaging: `node-pty` dependency, unpacked from asar, `checks.pty` in the seal | REQ-13 | `test/dist.test.ts` + CI build |
| T12 | e2e walk: compact header, rail, console with a scripted runtime, bounds | REQ-01, REQ-02, REQ-03, REQ-04, REQ-08, REQ-11 | `test/e2e/app.test.ts` |
| T13 | Docs: CONTEXT terms, README, AGENTS lifecycle and data, SECURITY (CSP, console), CHANGELOG 0.6.0, HANDOFF, backlog FD-24/FD-25, screenshots | REQ-12, REQ-14 | `npm run check` |
| T14 | Release 0.6.0: version, tag, CI, the operator's approvals | REQ-16 | the published release and receipt |

Set comparison: the brief's REQ-01…REQ-16 equal the union of `Implements` above (REQ-01, 02, 03, 04,
05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16).
