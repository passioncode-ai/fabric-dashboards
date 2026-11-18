---
report: fabric-dashboards-2026-11-18-agent-connect-audit
project: fabric-dashboards
date: 2026-11-18
asked: the operator, 2026-11-18, this repository's session, about the notification «На порту SMM Manager другая программа»: «научиться менеджить это грамотно и вообще разобраться, как у нас сейчас работает Connect к облачным агентам … агент может быть как с включенным кодинг-агентом, так и без него … провести аудиты и составить видение того, куда нам нужно прийти, и спеку»
base: origin/main 0b17c9a8 (0.8.198); the installed app and the live services of this Mac read at 12:00 to 12:05 UTC
architect: consulted 2026-11-18 (`audit.py consult`): template `agent-host` 1.0.11, variant `desktop-host`; its trap «never start a console in a folder the account service could not answer about» applies to finding A-3
---

# How the app connects to agents, and where it should go

## 1. The notification that started this

At 12:00 UTC the app showed «На порту SMM Manager другая программа: порт 8720 занят программой, которая не является
агентом Fabric (нет surfaces.events)». It is wrong about the program and right about a defect.

| Fact | Evidence |
|---|---|
| The listener on 8720 is SMM Manager itself | `lsof -iTCP:8720` → pid 2858 `python -m smm.service serve --port 8720`, child of pid 1411 (`use_secret.py run … -- python3 -m smm.service serve`), which is launchd's pid for `dev.sshlg.smm-manager.service` |
| Its well-known names it correctly | `GET /.well-known/fabric-service`: `protocol fabric-service/0.1`, `service.id smm-manager`, `instance default`, `process.pid 2858`, `status ready`, `degraded []`, build `d1ac69fc79e2` |
| It lacks a required surface | `surfaces` = `{health, mcp}`; the contract requires «at least `events`» (fabric-agent-contract `docs/specification/service.md`, well-known table) |
| The app calls any failed check «another program» | `checkWellKnown` (`packages/service-host/src/health.ts:149-158`) returns one reason string; `fetchWellKnown` turns it into `not-protocol` (`health.ts:206`); `deriveState` maps `not-protocol` to `foreign` / `reason.foreign.protocol` (`packages/service-host/src/state.ts:74-75`, remote: `:119-120`) |
| The consequence | the card reads `foreign`, the events feed is not read, and a `foreign` state opens an outage episode to the operator's Telegram after 15 minutes (`service.md`: «unavailable (`down`, `foreign` or `foreign-user`)»; FD-159) |

The contract defines `foreign` by identity: «A different answer [of `service.id` and `service.instance`] means another
program holds the port». A document with the agent's own identity and a missing member is not another program: it is
this agent, not following the contract. The app has no state for that, so it borrows the strongest one.

A scan of the 31 local descriptors with a loopback origin, with the same checks (12:03 UTC):

| Agent | Result |
|---|---|
| 28 agents | conforming |
| `smm-manager.default` | own identity, `surfaces.events` missing → misread as another program (A-1) |
| an organization copy of a video agent (port 8794) | the port is an SSH tunnel to the Studio's `passioncode` space port 8800, whose copy calls itself by the `default` instance → `foreign` (`reason.foreign.other`): the same product under another instance name (A-2) |
| a media agent | no answer within 3 s from the script; the app reads it `ready`, reached on the Studio through a tunnel |

## 2. How agents reach this app today

There is no «Connect» button. Four routes write a descriptor and a token into the services folder, and one more makes a
local descriptor mean «runs on another machine».

