# Security

Report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/passioncode-ai/fabric-dashboards/security/advisories/new)
for this repository, or by email to contact@passioncode.ai.
Do not open a public issue containing tokens, descriptor contents from your machine, or
service data.

## What the app touches

- **Reads** the services folder (`~/Library/Application Support/ai.passioncode.fabric/services/`
  or `FABRIC_SERVICES_DIR`) and, for each service, the token file its descriptor names.
  Tokens are read in the main process only; they never reach a page, a URL or a log.
- **Talks** only to `127.0.0.1:<port>` origins declared by descriptors.
- **Runs** `launchctl` on the labels descriptors declare, `lsof` for the listener scan, and
  the `doctor` and `update` argument arrays a descriptor declares — no shell, 120 s limit.
- **Writes** its own data under `~/Library/Application Support/Fabric Dashboards/`
  (settings, activity) and logs under `~/Library/Logs/Fabric Dashboards/`.
- **Listens** on no port. The MCP server (`Contents/Resources/bin/fabric-dashboards-mcp`)
  is started by an agent and speaks only over its stdin and stdout; it reads the same
  folder and token files and runs the same `launchctl` verbs and descriptor argument arrays
  as the app, and never returns a token.
- **Opens** `fabric-dashboards://` links only for an installed service and a path on that
  service's own origin; any other link is refused with the reason and opens nothing
  ([ADR-0004](docs/adr/0004-deep-links-and-mcp.md)).

A token file is readable by any process of the same user. Fabric Dashboards, like the
`fabric-service/0.1` extension, defends against web pages and mistakes, not against
hostile code already running as the operator.
