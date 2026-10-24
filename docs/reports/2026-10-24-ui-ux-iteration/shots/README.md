# Sessions mode contact sheet (FD-103, FIX-2 finding V-2)

Rendered 2026-10-24 by `render.mts` beside this file, from the built renderer, in Playwright WebKit:

```sh
npx vite build
node --import tsx docs/reports/2026-10-24-ui-ux-iteration/shots/render.mts
```

19 states (every state of SCR-12 to SCR-14), each in English and Russian (`settings.language` and the stub's `locale`), light and dark, at 1280x800 and 740x800:
152 files. The two "all-full" and "all-no-switchboard" states grow the window's height to the whole list (the page
scrolls inside its own column, so a full-page capture would not), so their height is given in the table.

How they are made:

- The data is synthetic: nine sessions in every state of SCN-078 to SCN-084, built with `actionsFor` and `groupOf` of
  `src/core/sessions.ts`, so each row carries the actions the app gives its state; the settings are `DEFAULT_SETTINGS`
  of `src/core/types.ts` with the theme, language, sidebar and mode of the shot. `window.fabric` is a stub that answers
  with that data; no Electron, no Switchboard and no real session is involved.
- A session page with a console lays the drawer page (`?drawer=1`) over the area the page leaves for it: in the app
  it is a native view placed there by `src/electron/drawer.ts`. Each console has its own synthetic transcript whose
  cwd line names its own folder; an ended console ends on its last line, a running one on the cursor.
- The End question is captured without the console: the app suspends the drawer while a dialog is open.
- Times are of 24 October 2026, 14:02 local time.

This is not a capture of the running Electron app: the window chrome, the native drawer view and the real fonts of
the installed app are not in it.