| Route | What it writes | Where it is | Gaps |
|---|---|---|---|
| A local installer (the agent's own `service install`) | local descriptor, token 0600, launchd job | each agent's repository | none for this audit |
| The adapter kit's `register-remote` | remote descriptor (`placement: remote`, `https` origin), token 0600, `source.repository` required | fabric-agent-adapter `building-fabric-services/references/remote-placement.md` | run by hand per agent |
| The registration link `fabric-dashboards://register?origin=…&invite=…` (FD-193, SCN-121) | one remote descriptor per host the showcase lists, token `showcase-<host>.token` | `src/core/register.ts`, `src/electron/register-flow.ts` | writes no `source.repository` (`register.ts:102-116`) and a string `installedBy`; skips hosts outside the showcase's parent domain (`agentHostAllowed`, `register.ts:50-56`), so an `*.sslip.io` agent of the organization's cloud is never registered this way (A-5) |
| Observatory's node from the estate record | descriptor with `installedBy {by: node}` | Observatory | the app shows who installed it (FD-161); it does not read the estate record itself (FD-52 open) |
| Observatory's placement record (`observatory-placement/1`) | nothing new: it marks a LOCAL descriptor as placed on another machine | `packages/service-host/src/placement.ts` | the agent answers through an SSH port forward on the same loopback port (FD-132, FD-179, FD-196) |

So the app knows three places an agent runs, under two words:

| Where it runs | Descriptor | Supervisor | How this app reaches it | Start/Stop here |
|---|---|---|---|---|
| this Mac | local | launchd here | loopback | yes |
| another machine of the estate (the Studio's spaces) | local + placement record | launchd there | an SSH tunnel to the same loopback port | refused (FD-132) |
| a cloud platform (Heroku, DigitalOcean, Cloudflare, sslip.io droplets) | remote | the platform | `https` with the token | refused (ADR-0011) |

Live on this Mac (12:10 UTC): 33 remote and 32 local descriptors, 9 of the local ones placed on the Studio
(`placement.json` `elsewhere` entries with a `serviceId`).

## 3. The coding agent (console) today

- One console per agent (ADR-0017), opened with one global toggle (`layout.console.open`, `src/core/types.ts:105`).
- Per agent the person keeps `runtime`, `folder`, `idle`, `bypass`, `isolated`, `where`, `machine`, `held`
  (`src/core/settings.ts:260-297`). There is no «this agent has no coding agent» setting; every agent page offers one.
- Where it runs:
  - a local agent: in its checkout here, through Switchboard when Switchboard holds an account (LC-20, FD-51);
  - an agent placed on another machine: `remoteArgv` (`src/core/remote-console.ts:117`) runs the runtime over `ssh -t`
    in the same folder there, **without that machine's Switchboard** (FD-199); `where: here` moves it to a checkout here
    (FD-205, `src/electron/console.ts:515-528`);
  - a New session on another machine goes through that machine's Switchboard (`switchboard launch --target`, FD-206);
  - a cloud agent: a checkout here found by `source.repository`, or a folder the person picks; a link-registered one has
    no repository, so it has nothing to open.
- The contract's `runner.credentialKind` (`runners.md`) says how the agent's own model calls are paid, not whether a
  person edits it with a coding agent: the two are separate questions.

## 4. Findings

| Id | Sev. | Finding | Evidence |
|---|---|---|---|
| A-1 | high | An agent with its own identity and an incomplete well-known reads as «another program», opens an outage message after 15 min, and (remote) is latched: the token is not sent again until the descriptor changes | §1; `state.ts:74,119`; `latch.ts:44` |
| A-2 | medium | An agent reached through a tunnel can answer under another instance name than its descriptor (its organization instance → `default`); the app says «another program» while it is the same product on the machine the placement record names | §1; the agent's project accepted it (reply `569340bc`: its Studio copy moves to the organization's instance name) |
| A-3 | high | The console of an agent placed on another machine starts the bare runtime over ssh, bypassing that machine's Switchboard: on 2026-11-18 10:10 UTC an organization's data-room agent placed on the Studio opened Claude Code's sign-in screen on the Studio | Switchboard's board request `51c3dcca`; `remote-console.ts:117`; architect trap above |
| A-4 | medium | No way to say an agent has no coding agent: cloud agents with no code here, showcases and platform products (Growth, Aptabase) all offer a console that has nowhere to open | §3; `settings.ts:260-297` |
| A-5 | medium | Link registration writes no `source.repository`, a string `installedBy`, and refuses `sslip.io` hosts outside the showcase's parent domain: no organization attribution beyond the instance-name and Workers rules, no console folder, no Rename | `register.ts:50-56,102-116`; FD-197 rules in `src/core/organizations.ts:180-198` |
| A-6 | low | Connecting is spread over four tools (installer, adapter CLI, link, Observatory node) with no single «Подключить агента» entry in the app or MCP; `org-instance/1` (the contract's statement of whose a remote instance is) is read nowhere | §2; `service.md` Instance facts |

## 5. Vision: where we go

1. **An agent is one name everywhere.** `id.instance` is the same on the machine it runs on, through every tunnel and in
   every descriptor. A copy that answers under another name is a defect of that copy, told as such («the copy on
   Studio calls itself by another instance»), never as «another program».
2. **Three diagnoses, never confused.** *Not ours* (another identity, another OS account): `foreign`, no token.
   *Ours, not following the contract* (own identity, a required member missing or invalid): `degraded`, the missing
   member named, the token kept, no outage message, one notice per build. *Ours, silent*: `down`.
3. **Where it runs is a fact, how it is reached is a route.** This Mac / a machine of the estate / a cloud platform;
   loopback / tunnel / https. The card says both («runs on Studio, reached through a tunnel»). Supervision follows
   where it runs: this app starts nothing it does not supervise.
4. **The workplace is optional and per agent.** An agent may have a coding agent (a workplace: its repository on the
   machine where it is edited, the account Switchboard gives that folder there) or none. Default: a workplace where a
   checkout exists here or on the machine it runs on; none for a cloud agent with no repository and for platform
   products. «None» hides the console toggle and says why. Every workplace on another machine goes through that machine's
   Switchboard; a folder Switchboard there does not know shows Switchboard's own sentence, never a sign-in screen.
5. **One «Подключить агента».** One entry (window and MCP) for every route: an invite link or code, an organization's
   instance list (`org-instance/1`), the estate record (Observatory's node), a local install. Each route ends in the same
   result: descriptor, token 0600, `source.repository`, `installedBy` object, organization, workplace default.

## 6. Spec: what we build, in order

| Row | What | Done when | Depends on |
|---|---|---|---|
| FD-327 | Own-identity, non-conforming well-known: `checkWellKnown` reports identity and conformance separately; a new probe result `nonconforming` (own `protocol`, `service.id`, `service.instance`; another member missing or invalid) becomes `degraded` with `reason.wellKnown.nonconforming {member}` locally and remotely; no latch, the token kept; feeds read only when their surface is declared; no outage episode; one notice per build «{name} does not follow the contract: {member}. Fix in its repository»; `test-vectors/state-precedence.json`, `packages/service-host` tests, en/ru strings, SCN-012 updated | SMM Manager reads `degraded` with the reason on the installed copy; vectors and `npm run check` green | none (contract text proposed to fabric-agent-contract in parallel) |
| FD-328 | A workplace on another machine goes through that machine's Switchboard: the agent's console there starts `switchboard launch --target <machine> --in-place --hosted` in its folder (FD-206's route); Switchboard's «folder belongs to no group» shown as the reason; the bare ssh runtime only where that machine has no Switchboard, with a line saying so | the data-room agent's console on the Studio starts signed in; a test for the argv and for the no-group answer | Switchboard `launch --target` (shipped, SB-332) |
| FD-329 | An answer under another instance through a tunnel (same `id`, the placement record names the machine) reads `foreign` with `reason.elsewhere.renamed {machine, answer}`: «the copy on {machine} calls itself {answer}; rename it there» | the video agent's organization copy shows the sentence until its project renames the copy, then `ready` | none |
| FD-330 | Workplace per agent: `consoles[key].workplace = auto \| none \| here \| there`; `auto` resolves as §5.4; `none` hides the console toggle with its reason; MCP `console_choose` takes `workplace` (parity); SCN-103 and a new scenario | a cloud agent without a repository shows no console toggle; the e2e of the console | FD-328 for `there` |
| FD-331 | One «Подключить агента» in the window and MCP: paste an invite link or code (FD-193's flow), with `source.repository` and the DEC-0061 `installedBy` object written, hosts the showcase's enroll proves accepted whatever their domain (sslip.io) | an organization's cloud agent at an sslip.io origin registers from the dialog; descriptor validated | FD-193; the showcase's enroll answer naming each host |
| FD-332 | Read `org-instance/1` and the estate record for a remote instance's organization and repository (contract IF-7) | remote rows of another organization carry it without the instance-name rule | contract statement published by the organizations' services; FD-52 |

FD-327 to FD-330 need nothing from anyone and go first, in that order: FD-327 removes the false alarm the operator saw,
FD-328 the sign-in screen Switchboard reported.

## 7. Asked of others (board)

| To | What | Message |
|---|---|---|
| smm-manager-agent | serve `GET /fabric/v1/events` and declare `surfaces.events` (and `surfaces.dashboard` with the login code if it has a page) | request `1094b815`, thread `a5f5aa87` |
| the video agent's project | its Studio copy answers under the organization's instance name | already accepted (reply `569340bc`) |
| fabric-switchboard | answered: FD-328 is this repository's row for its request | reply on `51c3dcca` |
| fabric-agent-contract | state that an own-identity answer missing a required member is not `foreign` (FAC-SEM-009 reads identity only) | to file with FD-327 |
