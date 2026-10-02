# Changelog

## 0.4.0 — 2026-10-02

- **Online services.** An agent or dashboard that runs online — an `https` origin on a platform —
  appears beside the local ones, under **Online**, read directly over verified TLS
  ([ADR-0011](docs/adr/0011-online-services.md); Fabric Agent Contract DEC-0019, `placement: "remote"`).
  The well-known document, events and the one-time login code are the same; the token goes only to
  the descriptor's own https origin; no redirect is followed; the dashboard opens signed in inside
  the app (SCN-030, SCN-031). A refused token, a certificate that does not verify, a redirect and a
  minute of silence are each `down` with their own reason (SCN-032); a token file that cannot be read
  is `invalid` and the service is never contacted. No start, stop, restart or update is offered for
  an online service — its platform supervises it.
- **MCP:** `list_services` carries `placement`; `control` refuses an online service; `activity` and
  the status read it with its token; `open?url=` accepts exactly a registered online origin.
- **`@passioncode-ai/fabric-service-host` 0.2.0:** placement-aware descriptors, https requests,
  `readToken`/`authHeaders` (moved from the app), `refused`, the remote state precedence and nine new
  shared vectors.
- Tests reach an online service through `FD_TEST_REMOTE`, honoured only in an unpackaged build.

## 0.3.4 — 2026-10-01

- **Fixed: a blank Dashboard tab.** Switching between two services whose dashboards were both open
  left the tab empty: the old dashboard's hide arrived after the new one's show and removed it. A
  hide now withdraws only the view its own dashboard asked for, and a page that finishes loading
  after a newer choice never covers it (`ViewSlot`, SCN-015; reproduced by a new end-to-end test,
  which fails without the fix).
- **Notifications only when it matters** ([ADR-0010](docs/adr/0010-notifications-only-when-it-matters.md)).
  A service event that asks to notify becomes a banner only when the agent needs a decision, failed,
  or warns — once per subject and cool-down (question 24 h, warning 12 h, failure 6 h), remembered
  across restarts; one warning from two instances of an agent is one banner. Deliveries, recoveries
  and plain notices go to Activity only. The banner names the agent and its instance, says what it
  wants in the subtitle, and opens the item on click.
- **Two instances read apart:** the sidebar, cards and banners name a non-default instance
  ("Example Agent · preview").
- **Less disk work:** a poll that brings no new event no longer rewrites the activity file (about
  1 MB, every 15 s per service); a failed write leaves no temporary file behind.

## 0.3.3 — 2026-10-01

