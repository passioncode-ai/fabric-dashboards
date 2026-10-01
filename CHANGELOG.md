# Changelog

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
