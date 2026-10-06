# Security

Report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/passioncode-ai/fabric-dashboards/security/advisories/new)
for this repository, or by email to contact@passioncode.ai.
Do not open a public issue containing tokens, descriptor contents from your machine, or
service data.

## What the app touches

- **Reads** the services folder (`~/Library/Application Support/ai.passioncode.fabric/services/`
  or `FABRIC_SERVICES_DIR`) and, for each service, the token file its descriptor names. A token
  file that is a symlink, belongs to another user or grants any permission to group or others (wider than 0600) is refused. Tokens
  are read in the main process only; they never reach a page, a URL or a log.
- **Talks** to the origins descriptors declare, and to no other service address: `127.0.0.1:<port>`
  for a local service, and the `https://` origin of a registered online service (`placement:
  "remote"`, [ADR-0011](docs/adr/0011-online-services.md)). Requests there are the health probe,
  the events feed, the usage report and the one-time login code; embedded dashboards load only
  from those origins. A token goes only to its own service's origin, in a request header. An
  online origin is reached over https with the certificate verified against the system store,
  and no redirect is followed. An answer from another program carries none of its document
  into the app: an online origin that answered as another service gets no token again until
  its descriptor changes; one that answered without the protocol is checked again without the
  token until it asks for one (HTTP 401) or answers as the service — in the app and in the MCP
  server alike (`RemoteTokenLatch`). A usage report, an events feed or a dashboard sign-in is
  never read from a port or origin that answers as something else, and a sign-in reads the
  service's state at that moment, not when its page was first opened.
- **Fetches** the update feed
  (`https://github.com/passioncode-ai/fabric-dashboards/releases/latest/download/update-feed.json`,
  or `FABRIC_DASHBOARDS_UPDATE_URL`) 10 s after start and every 6 hours, only in a packaged copy
  inside Applications. It reads the feed's version first and downloads the signed release
  (Squirrel.Mac) only when that version is newer than the running one. Nothing about services
  or tokens is sent.
- **Runs** `launchctl` on the labels descriptors declare, `lsof -nP -iTCP -sTCP:LISTEN` for the
  listener scan, and the `doctor` and `update` argument arrays a descriptor declares — no shell,
  in their own process group, 120 s limit; whatever a finished command leaves running in that
  group is ended. Uninstall starts one detached `/bin/sh` that waits for the app to exit (at most
  30 s) and removes the app's data.
- **Writes** its own data under `~/Library/Application Support/Fabric Dashboards/`
  (settings, activity) and logs under `~/Library/Logs/Fabric Dashboards/`. Uninstall removes the
  `fabric-dashboards` entry from Claude Code's `~/.claude.json`, and a later launch puts it back
  or points it at the installed copy; nothing else in that file is changed.
- **Runs** the agent console's runtime (ADR-0017) only when the person presses New session or
  Continue last: the runtime's own CLI found on the login shell's `PATH`, in the folder shown, with
  `ELECTRON_RUN_AS_NODE` and `NODE_OPTIONS` removed. A folder bound to a Fabric Switchboard project
  is started by `switchboard launch` itself, so no token passes through the app. The console is the
  person's own terminal: the runtime has whatever their runtime settings allow. Reading which
  account a folder uses runs `switchboard --json project show` and `accounts list` (no credentials
  are printed by either).
- **Allows inline styles** in its window (`style-src 'self' 'unsafe-inline'`), because the
  terminal view (xterm.js) injects `<style>` elements and takes no nonce. Scripts stay `'self'`,
  and `connect-src 'none'` and `img-src 'self' data:` mean injected CSS cannot send anything out.
- **Listens** on no port. The MCP server (`Contents/Resources/bin/fabric-dashboards-mcp`)
  is started by an agent and speaks only over its stdin and stdout; it reads the same
  folder and token files, talks to the same origins and runs the same `launchctl` verbs and
  descriptor argument arrays as the app, and never returns a token. For `host_status` and
  `open` it also runs `/usr/bin/osascript -l JavaScript` with a fixed JXA script, never built
  from a link or an argument, which asks NSWorkspace for the installed app and the
  `fabric-dashboards://` handler without launching anything. `open` runs `/usr/bin/open`
  (through `/usr/bin/env -u ELECTRON_RUN_AS_NODE`): the deep link with `-a` and the app that
  query found, or the plain service address in the default browser only when the app is
  confirmed absent and `fallback` is `if_absent`.
- **Opens** `fabric-dashboards://` links only for an installed service and a path on that
  service's own origin; any other link is refused with the reason and opens nothing
  ([ADR-0004](docs/adr/0004-deep-links-and-mcp.md)). Outside the app it opens only a
  dashboard link to another site, in the default browser after the person confirms; in Finder,
  the services folder, the app's data folder and a descriptor file the person asks to see
  (`shell.openPath` / `showItemInFolder`); the
  fabric-agent-adapter README ("How a service joins"); and macOS System Settings →
  Notifications.

A token file is readable by any process of the same user. Fabric Dashboards, like the
`fabric-service/0.1` extension, defends against web pages and mistakes, not against
hostile code already running as the operator.
