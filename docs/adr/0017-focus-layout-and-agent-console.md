# ADR-0017 — Focus on the dashboard, and an agent console beside it

Status: accepted · 2026-10-06 (operator) ([brief](../evidence/briefs/2026-10-06-focus-and-console-brief.md))

## Context

On 2026-10-06 the operator asked for two things.

- **The dashboard should get the screen.** On a 1056-pixel-high window, the service header took
  about 300 pixels and the tabs and toolbar another 100. Most of the time the operator wants the
  dashboard's own content, not the header.
- **They want to work with an agent right next to the dashboard**: open a console running Claude
  Code, Codex or another runtime, give it tasks, have it edit.
  - The console runs the runtime's **own interface**. The operator ruled out a chat of our own:
    "the chat is inside the console".
  - The runtime, the folder and the account must be right and configurable. Where Fabric
    Switchboard binds a folder to a project, the session runs on that project's account.

What exists today:

- **Fabric** gives another app no way in yet. Its board (`fabric-project-comms/0.1`, COM-02/03) is
  not built, and its CEO chat is in-app only.
- **Switchboard 0.6.5** resolves a folder's project read-only
  (`switchboard --json project show --path`). It starts a project-bound session only in a new
  Terminal window (`launch <account> --mode managed|isolated`) and hands no launch environment
  to other apps. It accepted SB-75 on 2026-10-06: `launch --provider claude|codex --in-place
  [-- <args>]` will prepare the same session and run it in the caller's terminal, so the caller
  never holds a token.
- **Subscription sign-ins** are for the unmodified Claude Code and Codex clients only
  (Switchboard `docs/AGENT-SUPPORT.md`). A real terminal running the real CLI, typed into by a
  person, stays inside that rule.

## Decision

<a id="decision"></a>

1. **The service header has two forms** (SCN-046).
   - **The compact bar** is one line: the state mark, the name, the state badge, the tabs, and
     an expand control.
   - **The full card** is the current header: summary, facts, tools, reasons, last action, and
     the actions.
   - The compact bar is the default, and the choice is remembered across services and launches.
     View → Show or Hide Service Details (⌃⌘D) does the same. The name's hover text is the agent's
     summary (ADR-0016 amendment).
   - **Compact never hides a problem.** A state other than ready, or a failed action that is
     still news, shows as one chip with its first reason. Pressing the chip expands the card.
   - A running action (Starting…, Restarting…) shows its spinner in the bar.
2. **The sidebar collapses to a rail** (SCN-047): the mark, icons for Overview, Activity, Spend
   and Settings, and one entry per product with its state mark and initials. Badges stay. Each
   entry names itself in a tooltip and to a screen reader. The choice is remembered. View → Show or
   Hide Sidebar (⌃⌘S). The rail is 76 px, as wide as the window's traffic lights.
