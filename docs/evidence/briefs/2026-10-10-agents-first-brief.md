# Brief — FD-39 Agents first: hand the work to the coding agent, show the result (2026-10-10)

The operator's request (2026-10-10, verbatim intent): working with agents and updating them means handing the task to
Fabric, Claude Code or another coding agent **with the right context**. The console must open already knowing which
Fabric agent it is, with its errors, states and the rest. Specify the first session and the second and later ones.
Pin an agent to the top of the list and sort the list. Onboard the person **through their coding agent in a terminal**,
not through the interface. Check how the **whole system** sets up when a person follows the Fabric tutorial, and decide
where each step belongs. The strategy is that **the coding agent does everything it can, and the interface shows the
result**. Hand that strategy to every product, each for its own part.

Pipeline: task-pipeline, Proof of Done. Design surface: text-only — `docs/ux/screens.md` has no Figma frame and
"Figma library: none"; this run keeps it that way. Operator stance: decide without asking, except at true human gates.

## Source ledger

| Source | What it says for this task |
|---|---|
| `src/core/consoles.ts:48-62,121-125`, `src/core/runtimes.ts:105-109`, `src/electron/console.ts:123-175` | A console session gets only `FABRIC_DASHBOARDS_SERVICE=<key>` and a working folder. It gets no prompt, no context file, no MCP and no state, errors, events or descriptor. |
| `docs/adr/0017-focus-layout-and-agent-console.md` §6 | The console is "a launcher behind the panel, not a chat". A Fabric-launched session is deferred. |
| `src/core/monitor.ts:654`, `src/core/products.ts:38-59`, `src/renderer/App.tsx:124-157,213-225` | The list is sorted by name and has the sections Services and Background. It has no pin, no sort control, no search and no arrow-key navigation. |
| `src/renderer/components/Overview.tsx:11-32,66-77` | The first run is one question (open at login) plus an empty state that links to the adapter README. There is no setup flow and no returning-session view. |
| `src/mcp/tools.ts`, `src/mcp/server.ts:47-121` | 10 MCP tools. None returns the descriptor, the repo, log paths or a console session. |
| `docs/evidence/retro.md` standing instructions 1-8 | These bind this run: merge on the gate's exit code, CI step by step, leases first, builds in the scratchpad, read release rules first, e2e checks the screen lock, a timed-out test says what it saw, ownership before visibility. |
| `docs/backlog.md` | 10 open rows. FD-37 is in progress. No row covers the console context, pinning or onboarding. |
| Fabric `docs/adr/0123-…` and `0129-…` (origin/main 403faab9) | The conversation is the runtime's console. Onboarding is four actions (create or adapt an agent, open or create a project); the coding agent does the work through the `creating-fabric-agents` and `adapting-projects-to-fabric` skills. |
| Fabric `apps/desktop/src/main/sessionBundle.ts:148-272`, `shared/preamble.ts:19-26`, `agentSurface.ts:944` | **The reference handoff.** Per session, in the app's data folder (never in the repo), Fabric writes `mcp.json` and `context.md`. Claude gets `--mcp-config … --strict-mcp-config --append-system-prompt <brief+PREAMBLE>`. Runners driven through an env variable get `brief.md` plus that variable. The first tool call is `fabric_whoami`. |
| Fabric `main/favourites.ts`, `shared/favourites.ts` | **The reference pin.** Kept local to the operator, in pin order, never re-sorted. |
| Fabric `start/FirstRun.tsx`, `main/executorDetect.ts:63-68`, `main/adapterSkills.ts:28` | The first run detects coding agents and shows install commands to copy. It checks the adapter skills and installs nothing. It does not install or register Dashboards, Switchboard, Inbox or Observatory. |
| fabric-workspace `knowledge/vision.md:28-38,82-85` | "Zero barrier to entry"; "the start is one command (the launcher) and a coding agent with the Fabric Agent Adapter skills"; "the interface is for seeing and for small corrections". The operator's strategy is already the vision. The products have not caught up with it. |
| fabric-workspace `knowledge/roadmap.md` RM-07, RM-08, RM-09, RM-23 | RM-07: tutorial in three layers. RM-08: one style, and the funnel installed → first agent → first dashboard session. RM-09: target first run (name, then Switchboard with consent, then Observatory, then a first agent, then open its dashboard; "nothing is installed silently"), status research. RM-23: per-agent skills. |
| fabric-workspace `knowledge/principles.md:5-13`, `lifecycle.md:10,28,35`, `products.md:38-43,86` | MCP first: a registration command plus a proving call. Setup asks once. Uninstall removes MCP entries. "Sessions Fabric starts cannot reach a product yet (CO-194)". |
| org-index `ONBOARDING.md` §1-7, `scripts/clone_all.sh` | The contributor setup is manual and sequential (tools, clone, skills, Observatory). The person runs every command. |
| Observatory `README.md:52`, `docs/AGENT-ONBOARDING.md`, `engine/workspace.py:585` | **The reference for agent-guided setup.** `full onboard` prints a 7-step guide for a coding agent; secrets go through a hidden prompt. |
| Switchboard `crates/switchboard-cli/src/main.rs:67-88`, `launch.rs:86-144,1230,1313-1454` | `launch --in-place -- <args>` allows at most 16 args of at most 1024 chars each. A managed session gets the switchboard MCP and no context file. First run is a 5-step UI tour. There is no live session list. |
| Inbox `AgentAccessSection.tsx:239`, `desktop/setup.html` | The person copies an MCP command with keys from Settings. First run is a UI wizard (Cloudflare token, sign-in, server). |
| Adapter `skills/creating-fabric-agents/SKILL.md:44-165` | Agent creation is already agent-led: intake grill, knowledge pack, skeleton with `AGENTS.md` + `CLAUDE.md`, scaffold, service, conformance. |
| Knowledge wiki `~/.obsidian-wiki/config` | Present. `projects/fabric-dashboards` is updated at stage 9. |
| Code graph `graphify-out/` | None found. Reach is taken from grep and the harvest's file:line evidence. |
| Verification ledger `docs/evidence/verification.md` | None found. Stage 8 rows go into the backlog closure receipts, as in earlier runs. |
| Brand pack `docs/brand/` | None found. Copy follows the established voice of `src/core/i18n.ts` (en + ru parity test). This gap is logged as carry-over C-3. |