- **Cold launch from MCP:** remove the MCP launcher’s `ELECTRON_RUN_AS_NODE` flag from the child that opens a dashboard. Previously macOS could accept a link while the closed app exited without a window. Existing-host routing, strict fallback and the MCP process environment are preserved.
- A process-boundary regression test reproduces the inherited flag before the fix and verifies its removal only in the dispatch child. [Release verification](docs/runs/2026-10-01-dashboard-links/README.md#cold-launch-correction--033).

## 0.3.2 — 2026-10-01

- **Dashboard routing:** MCP `host_status` checks the installed app, its version and the URL handler without opening a window. `open` targets that verified app; an installed-host failure returns an error instead of opening the dashboard in a browser.
- **Explicit fallback:** `fallback=never` prohibits browser opening. The default `if_absent` permits it only after confirmed app absence. Success means the OS accepted the request, not that the page has loaded.
- **Agent handoff:** MCP instructions identify `open_link` as the primary dashboard link. [SCN-028](docs/ux/scenarios.md) and [verification](docs/runs/2026-10-01-dashboard-links/README.md) cover host discovery, failure handling and repeated-link view reuse.

## 0.3.1 — 2026-10-01

- **Fixed: "not answering" no longer flaps under load.** A probe waits 5 s instead of 2 s. A
  service counts as not answering only after three probes in a row fail; a missed probe is
  re-checked after 5 s, and until then the last answer stands. The notification needs a probe
  that still fails after 60 s of silence (was 30 s), so a service that answers again before
  that sends neither "not answering" nor "is back". Activity still records each outage
  ([ADR-0008](docs/adr/0008-a-missed-probe-is-not-an-outage.md)).
- **License.** This is the first release under the GNU AGPL-3.0, with a commercial license
  from PassionCode.ai for use the AGPL does not cover (`AGPL-3.0-only OR
  LicenseRef-PassionCode-Commercial`, [ADR-0007](docs/adr/0007-agpl-or-commercial.md)).
  v0.2.0 and v0.3.0 stay PolyForm Noncommercial or Internal Use, and v0.1.0 stays MIT.

## 0.3.0 — 2026-09-30

- **Service links.** `fabric-dashboards://service/<id>.<instance>` opens that service in the app,
  and `?path=/…` one page of it — the link Fabric's "Open dashboard" opens. The MCP tools hand
  links out in this form; the 0.2.0 forms `open?service=…` and `open?url=…` still open. A
  malformed link, one that names a service not installed, carries extra parameters, a user,
  password or port, or points off the service's origin is refused with the reason
  ([ADR-0005](docs/adr/0005-service-links.md)).
- **MCP:** `open_link` is `null` for a descriptor that cannot be read, and an event whose link is
  not a path on the service gets no deep link instead of failing the whole `activity` call.
- **Shared with Fabric:** the code that reads services — descriptors, claim conflicts, launchd
  status, the health probe, the state precedence, one look at every service, the service link —
  is the workspace package `@passioncode-ai/fabric-service-host` (`packages/service-host`), with
  state-precedence test vectors every host runs. The app and its MCP server read through it;
  nothing a user sees changes ([ADR-0006](docs/adr/0006-shared-service-host-package.md)).
- **README:** a quick start a newcomer can follow — download, first run, `claude mcp add --scope
  user`, one tool call that proves the server answers.

## 0.2.0 - 2026-09-29

- **Links from agents open here.** `fabric-dashboards://open?service=<id.instance>&path=/…`
  (or `?url=http://127.0.0.1:<port>/…`) opens that page of an installed service inside the
  app, signed in, whether the app was running or not. A link to anything else is refused with
  the reason.
- **MCP server for agents.** `Contents/Resources/bin/fabric-dashboards-mcp` (stdio): list
  services with their state and links, open a page, start, stop or restart through launchd,
  run a service's doctor or update, read its recent activity. Tokens are never returned.
- **Fixed:** a notification clicked while the window was still loading could land on the
  overview instead of the item; the window now picks the waiting navigation up once it listens.

- **License.** From this release, Fabric Dashboards is source-available under
  `PolyForm-Noncommercial-1.0.0 OR LicenseRef-PolyForm-Internal-Use-1.0.0`, with a
  commercial license on request (contact@passioncode.ai). Release 0.1.0 and every earlier
  commit, and the later commits up to and including `7fb699d`, stay available under MIT.
  Contributions are accepted under [CLA.md](CLA.md).

## 0.1.0 - 2026-09-28

First release of Fabric Dashboards: one window for every local agent service on the Mac
that speaks `fabric-service/0.1`.

- Finds services from the descriptors in the services folder, live, with no setup.
- Shows each service's real state: ready, degraded, not answering, off, two copies,
  another program on its port, a port conflict or an invalid descriptor.
- Starts, stops and restarts services through launchd only; Stop stays off after a
  restart of the Mac.
- Opens each service's dashboard inside the app, signed in with a one-time code, one
  live view per service.
- Activity: every service's events and the app's own observations in one feed.
- Notifications for outages, recoveries, duplicates and events a service marks for
  you, with per-service settings, quiet hours and a one-hour pause.
- Menu bar status, open at login, English and Russian, dark and light themes.
- Updates itself from signed releases.
