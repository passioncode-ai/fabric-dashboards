# Quality waves, 2026-11-15

The operator, 2026-11-15 (session `36babb6c`): analyse the interface, glitches, latency, performance and correctness;
add a bug tracker joined to our own analytics; gather GitHub issues and the board's tasks; research gaps, errors,
typos, logic breaks, layout, typography and UI/UX problems; put it all in one plan in waves and fix wave by wave to the
end.

Sources: [the audit](../../reports/2026-11-15-quality-audit/README.md) (U, T, P, C), the backlog's 52 rows not done,
issues #294 (FD-140) and #26 (FD-12), the board (nothing queued). Each wave ends with `npm run check` green, its text
through the copy checks, a release, and its rows closed in `docs/backlog.md`.

| Wave | What | Rows | State |
|---|---|---|---|
| 0 | Bug tracker on our analytics: journal, fingerprint in `app_error`, Settings, MCP `bugs` and `bug_report` | FD-263 | done 0.8.101 |
| 1 | What a person sees as wrong now: the pool refusal's text, the stale "six", Russian grammar, English left in Russian; the agent header hiding tabs; the task line's edges; the ⋯ over the place icons; colour-only place states; the New session dialog not inert | T-01, T-02, T-03, T-10, U-01, U-02, U-03, U-04, U-06; C-01, C-03, C-04, C-05, C-07, C-08, P-07 (FD-264) | done 0.8.102 |
| 2 | Glossary and copy: «навыки», "State", «агент для кода», "another copy", MCP descriptions, first person, cases, meaning parity, platform wording | T-04 to T-09, T-11 to T-16 (FD-265) | done 0.8.103 |
| 3 | Interface polish: starting against stopped, the title jump, reading states, tooltips, names of removed agents, type sizes, the task line's role, the setup card without a coding agent, Clear with undo | U-05, U-07 to U-14 (FD-266) | done 0.8.104 |
| 4 | Performance and correctness findings (P, C) by severity | P-01 to P-09, C-02, C-06, C-09 (FD-267) | done 0.8.105; FD-268 left |
| 5 | Backlog truth: close or restate rows whose state is stale (FD-239, FD-240, FD-249, FD-252, FD-261 and the rest of the 52), re-verify the blocked ones, answer issues #294 and #26 with their state | done 2026-11-15: FD-239, FD-240, FD-249, FD-252 closed as released; FD-140 (#294) and FD-12 (#26) re-checked with status comments; the other open rows read true (their "Left" parts are real work); FD-235 and FD-236 (security proposals) become wave 5b |
| 5b | The security audit's proposals and seam findings not yet taken: triage each against the code and the operator's decisions, fix what holds | FD-235, FD-236 | next |
| 6 | The larger asks, design first: agents' own dashboards rendering in the app (FD-246), Sessions redesign with remote machines (FD-247), organizations set up by themselves (FD-248); SCN-058's full e2e path (FD-251) | FD-246, FD-247, FD-248, FD-251 | FD-251 done 0.8.104 |