## The whole system's setup today — who does each step

| Step | Product that owns it | Done by today | Should be done by (decision D-7) |
|---|---|---|---|
| Install a coding agent (Claude Code, Codex, …) | vendor | person copies a command (Fabric first run shows it) | person: a vendor sign-in is a human gate |
| Install the launcher and skills (`npx @passioncode-ai/passioncode@latest update`, `sshlg-skills`) | passioncode launcher | person copies a command | **coding agent**, once it runs: a skill install is a command |
| Install Fabric, Dashboards, Switchboard, Inbox apps | each product | person downloads | coding agent fetches and verifies the release (`SHA256SUMS` + GPG); the person consents once per product (RM-09: nothing installed silently) |
| Register each product's MCP with the coding agent | each product | person copies `claude mcp add …` | **coding agent** runs it, then the proving call (principles.md MCP-first) |
| Accounts and providers (Switchboard) | Switchboard | person in the UI tour | the person signs in (human gate); the coding agent binds the projects (`switchboard_project_context`, CLI) |
| Observatory engine and profile | Observatory | person runs `full init`, or `full onboard` guides an agent | coding agent with `full onboard` (already agent-ready) |
| Inbox server (Cloudflare token, sign-in) | Inbox | UI wizard | coding agent drives Wrangler and the setup API; the person pastes the token in a hidden prompt and signs in |
| Create or adapt the first agent | Adapter skills; Fabric starts it | coding agent in Fabric's console (ADR-0129) | the same; Dashboards offers it too when Fabric is absent |
| Make the agent a service (descriptor, launchd) | Adapter `building-fabric-services` | coding agent | the same; Dashboards shows it the moment the descriptor lands |
| See it running, open its dashboard, fix it | Dashboards | person in the UI | the UI **shows**; *Fix with agent* hands the fix to the coding agent with context |

What is missing is one entry point that a coding agent can run from start to finish, and each product's agent-ready
pieces: an `onboard` guide, MCP registration plus a proving call, and a context handoff when it starts a session.

## Decisions (the operator delegated them; each can be reversed)

