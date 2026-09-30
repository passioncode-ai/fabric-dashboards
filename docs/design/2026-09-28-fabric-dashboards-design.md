# Fabric Dashboards — design, 2026-09-28

Status: **proposed**, awaiting operator approval (task-pipeline stage 2 gate).
Entry: [brief](../evidence/briefs/2026-09-28-brief.md) · decisions: [ADR index](../adr/)

This document designs four things that ship together:

1. **`fabric-service/0.1`** — the protocol every local agent service speaks: how it is
   found, how it says it is alive, how it is started, stopped and restarted, how it
   authenticates, where it keeps state, how it reports what it did.
2. **The Fabric skill set** — the rules an agent author follows so a new agent is
   conformant from its first commit.
3. **Fabric Dashboards** — the desktop app that finds every conformant service on the
   Mac, shows its state and its latest work, controls it, and opens its dashboard in
   the app instead of a browser tab.
4. **The PassionCode.ai launcher** — one self-updating npm package that installs every
   PassionCode.ai skill into every agent on the machine.

Every design choice below names the observation it answers. Observations come from the
2026-09-28 harvest of the local agent services on the operator's Mac; the per-service
receipts are kept privately by the operator.

---

## 1. What the harvest found

| # | Observation (2026-09-28) | Consequence for the design |
|---|---|---|
| O1 | Six live services, six different health contracts: one answers `/healthz` → `{"ok":true}`, three answer `/health` in three different shapes; none carries a build commit or start time | one well-known document, fixed shape, carrying build identity |
| O2 | Three of four services have no single-instance guarantee — only the OS refusing a second `bind`. In one, the startup hook runs **before** the bind, so a second copy re-queues the first copy's running jobs | the lock is taken before any side effect; the bind is not a lock |
| O3 | Two services default to ports that other live services hold | a machine-wide port claim, checked at install |
| O4 | Nothing is discoverable: observatory's `fabric-agent.json` declares MCP only — no port, no dashboard. The Fabric Agent Contract has no notion of a local service | a descriptor file per installed service, in one directory, plus a contract extension |
| O5 | One service keeps data and logs inside the repository; deleting the checkout leaves a plist launchd retries every 10 s | state lives in per-user OS directories, code in releases |
| O6 | Every dashboard authenticates differently: header checks only (one service), token file + one-time code → cookie (two others), Host + `Sec-Fetch` (observatory) | one token file + one-time login code; the token never reaches a browser |
| O7 | Every service already keeps an event log, in six shapes: a SQL `events` table, per-job JSONL files, a second `events` table, a journal, an execution-events table, an audit log | one cursor-paged events endpoint; the cross-agent activity feed is its union |
| O8 | One service's remote MCP chain had been dead for two days — a stopped gateway container, a lost tunnel route, an expired bridge token — and nothing watched any of the three | the host watches every declared surface, not only the process |
| O9 | A stray `python -m http.server` bound to **all interfaces** served a source tree to the LAN, orphaned for a day | loopback-only is normative; the host lists listeners it cannot attribute |
| O10 | launchd is the supervisor everywhere, with drift: `KeepAlive` true vs `{SuccessfulExit:false}`, a plist pinning a worktree venv, hand-made `.plist.bak-*` files left in `~/Library/LaunchAgents` | one plist shape, generated, linted; the host is not a second supervisor |
| O11 | Dashboards refresh by polling (5 s … 5 min); none shows that the server came back; one pauses polling while the operator types — good | the host owns liveness; embedded dashboards keep their own refresh |
| O12 | Only one skill package is released in sync (tag = npm = plugin = marketplace). Others install as symlinks into working trees or update on their own clock, and one npm installer writes plain copies that shadow its own plugin | one launcher, one manifest, one update clock |

---

## 2. `fabric-service/0.1` — the protocol

Normative home: `fabric-agent-contract/docs/specification/service.md` and
`schemas/service-*.schema.json` (module M1). What follows is the design; the contract
text will use MUST/SHOULD wording.

