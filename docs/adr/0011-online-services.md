# ADR-0011 — Online services are read directly over https, beside the local ones

Status: accepted · 2026-10-02 · supersedes the proposed ADR-0009 (branch
`docs/remote-projection-cloud-mark`, never merged)

## Context

An operator runs agents and dashboards that are not on the Mac: an agent on a platform, a hosted
web console. The proposed ADR-0009 (2026-10-01) brought them in through a **local projection** —
a launchd service on the Mac that proxied the upstream — so that no descriptor would ever hold a
remote origin.

On 2026-10-02 the operator chose the other way, out loud and between exactly these two options: a
**remote placement in the contract**, not a local bridge. The Fabric Agent Contract records it as
DEC-0019 (`fabric-agent-contract` `2ce3922`): a descriptor may carry `placement: "remote"` with an
`https://<dns-name>` origin, supervised by its platform; the well-known document is behind the
service token; the session cookie is `__Host-` and `Secure`; the port claim is local-only.

## Decision

1. **The app reads an online service directly**, over verified TLS, from the main process — the
   same well-known document, events feed and login code as a local service. It sends the token
   only to the descriptor's own https origin, follows no redirect, and gives the probe
   `REMOTE_TIMEOUT_MS` (8 s); ADR-0008 holds — silence becomes `down` only after
   `REMOTE_DOWN_AFTER_MS` (60 s).
2. **The app supervises nothing online.** ADR-0002 stays true for every local service; an online
   service is supervised by its platform, and the app offers no start, stop, restart or update for
   it. `doctor` runs if the descriptor declares one.
3. **Its own group.** Online services appear under **Online** after the local cards, on the same
   card component, with the origin's host on the card (SCN-030). ADR-0009 proposed one list with a
   badge; a group answers the operator's request for a global place for online agents, and the card
   still carries the host so it reads correctly anywhere it is listed.
4. **Honest states.** A refused token, a certificate that does not verify, a redirect and a minute
   of silence are `down`, each with its own reason (`reason.remote.*`), never `foreign` for a refused
   token. A token file that cannot be read is `invalid` and the service is never contacted.
5. **Links.** `fabric-dashboards://service/<id.instance>` opens an online service as any other;
   `open?url=` accepts exactly a registered online origin and refuses any other https URL.
6. **Tests reach it without weakening the shipped app.** `FD_TEST_REMOTE` (a name, a dial address,
   a CA file) is honoured only when the app is not packaged; it maps the name for Chromium and the
   main process, and trusts exactly that certificate for exactly that name.

## Consequences

- `@passioncode-ai/fabric-service-host` 0.2.0: placement-aware descriptors, an https request
  with `TlsOptions`, `readToken`/`authHeaders` moved here from the app (one definition, R-005),
  `refused` and the remote state precedence, nine new shared vectors.
- Fabric ADR-0088 item 7 is unaffected — the app stays a Mac host and opens no inbound port; it
  adds outbound https reads. Fabric ADR-0083's wording «loopback only» is now narrower than the
  contract and is left to Fabric to update (carry-over in the run brief).
- A host older than 0.4.0 shows an online descriptor as invalid and never contacts it.