| File | State | Language | Theme | Size |
|---|---|---|---|---|
| [all-full-en-light-1280.png](all-full-en-light-1280.png) | All sessions: every group (needs you, running, waiting, ended), the first-visit note on top; the window grown to the list | English | light | 1280x1136 |
| [all-full-en-light-740.png](all-full-en-light-740.png) | All sessions: every group (needs you, running, waiting, ended), the first-visit note on top; the window grown to the list | English | light | 740x1730 |
| [all-full-en-dark-1280.png](all-full-en-dark-1280.png) | All sessions: every group (needs you, running, waiting, ended), the first-visit note on top; the window grown to the list | English | dark | 1280x1136 |
| [all-full-en-dark-740.png](all-full-en-dark-740.png) | All sessions: every group (needs you, running, waiting, ended), the first-visit note on top; the window grown to the list | English | dark | 740x1730 |
| [all-full-ru-light-1280.png](all-full-ru-light-1280.png) | All sessions: every group (needs you, running, waiting, ended), the first-visit note on top; the window grown to the list | Russian | light | 1280x1156 |
| [all-full-ru-light-740.png](all-full-ru-light-740.png) | All sessions: every group (needs you, running, waiting, ended), the first-visit note on top; the window grown to the list | Russian | light | 740x1730 |
| [all-full-ru-dark-1280.png](all-full-ru-dark-1280.png) | All sessions: every group (needs you, running, waiting, ended), the first-visit note on top; the window grown to the list | Russian | dark | 1280x1156 |
| [all-full-ru-dark-740.png](all-full-ru-dark-740.png) | All sessions: every group (needs you, running, waiting, ended), the first-visit note on top; the window grown to the list | Russian | dark | 740x1730 |
| [all-empty-en-light-1280.png](all-empty-en-light-1280.png) | All sessions: no session in the last 24 hours | English | light | 1280x800 |
| [all-empty-en-light-740.png](all-empty-en-light-740.png) | All sessions: no session in the last 24 hours | English | light | 740x800 |
| [all-empty-en-dark-1280.png](all-empty-en-dark-1280.png) | All sessions: no session in the last 24 hours | English | dark | 1280x800 |
| [all-empty-en-dark-740.png](all-empty-en-dark-740.png) | All sessions: no session in the last 24 hours | English | dark | 740x800 |
| [all-empty-ru-light-1280.png](all-empty-ru-light-1280.png) | All sessions: no session in the last 24 hours | Russian | light | 1280x800 |
| [all-empty-ru-light-740.png](all-empty-ru-light-740.png) | All sessions: no session in the last 24 hours | Russian | light | 740x800 |
| [all-empty-ru-dark-1280.png](all-empty-ru-dark-1280.png) | All sessions: no session in the last 24 hours | Russian | dark | 1280x800 |
| [all-empty-ru-dark-740.png](all-empty-ru-dark-740.png) | All sessions: no session in the last 24 hours | Russian | dark | 740x800 |
| [all-loading-en-light-1280.png](all-loading-en-light-1280.png) | All sessions: the first read has not answered yet (`status.sessions` null) | English | light | 1280x800 |
| [all-loading-en-light-740.png](all-loading-en-light-740.png) | All sessions: the first read has not answered yet (`status.sessions` null) | English | light | 740x800 |
| [all-loading-en-dark-1280.png](all-loading-en-dark-1280.png) | All sessions: the first read has not answered yet (`status.sessions` null) | English | dark | 1280x800 |
| [all-loading-en-dark-740.png](all-loading-en-dark-740.png) | All sessions: the first read has not answered yet (`status.sessions` null) | English | dark | 740x800 |
| [all-loading-ru-light-1280.png](all-loading-ru-light-1280.png) | All sessions: the first read has not answered yet (`status.sessions` null) | Russian | light | 1280x800 |
| [all-loading-ru-light-740.png](all-loading-ru-light-740.png) | All sessions: the first read has not answered yet (`status.sessions` null) | Russian | light | 740x800 |
| [all-loading-ru-dark-1280.png](all-loading-ru-dark-1280.png) | All sessions: the first read has not answered yet (`status.sessions` null) | Russian | dark | 1280x800 |
| [all-loading-ru-dark-740.png](all-loading-ru-dark-740.png) | All sessions: the first read has not answered yet (`status.sessions` null) | Russian | dark | 740x800 |
| [all-no-switchboard-en-light-1280.png](all-no-switchboard-en-light-1280.png) | All sessions without Switchboard: only this app's own consoles, with the notice how to get it | English | light | 1280x905 |
| [all-no-switchboard-en-light-740.png](all-no-switchboard-en-light-740.png) | All sessions without Switchboard: only this app's own consoles, with the notice how to get it | English | light | 740x1202 |
| [all-no-switchboard-en-dark-1280.png](all-no-switchboard-en-dark-1280.png) | All sessions without Switchboard: only this app's own consoles, with the notice how to get it | English | dark | 1280x905 |
| [all-no-switchboard-en-dark-740.png](all-no-switchboard-en-dark-740.png) | All sessions without Switchboard: only this app's own consoles, with the notice how to get it | English | dark | 740x1202 |
| [all-no-switchboard-ru-light-1280.png](all-no-switchboard-ru-light-1280.png) | All sessions without Switchboard: only this app's own consoles, with the notice how to get it | Russian | light | 1280x905 |
| [all-no-switchboard-ru-light-740.png](all-no-switchboard-ru-light-740.png) | All sessions without Switchboard: only this app's own consoles, with the notice how to get it | Russian | light | 740x1223 |
| [all-no-switchboard-ru-dark-1280.png](all-no-switchboard-ru-dark-1280.png) | All sessions without Switchboard: only this app's own consoles, with the notice how to get it | Russian | dark | 1280x905 |
| [all-no-switchboard-ru-dark-740.png](all-no-switchboard-ru-dark-740.png) | All sessions without Switchboard: only this app's own consoles, with the notice how to get it | Russian | dark | 740x1223 |
| [all-degraded-en-light-1280.png](all-degraded-en-light-1280.png) | All sessions while Switchboard does not answer: the list may be out of date since a time | English | light | 1280x800 |
| [all-degraded-en-light-740.png](all-degraded-en-light-740.png) | All sessions while Switchboard does not answer: the list may be out of date since a time | English | light | 740x800 |
| [all-degraded-en-dark-1280.png](all-degraded-en-dark-1280.png) | All sessions while Switchboard does not answer: the list may be out of date since a time | English | dark | 1280x800 |
| [all-degraded-en-dark-740.png](all-degraded-en-dark-740.png) | All sessions while Switchboard does not answer: the list may be out of date since a time | English | dark | 740x800 |
| [all-degraded-ru-light-1280.png](all-degraded-ru-light-1280.png) | All sessions while Switchboard does not answer: the list may be out of date since a time | Russian | light | 1280x800 |
| [all-degraded-ru-light-740.png](all-degraded-ru-light-740.png) | All sessions while Switchboard does not answer: the list may be out of date since a time | Russian | light | 740x800 |
| [all-degraded-ru-dark-1280.png](all-degraded-ru-dark-1280.png) | All sessions while Switchboard does not answer: the list may be out of date since a time | Russian | dark | 1280x800 |
| [all-degraded-ru-dark-740.png](all-degraded-ru-dark-740.png) | All sessions while Switchboard does not answer: the list may be out of date since a time | Russian | dark | 740x800 |
| [session-running-en-light-1280.png](session-running-en-light-1280.png) | A session running in a console of this app, its console under the header (End, Show in Finder) | English | light | 1280x800 |
| [session-running-en-light-740.png](session-running-en-light-740.png) | A session running in a console of this app, its console under the header (End, Show in Finder) | English | light | 740x800 |
| [session-running-en-dark-1280.png](session-running-en-dark-1280.png) | A session running in a console of this app, its console under the header (End, Show in Finder) | English | dark | 1280x800 |
| [session-running-en-dark-740.png](session-running-en-dark-740.png) | A session running in a console of this app, its console under the header (End, Show in Finder) | English | dark | 740x800 |
| [session-running-ru-light-1280.png](session-running-ru-light-1280.png) | A session running in a console of this app, its console under the header (End, Show in Finder) | Russian | light | 1280x800 |
| [session-running-ru-light-740.png](session-running-ru-light-740.png) | A session running in a console of this app, its console under the header (End, Show in Finder) | Russian | light | 740x800 |
| [session-running-ru-dark-1280.png](session-running-ru-dark-1280.png) | A session running in a console of this app, its console under the header (End, Show in Finder) | Russian | dark | 1280x800 |
| [session-running-ru-dark-740.png](session-running-ru-dark-740.png) | A session running in a console of this app, its console under the header (End, Show in Finder) | Russian | dark | 740x800 |
| [session-terminal-en-light-1280.png](session-terminal-en-light-1280.png) | A session Switchboard runs in Terminal: no console here, Show in Finder only | English | light | 1280x800 |
| [session-terminal-en-light-740.png](session-terminal-en-light-740.png) | A session Switchboard runs in Terminal: no console here, Show in Finder only | English | light | 740x800 |
| [session-terminal-en-dark-1280.png](session-terminal-en-dark-1280.png) | A session Switchboard runs in Terminal: no console here, Show in Finder only | English | dark | 1280x800 |
| [session-terminal-en-dark-740.png](session-terminal-en-dark-740.png) | A session Switchboard runs in Terminal: no console here, Show in Finder only | English | dark | 740x800 |
| [session-terminal-ru-light-1280.png](session-terminal-ru-light-1280.png) | A session Switchboard runs in Terminal: no console here, Show in Finder only | Russian | light | 1280x800 |
| [session-terminal-ru-light-740.png](session-terminal-ru-light-740.png) | A session Switchboard runs in Terminal: no console here, Show in Finder only | Russian | light | 740x800 |
| [session-terminal-ru-dark-1280.png](session-terminal-ru-dark-1280.png) | A session Switchboard runs in Terminal: no console here, Show in Finder only | Russian | dark | 1280x800 |
| [session-terminal-ru-dark-740.png](session-terminal-ru-dark-740.png) | A session Switchboard runs in Terminal: no console here, Show in Finder only | Russian | dark | 740x800 |
| [session-resume-failed-en-light-1280.png](session-resume-failed-en-light-1280.png) | Needs you: continued after a limit, did not take up its conversation (console, End) | English | light | 1280x800 |
| [session-resume-failed-en-light-740.png](session-resume-failed-en-light-740.png) | Needs you: continued after a limit, did not take up its conversation (console, End) | English | light | 740x800 |
| [session-resume-failed-en-dark-1280.png](session-resume-failed-en-dark-1280.png) | Needs you: continued after a limit, did not take up its conversation (console, End) | English | dark | 1280x800 |
| [session-resume-failed-en-dark-740.png](session-resume-failed-en-dark-740.png) | Needs you: continued after a limit, did not take up its conversation (console, End) | English | dark | 740x800 |
| [session-resume-failed-ru-light-1280.png](session-resume-failed-ru-light-1280.png) | Needs you: continued after a limit, did not take up its conversation (console, End) | Russian | light | 1280x800 |
| [session-resume-failed-ru-light-740.png](session-resume-failed-ru-light-740.png) | Needs you: continued after a limit, did not take up its conversation (console, End) | Russian | light | 740x800 |
| [session-resume-failed-ru-dark-1280.png](session-resume-failed-ru-dark-1280.png) | Needs you: continued after a limit, did not take up its conversation (console, End) | Russian | dark | 1280x800 |
| [session-resume-failed-ru-dark-740.png](session-resume-failed-ru-dark-740.png) | Needs you: continued after a limit, did not take up its conversation (console, End) | Russian | dark | 740x800 |
| [session-not-opened-en-light-1280.png](session-not-opened-en-light-1280.png) | Needs you: a hand-over that could not open here (no disk room), opened in Terminal instead; Remove | English | light | 1280x800 |
| [session-not-opened-en-light-740.png](session-not-opened-en-light-740.png) | Needs you: a hand-over that could not open here (no disk room), opened in Terminal instead; Remove | English | light | 740x800 |
| [session-not-opened-en-dark-1280.png](session-not-opened-en-dark-1280.png) | Needs you: a hand-over that could not open here (no disk room), opened in Terminal instead; Remove | English | dark | 1280x800 |
| [session-not-opened-en-dark-740.png](session-not-opened-en-dark-740.png) | Needs you: a hand-over that could not open here (no disk room), opened in Terminal instead; Remove | English | dark | 740x800 |
| [session-not-opened-ru-light-1280.png](session-not-opened-ru-light-1280.png) | Needs you: a hand-over that could not open here (no disk room), opened in Terminal instead; Remove | Russian | light | 1280x800 |
| [session-not-opened-ru-light-740.png](session-not-opened-ru-light-740.png) | Needs you: a hand-over that could not open here (no disk room), opened in Terminal instead; Remove | Russian | light | 740x800 |
| [session-not-opened-ru-dark-1280.png](session-not-opened-ru-dark-1280.png) | Needs you: a hand-over that could not open here (no disk room), opened in Terminal instead; Remove | Russian | dark | 1280x800 |
| [session-not-opened-ru-dark-740.png](session-not-opened-ru-dark-740.png) | Needs you: a hand-over that could not open here (no disk room), opened in Terminal instead; Remove | Russian | dark | 740x800 |
| [session-waiting-en-light-1280.png](session-waiting-en-light-1280.png) | Waiting for a limit reset: stopped by a limit on an account, Continue now opened on its two candidate accounts, Don't continue | English | light | 1280x800 |
| [session-waiting-en-light-740.png](session-waiting-en-light-740.png) | Waiting for a limit reset: stopped by a limit on an account, Continue now opened on its two candidate accounts, Don't continue | English | light | 740x800 |
| [session-waiting-en-dark-1280.png](session-waiting-en-dark-1280.png) | Waiting for a limit reset: stopped by a limit on an account, Continue now opened on its two candidate accounts, Don't continue | English | dark | 1280x800 |
| [session-waiting-en-dark-740.png](session-waiting-en-dark-740.png) | Waiting for a limit reset: stopped by a limit on an account, Continue now opened on its two candidate accounts, Don't continue | English | dark | 740x800 |
| [session-waiting-ru-light-1280.png](session-waiting-ru-light-1280.png) | Waiting for a limit reset: stopped by a limit on an account, Continue now opened on its two candidate accounts, Don't continue | Russian | light | 1280x800 |
| [session-waiting-ru-light-740.png](session-waiting-ru-light-740.png) | Waiting for a limit reset: stopped by a limit on an account, Continue now opened on its two candidate accounts, Don't continue | Russian | light | 740x800 |
| [session-waiting-ru-dark-1280.png](session-waiting-ru-dark-1280.png) | Waiting for a limit reset: stopped by a limit on an account, Continue now opened on its two candidate accounts, Don't continue | Russian | dark | 1280x800 |
| [session-waiting-ru-dark-740.png](session-waiting-ru-dark-740.png) | Waiting for a limit reset: stopped by a limit on an account, Continue now opened on its two candidate accounts, Don't continue | Russian | dark | 740x800 |
| [session-ended-en-light-1280.png](session-ended-en-light-1280.png) | Ended cleanly, with what its console printed (Continue, Remove) | English | light | 1280x800 |
| [session-ended-en-light-740.png](session-ended-en-light-740.png) | Ended cleanly, with what its console printed (Continue, Remove) | English | light | 740x800 |
| [session-ended-en-dark-1280.png](session-ended-en-dark-1280.png) | Ended cleanly, with what its console printed (Continue, Remove) | English | dark | 1280x800 |
| [session-ended-en-dark-740.png](session-ended-en-dark-740.png) | Ended cleanly, with what its console printed (Continue, Remove) | English | dark | 740x800 |
| [session-ended-ru-light-1280.png](session-ended-ru-light-1280.png) | Ended cleanly, with what its console printed (Continue, Remove) | Russian | light | 1280x800 |
| [session-ended-ru-light-740.png](session-ended-ru-light-740.png) | Ended cleanly, with what its console printed (Continue, Remove) | Russian | light | 740x800 |
| [session-ended-ru-dark-1280.png](session-ended-ru-dark-1280.png) | Ended cleanly, with what its console printed (Continue, Remove) | Russian | dark | 1280x800 |
| [session-ended-ru-dark-740.png](session-ended-ru-dark-740.png) | Ended cleanly, with what its console printed (Continue, Remove) | Russian | dark | 740x800 |
| [session-idle-closed-en-light-1280.png](session-idle-closed-en-light-1280.png) | Closed after 30 idle minutes, with its console output | English | light | 1280x800 |
| [session-idle-closed-en-light-740.png](session-idle-closed-en-light-740.png) | Closed after 30 idle minutes, with its console output | English | light | 740x800 |
| [session-idle-closed-en-dark-1280.png](session-idle-closed-en-dark-1280.png) | Closed after 30 idle minutes, with its console output | English | dark | 1280x800 |
| [session-idle-closed-en-dark-740.png](session-idle-closed-en-dark-740.png) | Closed after 30 idle minutes, with its console output | English | dark | 740x800 |
| [session-idle-closed-ru-light-1280.png](session-idle-closed-ru-light-1280.png) | Closed after 30 idle minutes, with its console output | Russian | light | 1280x800 |
| [session-idle-closed-ru-light-740.png](session-idle-closed-ru-light-740.png) | Closed after 30 idle minutes, with its console output | Russian | light | 740x800 |
| [session-idle-closed-ru-dark-1280.png](session-idle-closed-ru-dark-1280.png) | Closed after 30 idle minutes, with its console output | Russian | dark | 1280x800 |
| [session-idle-closed-ru-dark-740.png](session-idle-closed-ru-dark-740.png) | Closed after 30 idle minutes, with its console output | Russian | dark | 740x800 |
| [session-ended-by-you-en-light-1280.png](session-ended-by-you-en-light-1280.png) | Ended by the person (End), with its console output (a Codex session) | English | light | 1280x800 |
| [session-ended-by-you-en-light-740.png](session-ended-by-you-en-light-740.png) | Ended by the person (End), with its console output (a Codex session) | English | light | 740x800 |
| [session-ended-by-you-en-dark-1280.png](session-ended-by-you-en-dark-1280.png) | Ended by the person (End), with its console output (a Codex session) | English | dark | 1280x800 |
| [session-ended-by-you-en-dark-740.png](session-ended-by-you-en-dark-740.png) | Ended by the person (End), with its console output (a Codex session) | English | dark | 740x800 |
| [session-ended-by-you-ru-light-1280.png](session-ended-by-you-ru-light-1280.png) | Ended by the person (End), with its console output (a Codex session) | Russian | light | 1280x800 |
| [session-ended-by-you-ru-light-740.png](session-ended-by-you-ru-light-740.png) | Ended by the person (End), with its console output (a Codex session) | Russian | light | 740x800 |
| [session-ended-by-you-ru-dark-1280.png](session-ended-by-you-ru-dark-1280.png) | Ended by the person (End), with its console output (a Codex session) | Russian | dark | 1280x800 |
| [session-ended-by-you-ru-dark-740.png](session-ended-by-you-ru-dark-740.png) | Ended by the person (End), with its console output (a Codex session) | Russian | dark | 740x800 |
| [session-ended-restart-en-light-1280.png](session-ended-restart-en-light-1280.png) | Ended before the app restarted: what it printed is not kept, the page says so (no console) | English | light | 1280x800 |
| [session-ended-restart-en-light-740.png](session-ended-restart-en-light-740.png) | Ended before the app restarted: what it printed is not kept, the page says so (no console) | English | light | 740x800 |
| [session-ended-restart-en-dark-1280.png](session-ended-restart-en-dark-1280.png) | Ended before the app restarted: what it printed is not kept, the page says so (no console) | English | dark | 1280x800 |
| [session-ended-restart-en-dark-740.png](session-ended-restart-en-dark-740.png) | Ended before the app restarted: what it printed is not kept, the page says so (no console) | English | dark | 740x800 |
| [session-ended-restart-ru-light-1280.png](session-ended-restart-ru-light-1280.png) | Ended before the app restarted: what it printed is not kept, the page says so (no console) | Russian | light | 1280x800 |
| [session-ended-restart-ru-light-740.png](session-ended-restart-ru-light-740.png) | Ended before the app restarted: what it printed is not kept, the page says so (no console) | Russian | light | 740x800 |
| [session-ended-restart-ru-dark-1280.png](session-ended-restart-ru-dark-1280.png) | Ended before the app restarted: what it printed is not kept, the page says so (no console) | Russian | dark | 1280x800 |
| [session-ended-restart-ru-dark-740.png](session-ended-restart-ru-dark-740.png) | Ended before the app restarted: what it printed is not kept, the page says so (no console) | Russian | dark | 740x800 |
| [agents-sidebar-en-light-1280.png](agents-sidebar-en-light-1280.png) | The Agents mode: its sidebar and the Overview with no agent installed (its empty state) | English | light | 1280x800 |
| [agents-sidebar-en-light-740.png](agents-sidebar-en-light-740.png) | The Agents mode: its sidebar and the Overview with no agent installed (its empty state) | English | light | 740x800 |
| [agents-sidebar-en-dark-1280.png](agents-sidebar-en-dark-1280.png) | The Agents mode: its sidebar and the Overview with no agent installed (its empty state) | English | dark | 1280x800 |
| [agents-sidebar-en-dark-740.png](agents-sidebar-en-dark-740.png) | The Agents mode: its sidebar and the Overview with no agent installed (its empty state) | English | dark | 740x800 |
| [agents-sidebar-ru-light-1280.png](agents-sidebar-ru-light-1280.png) | The Agents mode: its sidebar and the Overview with no agent installed (its empty state) | Russian | light | 1280x800 |
| [agents-sidebar-ru-light-740.png](agents-sidebar-ru-light-740.png) | The Agents mode: its sidebar and the Overview with no agent installed (its empty state) | Russian | light | 740x800 |
| [agents-sidebar-ru-dark-1280.png](agents-sidebar-ru-dark-1280.png) | The Agents mode: its sidebar and the Overview with no agent installed (its empty state) | Russian | dark | 1280x800 |
| [agents-sidebar-ru-dark-740.png](agents-sidebar-ru-dark-740.png) | The Agents mode: its sidebar and the Overview with no agent installed (its empty state) | Russian | dark | 740x800 |
| [rail-sessions-en-light-1280.png](rail-sessions-en-light-1280.png) | The folded rail in the Sessions mode, on All sessions | English | light | 1280x800 |
| [rail-sessions-en-light-740.png](rail-sessions-en-light-740.png) | The folded rail in the Sessions mode, on All sessions | English | light | 740x800 |
| [rail-sessions-en-dark-1280.png](rail-sessions-en-dark-1280.png) | The folded rail in the Sessions mode, on All sessions | English | dark | 1280x800 |
| [rail-sessions-en-dark-740.png](rail-sessions-en-dark-740.png) | The folded rail in the Sessions mode, on All sessions | English | dark | 740x800 |
| [rail-sessions-ru-light-1280.png](rail-sessions-ru-light-1280.png) | The folded rail in the Sessions mode, on All sessions | Russian | light | 1280x800 |
| [rail-sessions-ru-light-740.png](rail-sessions-ru-light-740.png) | The folded rail in the Sessions mode, on All sessions | Russian | light | 740x800 |
| [rail-sessions-ru-dark-1280.png](rail-sessions-ru-dark-1280.png) | The folded rail in the Sessions mode, on All sessions | Russian | dark | 1280x800 |
| [rail-sessions-ru-dark-740.png](rail-sessions-ru-dark-740.png) | The folded rail in the Sessions mode, on All sessions | Russian | dark | 740x800 |
| [rail-agents-en-light-1280.png](rail-agents-en-light-1280.png) | The folded rail in the Agents mode, on Overview | English | light | 1280x800 |
| [rail-agents-en-light-740.png](rail-agents-en-light-740.png) | The folded rail in the Agents mode, on Overview | English | light | 740x800 |
| [rail-agents-en-dark-1280.png](rail-agents-en-dark-1280.png) | The folded rail in the Agents mode, on Overview | English | dark | 1280x800 |
| [rail-agents-en-dark-740.png](rail-agents-en-dark-740.png) | The folded rail in the Agents mode, on Overview | English | dark | 740x800 |
| [rail-agents-ru-light-1280.png](rail-agents-ru-light-1280.png) | The folded rail in the Agents mode, on Overview | Russian | light | 1280x800 |
| [rail-agents-ru-light-740.png](rail-agents-ru-light-740.png) | The folded rail in the Agents mode, on Overview | Russian | light | 740x800 |
| [rail-agents-ru-dark-1280.png](rail-agents-ru-dark-1280.png) | The folded rail in the Agents mode, on Overview | Russian | dark | 1280x800 |
| [rail-agents-ru-dark-740.png](rail-agents-ru-dark-740.png) | The folded rail in the Agents mode, on Overview | Russian | dark | 740x800 |
| [settings-sessions-en-light-1280.png](settings-sessions-en-light-1280.png) | Settings opened on its Sessions section by the note's "Choose where sessions continue" | English | light | 1280x800 |
| [settings-sessions-en-light-740.png](settings-sessions-en-light-740.png) | Settings opened on its Sessions section by the note's "Choose where sessions continue" | English | light | 740x800 |
| [settings-sessions-en-dark-1280.png](settings-sessions-en-dark-1280.png) | Settings opened on its Sessions section by the note's "Choose where sessions continue" | English | dark | 1280x800 |
| [settings-sessions-en-dark-740.png](settings-sessions-en-dark-740.png) | Settings opened on its Sessions section by the note's "Choose where sessions continue" | English | dark | 740x800 |
| [settings-sessions-ru-light-1280.png](settings-sessions-ru-light-1280.png) | Settings opened on its Sessions section by the note's "Choose where sessions continue" | Russian | light | 1280x800 |
| [settings-sessions-ru-light-740.png](settings-sessions-ru-light-740.png) | Settings opened on its Sessions section by the note's "Choose where sessions continue" | Russian | light | 740x800 |
| [settings-sessions-ru-dark-1280.png](settings-sessions-ru-dark-1280.png) | Settings opened on its Sessions section by the note's "Choose where sessions continue" | Russian | dark | 1280x800 |
| [settings-sessions-ru-dark-740.png](settings-sessions-ru-dark-740.png) | Settings opened on its Sessions section by the note's "Choose where sessions continue" | Russian | dark | 740x800 |
| [end-question-en-light-1280.png](end-question-en-light-1280.png) | The End question, asked over a running session's page (its console steps aside while it is open) | English | light | 1280x800 |
| [end-question-en-light-740.png](end-question-en-light-740.png) | The End question, asked over a running session's page (its console steps aside while it is open) | English | light | 740x800 |
| [end-question-en-dark-1280.png](end-question-en-dark-1280.png) | The End question, asked over a running session's page (its console steps aside while it is open) | English | dark | 1280x800 |
| [end-question-en-dark-740.png](end-question-en-dark-740.png) | The End question, asked over a running session's page (its console steps aside while it is open) | English | dark | 740x800 |
| [end-question-ru-light-1280.png](end-question-ru-light-1280.png) | The End question, asked over a running session's page (its console steps aside while it is open) | Russian | light | 1280x800 |
| [end-question-ru-light-740.png](end-question-ru-light-740.png) | The End question, asked over a running session's page (its console steps aside while it is open) | Russian | light | 740x800 |
| [end-question-ru-dark-1280.png](end-question-ru-dark-1280.png) | The End question, asked over a running session's page (its console steps aside while it is open) | Russian | dark | 1280x800 |
| [end-question-ru-dark-740.png](end-question-ru-dark-740.png) | The End question, asked over a running session's page (its console steps aside while it is open) | Russian | dark | 740x800 |
