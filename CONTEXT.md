# CONTEXT — Fabric Dashboards

Terms reused from the Fabric Agent Contract (`fabric-agent-contract/CONTEXT.md`) keep
their meaning there: Host, Provider, Agent, Capability, Profile.

| Term | Meaning |
|---|---|
| Service | A long-running agent speaking `fabric-service/0.1`: local (an `http://127.0.0.1:<port>` process on the operator's Mac, supervised by launchd or by nothing) or online (placement `remote`, an `https://<dns-name>` origin supervised by its platform, ADR-0011). |
| Service instance | One installation of a service, named `<id>.<instance>`; a preview copy is a second instance, never a second id. |
| Descriptor | The static JSON file an installer writes into the services directory: identity, origin, auth, lifecycle, paths, commands. Describes an installation, not a run. |
| Well-known document | The live answer at `/.well-known/fabric-service`: build identity, process, status, degraded sources, summary tiles, surfaces. Unauthenticated for a local service; behind the service token for an online one. |
| Activity event | One record from a service's events feed: when, what kind, which level, one human sentence, optional subject, link and notify flag. |
| Activity feed | The union of every service's activity events plus the host's own state-change events. |
| Control | Start, Stop or Restart, performed only through launchd. Stop is persistent. |
| Service state | What the host derives: invalid, stopped, conflict, foreign, duplicate, down, starting, stopping, degraded, ready. |
| Operator login | The one-time code the host obtains with the service token and exchanges for a dashboard cookie; the token never reaches a page. |
| Deep link | A `fabric-dashboards://` link that opens an installed service, or one page of it, inside the app, signed in (ADR-0004). |
| Service link | The deep link form `fabric-dashboards://service/<id>.<instance>[?path=/…]`: the one the MCP tools hand out and Fabric's "Open dashboard" opens; the 0.2.0 forms `open?service=…` and `open?url=…` still open, as strictly checked (ADR-0005, ADR-0004 amendment). Inside an embedded dashboard such a link opens that agent here (ADR-0016). |
| Service host package | `@passioncode-ai/fabric-service-host` (`packages/service-host`): the reading code this app shares with Fabric — descriptors, conflicts, launchd status, health probe, state precedence, one look, the service link, the usage-report check. Reads only; it reads an online service's token for its health probe (ADR-0006 amendment). |
| State vectors | `packages/service-host/test-vectors/state-precedence.json`: the cases every host that reads `services/` runs against its own use of the state precedence. |
| MCP server | `fabric-dashboards-mcp`, shipped inside the app: agents list services, get deep links, open pages, and start, stop, restart, doctor or update through the app's own rules. |
