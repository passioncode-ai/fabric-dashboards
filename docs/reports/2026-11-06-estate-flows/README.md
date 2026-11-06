---
report:
  id: fabric-dashboards/2026-11-06-estate-flows
  title: "Estate flows 2026-11-06: Fabric Dashboards' part of the cross-project reconciliation (S1-S10)"
  kind: audit
  project: fabric-dashboards
  domains: [placement, access, tokens, organization, deployment, continuity]
  as_of: 2026-11-06
  status: active
  valid_until: 2026-11-21
  summary: >-
    The coordinator asked every project on 2026-11-06 (board thread eefa7959) to bring its current step to a clean
    state and answer ten scenarios: where agents live, how the operator reaches them, people's access, tokens, shared
    infrastructure, links between machines, clouds, continuity, deployment and keys. This is Dashboards' answer, each
    claim with its file and line, what is missing, what disagrees and the questions for the operator.
---

# Estate flows: Fabric Dashboards' part

Clean state at the time of writing: `main` at `a259ce7`, released 0.8.28. One step was still in flight and is the
operator's own request of 2026-11-06 (the exception the coordinator allowed): FD-162 and FD-163, the organization
filter and the auditor's cross-organization finding, branch `feat/fd-162-orgs` at `3cf9e6d`, merged and released as
0.8.29 once its five-platform check is green. Draft PRs #352 and #355 (FD-159 macOS and Windows owner checks) wait for
the contract's ports-and-owners decision to be tagged; nothing else is started.

What Dashboards is in every scenario: the host on one macOS user (or one Windows or Linux account). It reads the
descriptors that user's agents wrote, says whether each is alive, starts, stops and restarts it through that user's
launchd, opens its dashboard and offers the same through its MCP server. It holds no keys of its own beyond the
descriptor tokens the agents wrote for their host, listens on no port and owns no launchd job (AGENTS.md, Lifecycle).

## S1. Where each agent lives

- **Does.** Shows every agent whose descriptor sits in this user's services folder: local ones (`127.0.0.1`) and
  online ones (`placement: remote`, read over HTTPS, `src/core/products.ts:84`). With Observatory's placement record
  it says which agents are placed on another machine and refuses to start a second copy there
  (`packages/service-host/src/placement.ts:66`, `src/core/control.ts:32`, FD-132); a copy running anyway reads
  `duplicate`.
- **Works.** Released in 0.8.15 and checked against Observatory's writer on 2026-11-03 (FD-132 row in
  `docs/backlog.md`).
- **Missing.** One view across machines and users does not exist: Dashboards on the laptop sees nothing of the
  organization's macOS user on the second Mac, and the organization's Dashboards there sees nothing of the laptop.
  An agent appears in another place only as an online descriptor (an HTTPS origin), never through the board or a
  relay. Whether the operator wants one view of every place, or one Dashboards per place, is a question below.
- **Bug seen.** Two descriptors still name no `source.repository` (the cross-agent audit of 2026-11-06), so their
  organization cannot be read and FD-162's filter lists them as not attributed.

## S2. How the operator reaches the agents

- **Does.** The window (each agent's dashboard inside the app, the agent console, the Connections map), the MCP server
  for any Claude Code session of the same user (`list_services`, `service_status`, `control`, `doctor`, `audit`,
  `connections`, `console_new`, `console_fix`), and outage alerts to the operator channel through the local service
  that offers `<id>.notify` (`src/core/outage-alerts.ts`, FD-48, FD-76).
- **Works.** All released; the MCP server survives app updates (FD-150, 0.8.21).
- **Missing.** Dashboards is a desktop app: it runs only in a logged-in GUI session. On a Mac with two macOS users it
  runs for the user on screen and, with fast user switching, for the other one too; a user nobody logged into has no
  Dashboards, no outage alerts and no MCP server. The organization's macOS user needs its own alert channel (its own
  notify service); without one its outage alerts stay on that Mac. No SSH or remote view is offered: reaching the
  second Mac is a screen session or SSH, outside Dashboards (FD-145 decision).

## S3. People's access

- **Does.** Nothing of its own. Whoever is logged into the macOS user sees and controls that user's agents; the
  separation between people is the separation between macOS users (FD-145, `docs/backlog.md`).
- **Missing, by design.** No roles, no read-only member, no per-agent permission. A limited member who must see only
  one project's agents gets a macOS or Linux account of their own with only those agents installed, and that
  account's own Dashboards. Revoking access is removing the account or the agent's descriptor.

## S4. Tokens and keys

- **Does.** Reads a descriptor's token in the main process only, as the host, for the well-known document, events,
  usage, load and sign-in (`SECURITY.md`, AGENTS.md "Local rules"). It sends a token to `127.0.0.1` only when this
  user's own process listens on the port (FD-156, FD-158; FD-159 on Linux), and treats a local 401 or 403 as
  `refused`, never `foreign` (FD-160, 0.8.28). A call across the machine boundary or for an outside person would use a
  delegation token, never a descriptor token (FD-44).
