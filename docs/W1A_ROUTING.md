# W1A: recover administrator routing before the visual rebuild

Owner-authorized segmented continuation, 2026-10-15. Baseline website main:
`5a3cc7d38d45fb627bbf293c3422d260df5d04f9`. Backend remains unchanged at
`eb02c9cfa017af3ababf28336970dac82d7387e1` in Project-Zenthara.

## Implemented scope

- One explicit routing module, `_worker.js`, usable by Pages advanced mode and Workers.
- Existing canonical host `https://adult-asa.org` is the only login/session origin.
- Only existing C0 GET paths and its CSRF-checked logout can reach the fixed AASA host.
- Preserve code/state callback, separate Set-Cookie headers and secure cookie attributes.
- Reject arbitrary paths, proxy targets, methods, redirect destinations and caller identity headers.
- No-store private data; no credentialed CORS; bounded requests, responses and timeouts.
- `/admin` is a new login landing page. Old admin.html and control/admin.html redirect there.
- `/api/status`, `/api/status/legacy`, `/api/status/limited` expose an explicit aggregate projection.
  Names, addresses, sessions, passwords and raw provider objects are not copied into it.
- Unknown API/source requests are errors, never the static homepage.
- Separate source updatedAt from fetchedAt; unknown or stale timestamps are not relabeled current.
- Original homepage and other public pages remain for the separately reviewed W1B visual rebuild.

## Deployment

Workers uses wrangler.jsonc with the existing worker name, ASSETS binding and
run_worker_first=true. Pages uses its existing root output directory and `_worker.js`
advanced mode; Pages asset clean-URL redirects are resolved inside ASSETS, not over the network.
Do not create another Worker/service or change DNS to deploy this patch. Observe the
existing Cloudflare Git integration's preview and main deployment separately, then
verify canonical HTTP responses and X-Adult-ASA-Release.

## Validation and limits

`npm run check` runs syntax and 31 deterministic routing tests with synthetic upstreams.
No dependency install, Discord token or server write is used by these tests.
Local integration also exercises the unchanged real C0 router with mocked Discord.
Actual owner consent/login, unrelated-account denial on production and phone testing
remain UNVERIFIED until performed. Fixture success is not live OAuth proof.

This is NOT the full website redesign, a new mod catalog, staff roles, game control,
Beacon consent, tribe sync, or native app release. Existing legacy public pages still
use their old direct API integrations. The backend's legacy heatmap/tracker/player
endpoints and their exposure need a separately tested authorization/privacy migration;
this patch deliberately does NOT proxy them to the canonical website.

The abandoned W1 source-transport branch is not a repository baseline. Its partial
Base64 chunks must not be promoted. This patch contains ordinary reviewable source.

## Rollback and next segments

Before merge, compare the exact nine-file diff. Preserve main's baseline as the
rollback target. After merge, verify Cloudflare result and real public route responses.
For rollback create a reviewed revert of W1A; do not reset other work or rotate credentials.

W1B: full clean navy/cyan/gold visual rebuild, verified map/mod catalog, clear aggregate
activity charts, honest freshness, and only functioning navigation.
W1C: legacy player-data privacy migration and clearer owner-only movement history;
actual provider permission and cross-account checks before wider player access.

## Mandatory timeout-safe rule

If execution may time out, becomes blocked or is interrupted, finish safely feasible
work. Separate COMPLETED, INCOMPLETE, BLOCKED and UNVERIFIED. Record exact errors,
failed queries, changed/added/deleted paths, PASS/FAIL/NOT RUN tests, artifact/checkpoint
paths, SHA-256 checksums, integrity and precise continuation. Never claim incomplete
validation passed. Include this rule in future Rexy implementation prompts and handoffs.

## Design references

- https://developers.cloudflare.com/pages/functions/advanced-mode/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/runtime-apis/headers/

## W1A.1 Discord issuer callback correction (2026-10-15/16)

Live owner login exposed a missing callback query allowlist field: Discord returned
`iss=https%3A%2F%2Fdiscord.com` alongside `code` and `state`. W1A rejected
the request with `{"error":"INVALID_QUERY"}` before the C0 router could process it.
W1A.1 permits the optional RFC 9207 issuer parameter **only** on the exact
`/control/oauth/callback` route, and only when decoded value matches
`https://discord.com` exactly. Duplicate, foreign, malformed, or misplaced
issuer fields still fail closed. The exact query is forwarded to the existing
C0 server; its one-time state-cookie checks and owner allowlist remain unchanged.

No new OAuth secret, token, bot, Railway change, or permissions are necessary.
A screenshot containing a prior authorization code does not permit replay;
the owner must begin a new login from `https://adult-asa.org/admin`.

Evidence gates: updated website routing CI; Cloudflare preview build; public-domain
verification of the corrected query validator without attempting token exchange;
then human owner success/non-owner denial and sign-out. Treat the last live
login checks as **UNVERIFIED** until someone performs them. Preserve the
mandatory timeout-safe handoff and exact source/CI evidence.
