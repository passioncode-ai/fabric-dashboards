# ADR-0016 — What an agent is for, its tools, and links from one agent's dashboard to another

Status: accepted · 2026-10-05

## Context

On 2026-10-05 the session that owns the operator's growth service and analytics agent passed on
the operator's request: every agent should say clearly in Fabric Dashboards what it is responsible
for, and moving between the analytics agent and the growth cabinet should take one click. The
study is in the growth service's private repository
(`docs/reports/2026-10-05-analytics-platform-review/README.md` §2).

What 0.5.4 did:

- A descriptor carries a one-line `summary` (Fabric Agent Contract, `service-descriptor`; the
  example fixture's is «Drafts and files reports for its operator.»). The app never drew it. Only
  the well-known document's `summary` tiles were shown (`Overview.tsx`), so every agent's own
  description was invisible.
- The well-known document names the MCP capabilities an agent serves
  (`surfaces.mcp.capabilities`, DEC-0016/0020). The app read them (FD-11) but showed them nowhere.
- Inside an embedded dashboard, `policy.ts` `navigation()` denied a `fabric-dashboards:` link.
  Another agent's own address went to the system browser after a question, outside the app and
  without that agent's session.

## Decision

<a id="decision"></a>

1. **The summary under the name.** On the Overview card, the descriptor's `summary` sits under
   the version line, clamped to two lines, with the full text on hover. On the service page it sits
   under the title.
2. **The agent's tools on its page.** The service header lists `surfaces.mcp.capabilities` as
   code chips under **Tools**: eight shown, the rest behind «+N more». The names are what the
   well-known document gives, without the token. The contract carries no per-capability
   description, so none is invented.
3. **A link to another agent comes back to the app** (`routeLink` in `src/electron/policy.ts`). A
   click or a `window.open` inside an embedded dashboard is routed by its target:
   - **The view's own origin** stays in the view. A new window on that origin opens in the view;
     before, it was dropped.
   - **A `fabric-dashboards:` link** goes to the app's deep-link path, the same one a link from
     outside takes. That path is `parseDeepLink` against the installed descriptors (ADR-0004,
     ADR-0005), then `navigate`. The target opens signed in with its own session, and the first
     agent keeps its page in its own view.
   - **The origin of another registered service** (a local `http://127.0.0.1:<port>`, or the
     registered `https` origin of an online one) becomes `fabric-dashboards://open?url=…` and takes
     the same path.
   - **Any other web link** still goes to the system browser after the question, as before.
   - Everything else is denied, as before.
   - A refused link shows «This link cannot be opened» with the reason (SCN-027). Nothing opens in
     a browser.
   - Redirects keep the old rule: a redirect off the view's origin is refused (`navigation()`).
4. **The link format for agents** is the existing one, so no new parser is needed:
   `fabric-dashboards://service/<id>.<instance>?path=<URL-encoded path>`. It carries one `path`, no
   fragment outside it, and never a full URL.

## Consequences

- An agent can hand the operator to another agent's exact page — «Approve in Growth», «Open in
  Analytics agent» — and each side keeps its own sign-in and authority. The app never puts one
  agent's session on another's page.
- A look-alike host (`growth.example.com.evil.test`) or a local port that no descriptor names is
  not a registered origin, so it gets the browser question, never the app. This is tested.
- The read-only `sshlg-analytics.projection` instance groups under the analytics agent by service id
  (ADR-0012) until it retires. It needs no re-key.
- Tests: `test/parts.test.ts` (*ADR-0016: a link inside a dashboard…*) and `test/e2e/app.test.ts`.
  The end-to-end test covers the summary on the card and the page, and the tools. In the
  two-service test, Alpha's dashboard opens Beta at a path through a service link, and Beta opens
  Alpha's own address through `window.open`; both land in the app.
