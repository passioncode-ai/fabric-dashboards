# Bug tracker

**State:** built 2026-11-15 (FD-263) on the operator's request of 2026-11-15 (session `36babb6c`): «Добавь также
баг-трекер, чтобы корректно собирать всю аналитику. У нас есть наша собственная аналитика».

## The journal

Every failure the app notices is one row per **fingerprint** in `bugs.json` in the app's data folder
(`~/Library/Application Support/Fabric Dashboards/`, 0600, at most 300 rows, the most recently seen kept):

| Where | What is caught | Code |
|---|---|---|
| `main` | an uncaught exception (`uncaughtExceptionMonitor`, the default handling stays) and an unhandled rejection | `src/electron/main.ts` |
| `renderer` | an error or unhandled rejection in the window or the console drawer (the preload's `error` and `unhandledrejection` listeners, at most ten a minute, IPC `fd:report-error`, answered only from the app's own page, FD-259) | `src/electron/preload.ts` |
| `renderer`, `process` | a renderer, GPU, utility or zygote process that ended other than cleanly | `src/electron/main.ts` |
| `action` | an action that did not succeed: start, stop, restart, doctor, update, self-update, console, rename (FD-141) | `noteFailed` in `src/electron/main.ts` |

A row holds the error's class, its message and **our own** stack frames (`core/monitor.js:300 Monitor.tick`; a
dependency's or Node's frame is left out), how often, first and last seen and the versions it was seen in. The message
and frames are scrubbed (`scrub`, `src/core/bugs.ts`): the home folder and user name, URL credentials, token-shaped
values and long hex runs are removed, and a message is cut at 500 characters. The fingerprint is a hash of where, the
kind, the class and the function names of the top four own frames: the same bug in another version, or moved by a few
lines, stays one row.

## In anonymous analytics

`app_error` (FD-136, `docs/ANALYTICS.md`) carries the fingerprint as `fp` (12 hex), so the organization's Aptabase
counts two bugs with one error code apart, per version. It never carries the message or the frames.

## For a person

Settings → **Bugs the app noticed** lists the 20 most recent with their counts. *Copy* puts a row's details on the
clipboard; *Report on GitHub* opens a prefilled new issue in `passioncode-ai/fabric-dashboards` in the browser, which the
person submits: that repository is public, so the app publishes nothing by itself.

## For an agent

- MCP `bugs` reads the journal (read-only).
- MCP `bug_report {fp}` answers the issue it would file; with `publish: true` it files it once with the GitHub CLI's
  sign-in (an issue already naming the fingerprint is answered instead) and records it in the journal.

Tests: `test/bugs.test.ts` (scrub, own frames, one row per fingerprint, the cap, the issue text, both MCP tools);
`test/parity.test.ts` holds the three IPC channels to their agent routes.