| # | Decision | Why |
|---|---|---|
| D-1 | **Context handoff, Fabric's shape.** Each console start writes a context pack to `userData/consoles/<key>/`, 0600, never into the repo: `context.md` (who this agent is, its descriptor without secrets, state and reasons, last errors and events, version and update, repo and folder, what the agent may do) and `mcp.json` (the Dashboards MCP server through its own launcher). Claude Code gets `--mcp-config <mcp.json> --append-system-prompt-file <brief.md>`. Codex gets `-c mcp_servers.fabric-dashboards…` plus a first prompt naming the file. Gemini gets `-i <prompt>`. Every other runtime gets `FABRIC_DASHBOARDS_CONTEXT=<path>` and the same first prompt where its CLI takes one. A Switchboard in-place launch passes the same args after `--`; files keep each one under 1024 chars. | Matches Fabric's `sessionBundle` (one convention across products). The context reaches the agent before its first turn. The repo stays clean. |
| D-2 | **Live context over MCP:** a new tool `service_context(key)` returns the same pack, read fresh. The brief tells the agent to call it first, as Fabric's PREAMBLE does with `fabric_whoami`. | A file is a snapshot; the agent re-reads state after its own fix. |
| D-3 | **Task handoffs.** *Fix with agent* on each problem (Overview *Needs attention*, a service's reasons, a failed command) and *Update with agent* (an update is available, or the descriptor has no `update` command, or that command failed) open the console. The same pack is written plus a **task** (what is wrong, what was tried, what "fixed" means). The task becomes the first prompt, and the runtime's own CLI shows it before anything runs. | "Updating agents" and "errors" go to the coding agent; the UI shows the outcome through the monitor. |
| D-4 | **Pin and sort.** A *Pinned* section sits above Services, in pin order, never re-sorted (Fabric's rule), keyed by product id (ADR-0012). The rest of the list sorts by **Name** (default, today's order), **Status** (needs attention first) or **Recent activity**. Both live in `settings.layout.list`. | The person decides what stays on top; sorting is a view and never changes the data. |
| D-5 | **The first session is a setup by the coding agent.** On first launch (no `setupDone`), the console panel opens with a **Setup** session: not bound to a service, in `~` or a chosen folder, with the detected default runtime. One click (*Start setup*) starts the runtime with the setup brief. Starting a coding agent costs the person's subscription, so it needs a click. The brief: (1) register the Dashboards MCP with this runtime and make the proving call; (2) check the adapter skills, and install them with consent; (3) offer Switchboard, Observatory and Fabric, one at a time, with consent; each product's own `onboard` guide where one exists; (4) create or adapt the first agent with the adapter skills; (5) make it a service; Dashboards shows it as soon as its descriptor lands. With no runtime installed, the panel shows the vendors' install commands (as Fabric's first run does). The UI shows progress: services appearing, MCP registered, skills found. | The operator's "onboarding through the coding agent, a terminal on the first session". Human gates stay human: sign-ins, consents, the subscription. |
| D-6 | **Second and later sessions.** Overview opens on **what changed since you were last here**: problems with *Fix with agent*, updates with *Update with agent*, and *Continue* for the last console session of each agent the person worked on (Claude `--continue`, Codex `resume --last`). The last selected agent is remembered. A Setup checklist stays reachable from Settings and the empty state until it is complete. | The returning person needs the result and the next action, not a tour. |
| D-7 | **Ecosystem strategy: agents first, the interface shows the result.** It is written once in fabric-workspace `knowledge/` (owner: the fabric-workspace session). Each product's part is in the table below and goes to its owner session as a task. Nobody edits another product's repo or board. | The org rule: each product owns its part, the knowledge base owns the principle, the roadmap owns tracks (RM-09 and RM-07 already exist). |
| D-8 | Text-only design, as recorded in `docs/ux/screens.md`. Copy in en + ru through the i18n parity test. | Unchanged design surface. |

## Each product's part (D-7) — sent to its owner session; not edited here

| Product (owner session) | Its part |
|---|---|
| Fabric (fabric-90) | Install and register the family products during first run, through the coding agent, with consent (RM-09). Its sessions reach products' MCP (CO-194). Hand a Fabric agent to Dashboards' console with the same pack convention. Share the pack and preamble shape (`execution-packet/1`) so Dashboards and Fabric write one format. |
| Switchboard (fabric-switchboard-93) | `switchboard onboard`: an agent guide for accounts, projects and folder binding, the UI tour kept as a view. Pass a caller's context pack through `launch --in-place` without the 16 × 1024 arg limit cutting it (accept a file). A live session list the UI can show. |
| Inbox (fabric-inbox-df) | `onboard` for the coding agent: Wrangler deploy, token through a hidden prompt, then MCP registration plus the proving call run by the agent instead of a copied command. The setup wizard becomes the result view. |
| Observatory (project-observatory-3d) | Already agent-ready (`full onboard`). Expose it as the family setup's Observatory step, and record the checkpoint and handoff of a setup run. |
| Adapter (no live session; repo passioncode-ai/fabric-agent-adapter) | A family **setup** entry (`npx @passioncode-ai/passioncode onboard` or a `setting-up-fabric` skill) that orders the products' `onboard` guides. Dashboards' setup brief calls it when installed. |
| fabric-workspace (fabric-workspace-91) | The principle "agents first: the coding agent does the work, the interface shows the result" in `principles.md` or a page of its own, with the per-product table. RM-09 and RM-07 updated by their owner. |

## REQ table (frozen; adding is free, removing needs the operator)

