# ADR-0005 — The service link is `fabric-dashboards://service/<id>.<instance>`

Status: accepted · 2026-09-30 · amends [ADR-0004](0004-deep-links-and-mcp.md) §1

## Context

Fabric's agent registry (Fabric plan row AR-2.5, Fabric scenario SCN-101) gives each agent that
runs as a service an "Open dashboard" action. It opens the service in Fabric Dashboards through
`fabric-dashboards://service/<id>.<instance>`; Fabric never becomes a second dashboard host. The
0.2.0 app understood only `open?service=<id.instance>&path=/…` and `open?url=…`
(ADR-0004), so the link Fabric was designed to open would have been refused as an unknown verb.

## Decision

1. **`fabric-dashboards://service/<id>.<instance>` is the service link**, and `?path=/…` names
   one page of it. It is what `linkFor()` builds and what every MCP tool hands out
   (`open_link`, `activity` links). The key is the descriptor's own `id.instance` syntax,
   unencoded; one trailing slash is the same link.
2. **Refused, with the reason and nothing opened** (SCN-027): a key that is not `id.instance`
   in that syntax (an encoded character, a capital, a third part); anything after the key
   (`service/<key>/…` — a page goes in `path=`); a `#fragment` on the link itself (it goes
   inside `path=`); a parameter other than `path` (so `url=` or a second `service=` cannot ride
   along); more than one `path`; a `path` that is not a path on the service's own origin; a
   service that is not installed or whose descriptor cannot be read. Any link with a user,
   password or port is refused, whatever its verb.
3. **The 0.2.0 forms keep working.** `open?service=…&path=…`, `open?url=http://127.0.0.1:<port>/…`,
   `activity` and the bare scheme are parsed exactly as before; links already handed out still
   open.
4. **Not installed is the host's to say.** A link can only reach an installed Fabric Dashboards,
   so the app owns the states after it: a service that is not installed is refused with its key
   quoted (SCN-027), a stopped one opens on its Start control (SCN-029). Whether the app itself
   is installed is decided by whoever holds the link: the MCP `open` tool opens the plain
   `http://127.0.0.1` address instead and says so (ADR-0004); Fabric shows a note and the
   download link (Fabric SCN-101).

## Consequences

- Fabric can hand out the form in its design, and a person can read which service a link opens.
- A Fabric Dashboards older than the release carrying this ADR refuses the new form with
  "unknown link verb"; Fabric's "Open dashboard" needs that release installed.
- The MCP tools' `open_link` is `null` for a descriptor that cannot be read: a link to it would
  only be refused.
- The parsing is covered by `test/deeplink.test.ts` and, on a real Electron with a live sample
  service, by the third test in `test/e2e/app.test.ts`.