- **Missing.** Dashboards never issues, rotates or moves a token; that is each agent's and Observatory's work.
- **Found, 2026-11-06 audit.** Seven descriptors at mode 0644 (six fixed by their owners the same day, one
  left), one token file in another product's folder (fixed). The audit thread `5d2a61f1` holds the evidence.

## S5. Shared infrastructure of a project

- **Does.** A console session in an agent's folder starts through the account switcher in managed mode when it holds
  an account for the provider, so the folder's group and organization pick the account (LC-20, FD-51). The estate
  updater can update the skills family in the background behind a switch (FD-30).
- **Disagrees.** The skills family plans its own scheduled updater on every host (its backlog row B-323, board thread
  `f7758225`). Two updaters of the same family on one Mac would race; the family's lock makes the second one wait
  (`src/electron/estate-updater.ts:351`), so nothing breaks, but one of them is redundant. Proposal: when the family's
  own job is installed, Dashboards' switch shows it and stops running the update itself.

## S6. Links between places and machines

- **Does.** The ports-and-owners rule: a token goes only to this user's own listener (FD-156, FD-158), an owner that
  cannot be told is a refusal on Linux (FD-159, 0.8.27); macOS and Windows parts are written (PRs #352, #355) and wait
  for the decision's tag (target 2026-11-07).
- **Missing.** The host label of that decision is not shown yet; it lands with #352. Dashboards takes no part in the
  organization relay or registration: those are the hub's and the organization service's.

## S7. Clouds and commerce

Not a participant. Dashboards shows an organization's cloud agents as online descriptors and their spend from their
usage reports (ADR-0013); it takes no orders and holds no licence keys.

## S8. Moving and continuity

- **Does.** The RUNBOOK section *Moving to another Mac or another macOS user* (FD-157, 0.8.25) names every piece:
  settings copied or fresh, agent names read back from their repositories, the MCP entry and login item made by the
  first launch, dashboard sign-ins asked once (the cookie key is this Mac's Keychain item), descriptors and tokens the
  agents' own, no port to move. A damaged `settings.json` is restored from its `.bak` (ADR-0015).
- **Missing.** Settings and the activity history are not backed up off the Mac; a lost laptop loses the layout and
  the history (nothing an agent needs). After a reboot with FileVault, Dashboards starts at the user's login (login
  item on by default, LC-07), not before.

## S9. Deploying from scratch and again

- **Steps today.** Install the release (DMG into `/Applications`, or `~/Applications` on a Mac shared by several
  users; Windows installer; Linux AppImage or `.deb`); first launch registers the MCP entry and the login item for
  that user; the agents appear as soon as their descriptors exist. Running it again changes nothing (each launch
  repairs a stale MCP entry, LC-14). About two minutes; the person approves the login item once if macOS holds it.
- **As code.** The installer is the release; the MCP entry and login item are written by the app itself. No manual
  file edits.
- **Missing.** No unattended install command of its own; the platform's launcher is expected to install apps. Every
  dashboard asks for its sign-in code once on a new Mac (by design, S8).

## S10. Keys in the secret store

Dashboards stores no provider key and has no slot in the secret store (its Observatory record lists none). Its
release secrets (signing certificate and password, notarization key, Windows signing, the analytics App Key) live in
the repository's GitHub secrets and are used only by the release workflow. Whether the organization's secret store
should hold a copy of those is the organization's decision, not this repository's.

## Isolation between organizations (board thread `22876238`)

- **Done in 0.8.29.** Each agent's organization is read from Observatory's registry; the list filters by one or
  several organizations; the auditor reports a connection from one organization's agent to another's as an error on
  the caller (FD-162, FD-163). An agent whose organization is unknown is never guessed.
- **Open question.** Dashboards itself is a host, not an agent, but on a user that holds agents of two organizations
  it reads both sides' descriptor tokens, and its MCP server offers control of both to any session of that user. The
  filter is a view, not isolation. The isolation holds when each organization's agents live under that
  organization's own macOS user with its own Dashboards (the target layout of the move). Until the move, the laptop's
  user still holds agents of both sides.

## Questions for the operator

1. One Dashboards per place (each macOS user and each machine sees only its own agents), or one view of every place
   from the laptop? The second needs a read path across machines that does not exist yet (the hub or the relay).
2. Until the organization's agents move to their own macOS user: should Dashboards on the laptop refuse to control
   (start, stop, restart, console) an organization's agent from a personal session, or is the view filter enough?
3. Skills updates: keep the family's own scheduled job (B-323) and retire Dashboards' switch, or the other way?
</content>
</invoke>