It is an **extension** of Fabric Agent Contract `0.1.0`, keyed by the absolute URI
`https://fabric.passioncode.ai/agent-contract/extensions/service/0.1` (corrected 2026-09-30, contract gap G-08: the spelling first written here, `passioncode.ai/fabric/extensions/service/0.1`, was never the schema's key) (the contract's extension rule,
`docs/specification/overview.md` → *Extension rule*). A service that also exposes
capabilities points its `fabric-agent.json` at its descriptor through that key; a
service with no capabilities (a board) needs only the descriptor.

**Discovery grants nothing.** As in the contract (`registry.md` → *Discovery*), being
listed gives no project access. The host displays and controls a service for the
operator who installed it; it never binds it to a Project.

### 2.1 The five parts

```
 installer ──writes──▶  descriptor  (static: who I am, where I live, how I am managed)
                            │
 host ──reads──▶  descriptor ──▶ GET /.well-known/fabric-service   (live: am I up, which build)
                            ├──▶ GET  /fabric/v1/events           (what I did)
                            ├──▶ POST /fabric/v1/login-code       (let the operator in)
                            └──▶ launchctl (start / stop / restart) (never the service itself)
```

### 2.2 The descriptor — how a service is found

One JSON file per installed service instance:

| OS | Directory |
|---|---|
| macOS | `~/Library/Application Support/ai.passioncode.fabric/services/` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/passioncode-fabric/services/` |
| any | overridden by `FABRIC_SERVICES_DIR` (tests, sandboxes) |

File name `<id>.<instance>.json`. Written by the service's **installer**, atomically
(temp + fsync + rename), mode 0600; removed by its uninstaller. The service process
never writes it — a descriptor describes an installation, not a run.

```json
{
  "protocol": "fabric-service/0.1",
  "id": "example-agent",
  "instance": "default",
  "name": "Example Agent",
  "summary": "Ships apps through App Store, Google Play and Meta Horizon Store.",
  "origin": "http://127.0.0.1:47195",
  "auth": { "tokenFile": "~/.config/example-agent/service.token", "header": "Authorization", "scheme": "Bearer" },
  "lifecycle": {
    "manager": "launchd",
    "label": "com.example.example-agent",
    "plist": "~/Library/LaunchAgents/com.example.example-agent.plist"
  },
  "paths": {
    "data": "~/Library/Application Support/example-agent",
    "logs": ["~/Library/Application Support/example-agent/logs/service.log"]
  },
  "commands": {
    "doctor": ["~/.local/share/example-agent/current/bin/example-agent", "doctor", "--json"],
    "update": ["~/.local/share/example-agent/current/bin/example-agent", "self-update", "--json"]
  },
  "source": { "repository": "https://github.com/example/example-agent" },
  "fabricManifest": "~/Code/example-agent/fabric-agent.json",
  "installedAt": "2026-09-28T18:00:00Z",
  "installedBy": "example-agent service install 0.2.0"
}
```

Rules:

- `id` matches `^[a-z][a-z0-9-]{1,62}$`; `instance` defaults to `default`. The pair is
  unique on the machine. A preview copy is a second **instance**, never a second id
  (a preview copy on its own port is `example-agent.preview`).
- `origin` is `http://127.0.0.1:<port>`. **The port is a claim**: an installer MUST read
  every descriptor in the directory and refuse a port another descriptor holds (O3).
- `auth.header`/`scheme` default to `Authorization`/`Bearer`; a legacy header
  (`X-Example-Token`) is allowed so existing clients keep working.