3. **A console panel sits to the right of the dashboard, one per service** (SCN-048…050).
   - It can be collapsed and resized (320 px up to half the window; the edge also moves with the
     arrow keys), and both its width and whether it is open are remembered. View → Show or Hide
     Console (⌃⌘T).
   - It is a **terminal**: a PTY in the main process (`node-pty`) and an xterm.js view in the
     window. It runs the chosen runtime's own CLI in the service's folder. Prompts, permission
     questions and resume menus are the runtime's own.
   - **Runtime.** Offered: the runtimes installed and executable on this Mac (`src/core/runtimes.ts`).
     - Claude Code and Codex come first.
     - Any other known runtime appears only if its binary is found on the login shell's `PATH`.
       The list is Switchboard's catalog when Switchboard is installed, else a built-in list.
     - The choice is remembered per service.
   - **Folder.** The local checkout whose git `origin` matches the descriptor's
     `source.repository`. The roots searched are `~/DATA`, `~/Code`, `~/Projects`,
     `~/Developer` and `~/src`, at depths 1 and 2. The folder is read from `.git/config`,
     never by running git. «Other…» chooses any folder, and the choice is remembered per service.
   - **Account (Switchboard).** Before a start, `project show --path <folder>` is read.
     - **No project** (or no Switchboard): the runtime runs as installed, on its ordinary
       sign-in. Switchboard's `claude_cli` rotation still applies to it.
     - **A project, and the installed Switchboard has `--in-place`**: the PTY runs
       `switchboard launch --provider <claude|codex> --mode managed --working-directory <folder>
       --in-place [-- <resume args>]`. The project's account is used, and no token passes
       through Dashboards.
     - **A project, without `--in-place`**: the panel names the project and offers «Open in
       Terminal via Switchboard». That runs the existing `switchboard launch <selected account>
       --mode managed`. It never starts the plain runtime in a project folder, because that would
       run on the wrong account.
   - **New / Continue.**
     - New starts fresh.
     - Continue resumes the runtime's last conversation in that folder: `claude --continue`,
       `codex resume --last`. Continue is offered only where the runtime has such a flag.
   - **Open in Terminal** continues the same runtime and folder in Terminal.app (Continue where the
     runtime can). For a folder bound to a Switchboard project it is «Open in Terminal via
     Switchboard»: Switchboard's own launch, a new session on the project's account (it takes no
     resume argument until SB-75). Terminal is opened through LaunchServices with a one-shot
     `.command` file (0700, removing itself), the way Switchboard does it — no Apple Events, so no
     automation permission is asked for.
   - **Stop** hangs up the runtime's whole process group (node-pty makes it a session leader) and
     kills the group 2 s later; a removed service's session is still waited for at quit.
   - **Where it lives.** `src/core/runtimes.ts` (runtimes), `src/core/repofind.ts` (folder),
     `src/core/switchboard.ts` (account), `src/core/consoles.ts` (sessions on an injected PTY, the
     start plan, the Terminal line), `src/electron/console.ts` (IPC, node-pty, the login `PATH`),
     `src/renderer/components/ConsolePanel.tsx` (the panel). Settings: `layout` and `consoles`.
   - **Stop asks first**, inline in the panel, then hangs up; a runtime that ignores the hang-up is
     killed 2 s later.
   - **Lifecycle.**
     - A console process is owned. It ends when the app quits, when the person stops it, or when
       its service is removed.
     - While one runs, an automatic update does not install (ADR-0015 treats it like a running
       command).
     - Its output is kept in a 1 MB ring per session. A hidden window receives no output (LC-08);
       showing the console again replays the ring.
     - The process environment drops `ELECTRON_RUN_AS_NODE` and `NODE_OPTIONS`. `PATH` is the
       login shell's, read once.
4. **The renderer's CSP allows inline styles** (`style-src 'self' 'unsafe-inline'`), because
   xterm.js injects `<style>` elements and supports no nonce.
   - Scripts stay `'self'`, and `connect-src 'none'` and `img-src 'self' data:` still hold, so
     injected CSS cannot send anything out.
   - No token ever reaches the renderer. The console carries only what the runtime prints.
5. **Packaging.** `node-pty` is N-API, and its macOS prebuilds cover arm64 and x64, so the
   universal app loads it in Electron without a rebuild.
   - The module is unpacked from `app.asar`, because `spawn-helper` must be executable. node-pty
     1.1.0 ships `spawn-helper` without its executable bit and its postinstall never sets it: the
     build sets it before signing (`stageNativeModules`), and a development checkout gets it on first
     use (`ensureSpawnHelper`).
   - Both architectures' prebuilds are in both halves of the universal app, byte for byte, so they
     are declared to the universal merge (`osxUniversal.x64ArchFiles`) instead of being lipo'd.
   - The app stage proves a PTY spawns from the finished bundle (`checks.pty`). Measured
     2026-10-06 on an unsigned universal build: `checks.pty` passed, and the arm64 and x86_64
     slices (the latter under Rosetta) each ran `uname -m` on a PTY from `app.asar`.
6. **Fabric later.** When Fabric's harness can launch and control sessions, it becomes another
   way to start the same console: a launcher behind the panel, not a chat. Fabric recorded the
   same rule for itself on 2026-10-06: the conversation is the runtime's console, the CEO is a
   session, and Fabric is the harness (Fabric ADR-0123 §5 names this panel as a session its
   harness will launch and control; its plan row P-13).

## Consequences

- **The panel can run anything the operator's runtime can do**, in a folder of their choice. It
  is the operator's own terminal, with their settings and skills. Permission prompts are the
  runtime's.
- **One Switchboard limit is visible here.** Until SB-75 ships, a project-bound folder opens
  outside the app. After it ships, Switchboard still runs one managed session per provider and
  pool, so a second project console in the same pool is refused, in Switchboard's own words.
- **A native module now ships.** Its prebuilds must keep covering both architectures. A
  `node-pty` upgrade is checked by `checks.pty`.
- **Lifecycle (AGENTS.md).** The LC-09 table gains the console process. The data list gains no
  file: the ring lives in memory; the choices live in `settings.json` (`layout`, `consoles`).
- **Tests.** `test/console.test.ts` (runtimes, folder, Switchboard, sessions on a fake PTY, the
  start plan, the Terminal line), `test/parts.test.ts` (settings, the problem chip),
  `test/dist.test.ts` (staging), `test/e2e/focus-console.test.ts` (the walk with a scripted runtime).