| REQ | Requirement | Verified by |
|---|---|---|
| REQ-001 | A console started for an agent writes a context pack (`context.md`, `brief.md`, `mcp.json`, 0600, in userData, never in the folder) holding identity, descriptor without secrets, state and reasons, last errors and events, version and update, repo and folder | unit test on the pack builder; a test that no token value or token path content appears |
| REQ-002 | Claude Code starts with `--mcp-config` + `--append-system-prompt-file`; Codex with the `-c` MCP entry and a first prompt; Gemini with `-i`; any runtime with `FABRIC_DASHBOARDS_CONTEXT` | unit test of the argv per runtime; e2e-free |
| REQ-003 | A Switchboard in-place launch carries the same args after `--`, each ≤ 1024 chars, ≤ 16 args | unit test against `inPlaceArgv` |
| REQ-004 | MCP tool `service_context` returns the pack read now | MCP test |
| REQ-005 | *Fix with agent* on a problem opens the console with the pack plus a task naming the problem | unit test of the task text; renderer wiring test |
| REQ-006 | *Update with agent* when an update is available and there is no `update` command or it failed | unit test of the offer rule |
| REQ-007 | Pin an agent: a Pinned section above Services in pin order, persisted, survives restart and the agent's removal-and-return | settings + list tests |
| REQ-008 | Sort the rest by Name, Status or Recent activity, persisted | list-order unit tests |
| REQ-009 | First launch opens the console with a Setup session; one click starts the default runtime with the setup brief; no runtime installed → install commands | scenario + unit tests of the setup plan |
| REQ-010 | The setup brief orders MCP registration + proving call, skills, products with consent, first agent, service | unit test on the brief; ecosystem doc |
| REQ-011 | Second and later sessions: Overview leads with changes since the last visit, Fix/Update with agent, and Continue per agent; the last selected agent is restored | unit tests of the "since last visit" selection |
| REQ-012 | UX: scenarios, screens and copy (en + ru) for REQ-005..011 in `docs/ux/` | `docs/ux/lint.py`; i18n parity test |
| REQ-013 | The ecosystem setup map and the per-product parts are recorded (this brief) and published as the org principle | fabric-workspace PR merged |
| REQ-014 | Each product's owner session receives its part; the reply or the board id is recorded | message log in HANDOFF |
| REQ-015 | ADR-0020 records D-1..D-7 | ADR file |

## Modules

| Module | REQs | Order |
|---|---|---|
| M1 Context handoff (walking skeleton) | REQ-001, 002, 003, 004, 015 | first: everything else uses the pack |
| M2 Work handoffs | REQ-005, 006 | after M1 |
| M3 List: pin and sort | REQ-007, 008 | independent |
| M4 First and returning sessions | REQ-009, 010, 011, 012 | after M1 (Setup is a console) |
| M5 Ecosystem | REQ-013, 014 | as soon as the brief is committed, in parallel with M1 |

## Carry-over ledger

| # | Item | Home |
|---|---|---|
| C-1 | Codex's equivalent of an appended system prompt (`experimental_instructions_file`) is unverified on this machine; a first prompt is used instead | M1 test notes; revisit with Codex docs |
| C-2 | A console for an agent that lives on a server (remote placement) has no local folder; its context pack still applies, and the folder is the person's choice | M1 |
| C-3 | No brand pack for Dashboards (`docs/brand/` absent); copy follows i18n's established voice | backlog |
| C-4 | RM-09 and RM-07 status changes belong to their owners in the roadmap | M5 messages |

## Run state (2026-10-10, stopped at the usage limit)

- Done: this brief; FD-39 board row; M5 messages. Owners' board ids: Inbox B-79/B-80/B-81 (fabric-inbox #59), Switchboard SB-93/SB-94/SB-95 (fabric-switchboard #139; SB-94 asks for our exact argv shape: keep an option right after `--mcp-config`), Observatory OBS-54, adapter issue passioncode-ai/fabric-agent-adapter#49; replies pending from fabric-90 (pack format) and fabric-workspace-91 (principle PR).
- M1 started: `src/core/handoff.ts` (context, task, brief ≤ 1000 chars, mcp.json, per-runtime args) with `test/handoff.test.ts` 7/7 green.
- **Next task:** wire M1 into `src/electron/console.ts` — write the pack to `userData/consoles/<key>/` (0600), pass `handoffArgs` around `runtimeArgs` in `planStart` (Codex `-c` before `resume`), set `FABRIC_DASHBOARDS_CONTEXT`, add the MCP tool `service_context`, write ADR-0020; then M3, M2, M4. Run `npm run check` before any commit beyond this one.
