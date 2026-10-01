# ADR-0009 — Remote services and web dashboards join through a local projection, marked "Cloud"

Status: proposed · 2026-10-01

## Context

Some services an operator wants in this app do not run on the Mac: an agent service on a cloud host,
or a web dashboard that already exists on a server (an analytics console, an admin page). The
protocol keeps a service on the Mac on purpose — a descriptor's `origin` must be
`http://127.0.0.1:<port>` (`packages/service-host/src/descriptor.ts:10`), every probe goes to
`127.0.0.1` over HTTP (`packages/service-host/src/health.ts:18`), a deep link may name only a loopback
origin (`src/core/deeplink.ts:97`), and
Fabric keeps this app a Mac host whose remote surfaces are projections relayed from the Mac
(Fabric ADR-0088 item 7). Opening a remote address directly would mean a non-loopback origin, an
HTTPS client in the probe, a token sent across the internet by the app and a second notion of
"alive" — the ones the protocol was written to avoid.

The question is how such a service appears here at all, and whether the operator should see it in
a separate place.

## Decision

1. **A remote service joins through a local projection.** The projection is an ordinary
   `fabric-service/0.1` service on the Mac, installed with a descriptor and run by launchd
   (ADR-0002), and it is the only thing this app talks to:
   - `GET /.well-known/fabric-service` reports the projection's own process and, as its `status`,
     what it last learned from the upstream: `ready` while the upstream answers, `degraded` with
     `{source: "upstream", reason}` when it does not. It answers from memory, as the protocol
     requires; the upstream is polled in the background.
   - `/fabric/v1/events` relays the upstream's events and adds the projection's own reachability
     changes ("upstream unreachable since …", "upstream back").
   - The dashboard is served by the projection on its loopback origin, proxying the upstream's
     pages; the single-use login code and the session cookie stay on `127.0.0.1` exactly as for a
     local service (SCN-014). The upstream credential lives only in the projection (its own 0600
     file or the Keychain) and never in a descriptor, a page, a URL or a log.
   - MCP, where the upstream has capabilities, is served at the projection's `/mcp` under the same
     capability names and schemas, passing `_meta.traceparent` through (fabric-interop/0.1).
   - SSH tunnels are not used: they expire without a signal and leave a healthy-looking port.

2. **A marker, not a section.** A projected service carries one descriptor extension:

   ```json
   "extensions": {
     "https://fabric.passioncode.ai/agent-contract/extensions/projection/0.1": {
       "placement": "cloud",
       "upstream": "https://example-agent.example.com"
     }
   }
   ```

   `placement` is `cloud` (the only value today); `upstream` is an origin only — scheme and host, no
   path, no credential — shown to the operator so they know where the service really runs. The app
   keeps **one list**: a projected service gets a "Cloud" badge on its card and in its view, and no
   separate Local / Cloud section exists. A descriptor without the extension is a local service
   and shows no badge. Sorting and filtering by the badge are a later UI choice, not a second list.

3. **Control means the projection.** Start, Stop and Restart act on the projection through launchd;
   they never reach the remote host. The service view says so next to the controls of a projected
   service ("Restart restarts the local projection; the cloud service is not touched"). A
   projection whose upstream has no fabric surfaces at all (a plain web dashboard) is still valid:
   its events view carries only reachability, its dashboard proxies the page, it declares no MCP.

4. **The extension is proposed to the contract, not invented here.** Its key and shape are offered
   to `fabric-agent-contract` as an optional extension; until the contract accepts it, the app
   ignores it as it ignores any extension today (`validateDescriptor` does not inspect
   `extensions`), and no rule rejects a descriptor for having or lacking it.

## Consequences

- No descriptor ever holds a remote origin; the loopback rules, the probe and the deep-link
  checks stay as they are. A deep link to a projected service names the projection's
  `id.instance`, as for any service.
- A remote service's "down" is reported by its projection as `degraded`, so the app's state
  precedence and ADR-0008's missed-probe rule apply unchanged; the projection's own outage is an
  ordinary local outage.
- Implementation is not part of this ADR: the badge in `src/renderer/`, the control note, a UX
  scenario in `docs/ux/scenarios.md` (in the same change as the UI, per `CONTRIBUTING.md`), and a
  sample projection under `test/fixtures/` for the e2e run. A projection kit belongs with the other
  service kits in the adapter plugin.
- An operator can bring any number of existing web dashboards into the app one projection each,
  without this app learning HTTPS, remote tokens or a second list.
