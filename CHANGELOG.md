# Changelog

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