- Paths may start with `~/`. Commands are **argv arrays**, never shell strings (the
  contract's local-runner rule, `profiles.md` → *Local runner*). Only `doctor` and
  `update` are defined; the host runs nothing else.
- Unknown fields are preserved and ignored.

### 2.3 The well-known document — how a service says it is alive

`GET /.well-known/fabric-service` — **no auth**, Host/Origin checks still apply,
answered in under 100 ms from memory (observatory's 14 KB recomputed health is the
counter-example, O1).

```json
{
  "protocol": "fabric-service/0.1",
  "service": { "id": "example-agent", "instance": "default", "name": "Example Agent",
               "version": "0.2.0", "build": { "commit": "8b80be9", "dirty": false, "builtAt": "2026-09-28T17:40:00Z" } },
  "process": { "pid": 58090, "startedAt": "2026-09-28T17:41:02Z" },
  "status": "ready",
  "degraded": [ { "source": "llm", "reason": "No model key: localisation is paused." } ],
  "summary": [ { "label": "Jobs running", "value": 2 }, { "label": "Awaiting you", "value": 1, "attention": true } ],
  "surfaces": {
    "dashboard": { "path": "/dashboard" },
    "mcp": { "path": "/mcp", "transport": "streamable-http" },
    "events": { "path": "/fabric/v1/events" }
  },
  "update": { "available": null }
}
```

- `status` ∈ `starting | ready | degraded | stopping`. A process that cannot serve
  does not answer; the host derives `down`. `degraded` is always present — an empty
  list asserts full health, a missing field is a defect (observatory's rule, kept).
- `service.id`/`instance` must equal the descriptor's: a different answer means
  *someone else is on this port* (the check one service already did by hand).
- `process.pid` lets the host compare with launchd's pid: a mismatch is a **duplicate**
  (a copy started by hand while launchd's copy crash-loops on the port, O2).
- `summary` is at most six tiles for the host's card; `attention: true` makes a tile
  count toward the host's badge.
- `update.available` is a version string when the service knows a newer release exists;
  the host shows it and offers the descriptor's `update` command.

### 2.4 The events feed — what a service did

`GET /fabric/v1/events?after=<cursor>&limit=<n≤200>` — auth required.

```json
{
  "events": [
    { "id": "4213", "at": "2026-09-28T17:55:10Z", "kind": "job.awaiting_choice", "level": "notice",
      "text": "The Q3 report draft is ready for your approval (12 sections, 3 languages).",
      "subject": { "type": "report", "id": "q3", "label": "Q3 report" },
      "link": "/dashboard#/approvals/77", "notify": true }
  ],
  "cursor": "4213"
}
```

- `id` is opaque and increases within one service; `cursor` is the last id returned.
  No `after` returns the newest `limit` events. Retention: at least 7 days or 1000
  events, whichever is more.
- `level` ∈ `info | notice | warning | error`. `text` is one sentence a person reads
  (one existing service's `line` field is the model, O7) — never a machine id.
- `notify: true` asks the host to raise an OS notification; `link` is a dashboard path
  the notification and the feed open. The service decides what is notification-worthy;
  the host decides whether the operator wants it.
- Every existing log maps onto this without a new store: it is a **view** over the
  table or JSONL the service already writes (O7).

Optional: `GET /fabric/v1/events/stream` (SSE, same records). The host uses it when
declared and falls back to polling.

### 2.5 Operator login — the token never reaches a browser

`POST /fabric/v1/login-code` with the service token → `{ "url": "/fabric/v1/login?code=…", "expiresAt": "…" }`.
The code is single-use, lives at most 120 s, and is persisted as used before it is
honoured (the replay rule one service already had, O6). `GET /fabric/v1/login?code=` sets an
HttpOnly, `SameSite=Strict` cookie and redirects to `surfaces.dashboard.path`.

The host reads the token file in its main process, asks for a code, and navigates the
embedded view to the URL. The token never enters a renderer, a URL or a log. A service
whose dashboard is intentionally open to local reads declares no
`login` and the host opens the dashboard path directly.

### 2.6 Lifecycle rules — always alive, one copy, survives reinstall

| Rule | Why (observation) |
|---|---|
| Bind `127.0.0.1` only; accept `Host` only for `127.0.0.1:<port>`, `localhost:<port>`, `[::1]:<port>`; reject a foreign `Origin` and `Sec-Fetch-Site: cross-site` | O9; DNS rebinding |
| Take an exclusive `flock` on `<data>/service.lock` **before any side effect** (job resume, scheduler, migrations); if held, print one sentence naming the holder pid and exit 75 | O2 |
| Supervisor is launchd: `RunAtLoad true`, `KeepAlive true`, `ThrottleInterval 10`, `ExitTimeOut` above the drain time, `ProcessType Background`; no secrets in the plist; `PATH` filtered; plist `plutil -lint`ed before `bootstrap` | O10 |
| Install = write plist → `bootout` (wait until unloaded) → `bootstrap` (retry EIO 5) → poll the well-known until `service.id` matches, 40 s budget | two services each rediscovered this race |
| `SIGTERM` drains in-flight work, then exits; interrupted work resumes on the next start | one existing service's lifespan drain |
| Code runs from an immutable release directory (`releases/<version>-<sha12>/`); the plist points at the release, an upgrade rewrites the plist and restarts | one existing service's release layout; retro lesson "ran on stale code" |
| State: data + config in `~/Library/Application Support/<id>/`, logs in `~/Library/Logs/<id>/`, cache in `~/Library/Caches/<id>/`; never inside a repository or a release; writes atomic; logs rotate | O5 |
| Uninstall = `bootout`, delete plist, delete descriptor; **data stays** unless `--purge` | every service today |

**Off is a real state.** "Stop" in the host means `launchctl bootout` **and**
`launchctl disable` — the service stays off across logins until "Start" runs
`enable` + `bootstrap`. "Restart" is `launchctl kickstart -k`. The host never spawns a
service process itself: a second supervisor is how a machine ends up with twenty copies
of one server (twenty copies of one MCP server were once measured on this machine).

### 2.7 Communication surfaces — which protocol for what

| Caller | Surface | Rule |
|---|---|---|
| Another agent (Claude Code, Codex) on the same Mac | **MCP, streamable HTTP at `/mcp`** on the service origin, token in a header | one process for every session; stdio per session is what produced 20 stray servers (example-agent ADR-0001) |
| The operator, a script, CI | **CLI** `<tool> service status\|start\|stop\|restart`, `<tool> dashboard`, `<tool> doctor --json` — each delegates to launchd and the well-known, never to its own process table | one supervisor |
| A remote agent | **A2A 1.0** over HTTPS, or MCP behind an authenticated gateway | loopback is not a network boundary (Fabric ADR-0081) |
| The dashboard page | same-origin REST under `/api`, cookie + CSRF header | existing pattern in all four services |

Registration into a client's config (`~/.claude.json`) is done by the service's own
`mcp-register` command, atomically, header not query string (a token in a query
string once reached a session transcript through a logged URL).

---

## 3. Fabric Dashboards — the app

Product name **Fabric Dashboards**, short form **Dashboards**. Not "Boards": in Fabric
"the Board" is the operator's decision queue (Fabric ADR-0035). Not a Role workspace:
it monitors services on one Mac, it does not assemble a person's work surface.

It is a separate product of the PassionCode.ai toolkit (Fabric ADR-0070), **not** a
kernel feature: the kernel has no always-on process (Fabric ADR-0037, ADR-0052), and
neither does Dashboards — every service keeps its own launchd job; closing Dashboards
stops nothing.

### 3.1 Shell — built the way Fabric Inbox is built

Electron 44, one main process, sandboxed renderers, `contextIsolation`, strict CSP,
single-instance lock, `@electron/packager` + `@electron/osx-sign`, universal binary,
Developer ID + hardened runtime + notarization + DMG receipt — the `fabric-inbox/desktop`
pipeline (`dist-mac.mjs`). Brand: PassionCode.ai design system `tokens.css` and a new
`dashboards-mark.svg`, vendored byte-for-byte from `passioncode-ai.github.io`, pinned by
commit and SHA-256 in `docs/brand-source.json`, drift rejected by a test.

Differences from Inbox, each because Inbox has no such need: the UI is a **local
bundle** (Vite + React 19 + TypeScript) — Dashboards has no server; a **menu-bar tray**;
a **login item**; **native notifications**; **auto-update** (§3.6).

### 3.2 Screens

```
┌ Fabric Dashboards ───────────────────────────────────────────────────────┐
│ ● Overview      │  Overview                               7 services  ⟳ │
│ ≋ Activity   12 │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ ─────────────── │ │● Store Agent │ │● Asset Maker │ │▲ Plan Board  │     │
│ ● Store Agent   │ │ Ready 0.2.0  │ │ Ready 0.2.0  │ │ Degraded     │     │
│ ● Asset Maker   │ │ Jobs 2 · ⚑1  │ │ Jobs 3       │ │ collector    │     │
│ ▲ Plan Board    │ │ "Q3 listing  │ │ "Crate model │ │ stale 2 days │     │
│ ● Observatory   │ │  ready…" 2m  │ │  delivered"  │ │              │     │
│ ○ Writer   off  │ └──────────────┘ └──────────────┘ └──────────────┘     │
│ ✕ Runner   down │                                                        │
│ ─────────────── │  Needs attention                                       │
│ ⚙ Settings      │  ✕ Runner is down since 17:02   — Restart · Logs       │
└─────────────────┴────────────────────────────────────────────────────────┘
```

- **Overview** — one card per service: status, version, uptime, summary tiles, the
  latest event sentence; a *Needs attention* list on top (down, duplicate, degraded,
  awaiting-you tiles, update available).
- **Activity** — the merged feed of every service's events, newest first, filterable
  by service and level; each row opens the service's dashboard at the event's `link`.
  Unread count in the sidebar.
- **Service view** — header with status, version + commit, pid, uptime, port and the
  controls *Restart · Stop/Start · Doctor · Update · Logs · Show data folder*; the
  service's own dashboard embedded below; tabs *Dashboard · Activity · Health · Logs*.
- **Settings** — launch at login, notifications per service and level, quiet hours,
  update channel, the services folder, and *Unattributed listeners* (O9).
- **Tray** — aggregate status glyph (all ready / something degraded / something down),
  the list of services, *Open Dashboards*, *Pause notifications for 1 h*.

Text follows the brand pack (`copywriting` track, stage 3); layout and motion follow
`sheleg-design`'s calm product-UI pack with the PassionCode.ai tokens.

### 3.3 Service states

Derived by the host from descriptor + launchd + well-known, in this precedence:

| State | Condition | Shown as |
|---|---|---|
| `invalid` | descriptor fails its schema | ✕ with the schema error |
| `stopped` | launchd job disabled or not loaded, by the operator | ○ Off, *Start* |
| `conflict` | another descriptor claims the same port | ✕ naming both |
| `foreign` | well-known answers with another `service.id`/`instance` | ✕ "another program answers on :port" |
| `duplicate` | well-known pid ≠ launchd pid | ▲ "two copies", *Restart* |
| `down` | loaded but no answer for > 15 s | ✕ since HH:MM, *Restart · Logs* |
| `starting` / `stopping` | as reported, or during a host action | ◌ |
| `degraded` | `status: degraded` or non-empty `degraded` | ▲ with the reasons |
| `ready` | otherwise | ● |

Probe cadence: every 5 s while the window is visible, every 30 s in the background,
exponential back-off to 60 s for `down`. A state change is an **app event** in the
activity feed ("Example Agent stopped answering at 17:02", "…is back after 40 s").

### 3.4 Embedded dashboards — one view per service, never a copy

Each service gets one `WebContentsView`, created on first open and kept alive while the
app runs; switching services swaps views, it never reloads or duplicates them. Each view
has its own session partition (`persist:svc-<id>-<instance>`), navigation is confined
to the service origin, `window.open` goes to the default browser after a confirmation
(Inbox's `policy.cjs` rule), permission requests are denied. A view that crashes is
recreated once and then shows *Reload*. (`iframe` is not an option: a service may
send `X-Frame-Options: DENY`.)

### 3.5 Control

Main process only, `execFile` without a shell, target `gui/<uid>/<label>`:

| Action | Commands | Done when |
|---|---|---|
| Start | `launchctl enable`, then `bootstrap <plist>` | well-known `ready`/`degraded` with matching id, ≤ 40 s |
| Stop | `launchctl bootout`, then `disable` | no answer and job not loaded, ≤ 40 s |
| Restart | `launchctl kickstart -k` | new `process.pid`, matching id, ≤ 40 s |
| Doctor / Update | descriptor argv, 120 s timeout, stdout parsed as JSON when possible | exit code + output shown verbatim |

Each action writes an app event with the outcome sentence; a timeout says so and offers
*Logs* — never a silent spinner.

### 3.6 Notifications and updates

- **Notifications** (Electron `Notification`): a service went `down` for > 30 s, came
  back, became `duplicate` or `foreign`; a service event with `notify: true`; an update
  is available. Clicking opens the service view at the link. Debounced per service,
  respecting quiet hours and per-service settings.
- **App auto-update**: Squirrel.Mac through Electron's `autoUpdater` with a JSON feed
  published as a release asset of `passioncode-ai/fabric-dashboards`; the zip is the
  signed, notarized app. Checked at start and every 6 h; installed on the next quit or
  on *Restart to update*. No family product has an updater yet — this becomes the
  family pattern and is recorded as an ADR.

### 3.7 Security

The app runs as the operator and reads token files the operator owns — the same trust
boundary the services already state. Tokens stay in the
main process. The renderer gets state through a typed `contextBridge` API with no
file-system or process access. The app listens on no port.

---

## 4. The Fabric skill set

Home: the `fabric-agent-adapter` plugin — one skill set for the whole family, next to
`creating-fabric-agents` and `adapting-projects-to-fabric`.

| Skill | Status | Covers |
|---|---|---|
| `creating-fabric-agents` | exists (0.3.1) | intake grill, knowledge pack, provider bundle — **gains a step**: an agent that runs as a service is built with `building-fabric-services` |
| `adapting-projects-to-fabric` | exists | provider bundle for an existing project |
| **`building-fabric-services`** | new | the rules of §2: communication surface choice (MCP / CLI / A2A), auth (token file, login code, CSRF), state and cache directories, single instance, launchd, release layout, dashboard principles (loopback, calm refresh, `degraded` everywhere, no inline script), events feed, notifications, updates. Ships a **reference kit** (stdlib Python module + Node module implementing lock, well-known, events view, login code, descriptor install) and **`check_service.py`** — a live conformance probe that prints `PASS/FAIL/NOT_RUN` per rule against a running service |

The adapter's own installer bug (O12: it copies skills into `~/.claude/skills`, shadowing
its plugin) is fixed in the same release.

---

## 5. The PassionCode.ai launcher

One npm package, `passioncode` (name free on 2026-09-28: `npm view` → 404), modelled on
`sshlg-skills`: a manifest of members, `claude plugin marketplace add|update` +
`plugin install|update` for Claude Code, the `~/.agents/skills` hub with symlinks for
every other agent, a quarantine-and-prune of shadowing plain copies, a SessionStart
version check with a 24 h cache, an idle-time `npx passioncode@latest update`, and one
update clock for the family (per-marketplace `autoUpdate` turned off).

Members: `fabric-agent-adapter` (3 skills after M2) and `observatory-log` (3 skills +
hooks), plus the launcher's own update hook. **Only PassionCode.ai products are members**:
an agent someone builds for themselves stays out, even when it implements a Fabric
protocol and appears in Fabric Dashboards (operator, 2026-09-29). The launcher shape is
decision D-3 in the brief.

---

## 6. Modules and order

A walking skeleton first: the thinnest line that crosses every seam — one real service
found, probed, shown and restarted — then widening.

| Module | Repo | Delivers | Depends on |
|---|---|---|---|
| M1 Protocol | `fabric-agent-contract` | `service.md`, 3 schemas (descriptor, well-known, events page), fixtures, validator tests | — |
| M2 Skill + kit | `fabric-agent-adapter` | `building-fabric-services`, reference kit, `check_service.py`, installer fix, evals | M1 |
| M3 Skeleton | `fabric-dashboards` + one of the operator's own services | a pilot service migrated + app: discovery, states, control, one embedded view | M1, M2 |
| M4 App complete | `fabric-dashboards` | activity feed, notifications, tray, login item, settings, auto-update, signing, DMG | M3 |
| M5 Migrations | Project Observatory; the operator's own services in their own private repositories | descriptor, well-known, lock-before-side-effects, events view, login code — each on its own branch | M2 |
| M6 Port and gap fixes | the operator's own services (private) | port claims off ports other services hold | M2 |
| M7 Launcher | `passioncode` (new) | manifest, install/update/prune, self-update, release | M2, D-3, D-4 |
| M8 Release | all | tags, npm, marketplace, GitHub release of the app, local installs updated | all |

The per-module stages 3→10 run in this order. Each module ends pushed on its own branch
with a PR; nothing merges without its repository's policy.
