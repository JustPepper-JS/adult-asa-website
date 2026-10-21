# B3-8c private owner host-preview Cloudflare gateway stage — 2026-10-21

## What this allows, and what it does NOT allow

The Project Zenthara B3-8c draft PR #30 adds an owner-authenticated read-only backend `GET /control/api/beacon/host-preview` and a private Command Center button. The public website Worker previously allowed only `/control/api/beacon/status` and `/control/api/beacon/services`, so the new backend endpoint would be inaccessible behind adult-asa.org even if PR #30 passed tests and were deployed.

This narrowly scoped website update adds **exactly one** additional private `PRIVATE_GET` path to the existing Cloudflare control proxy. It forwards only a verified `__Host-rexy_console` cookie and never forwards client-supplied Authorization/role headers. It is canonical-origin-only and read-only GET/HEAD; no new public API, game command, OAuth scope, key, secret, server setting or session read.

**Critical double gate:** Even after a backend 200 JSON response, the Cloudflare Worker validates the owner-only B3-8c evidence schema and independently rebuilds the browser response. The JSON returned to the browser contains only `slot` and `addressEvidence` per 15 configured server slots, bounded `candidateCount`, `reportedHostEqualCount`, `observedAt`, `readOnly:true`, `verifiedMappings:0`. Raw Beacon UUIDs, IP addresses, AccessKeys, provider records, player names, tokens, session histories, arbitrary backend fields and private metadata are discarded. Malformed or physically verified-looking assignments fail closed to `UNVERIFIED`.

**Authentication:** The trusted C0 backend, not this Worker, is the authority for Discord owner vs Game Master; it must return 403 for Game Masters and 401 for unauthenticated requests. The Worker retains those denial statuses but replaces error bodies with `NOT_AUTHORIZED`. A cookie merely reaches the backend—it cannot grant owner access by itself. The owner-only UI remains in B3-8c unmerged draft, so this proxy is useful only when that separately reviewed backend change is deployed.

## Tests and release plan

- `_worker.js`: one private allowlisted route + strict projection; no legacy privacy exceptions
- `tests/owner-preview-proxy.test.mjs`: adversarial malicious provider body, duplicate slots, wrong counts, wrong dates, forbidden client role/Authorization headers, Game Master/guest denial, foreign origin/method/query rejection
- This documentation: independent limitations and continuation
- Inherited `npm run check` syntax, worker, public-player privacy and prior C0/OAuth tests must pass.
- Merge this small website change only on PASS; existing Cloudflare main Git integration may publish it before the backend is deployed, in which case backend 404 becomes an unambiguous error, NOT public data.
- Preserve all prior `/api/players`, `/api/heatmap`, `/api/tracker`, `/api/movement` and archived `/players.html` protections; do not confuse the public consent-first Meet the Players page with this private owner integration.
- After backend PRs #28 → #29 → #30 are security reviewed and merged in order, confirm Railway terminal healthy, Cloudflare main deployment, and actual owner-only preview. Do not call 0/15 physically verified matches complete.
- Independently verify real Game Master role denial and origin/session isolation before declaring a live security acceptance PASS. Fixture checks are synthetic.

**Timeout-safe handoff:** always state COMPLETED / INCOMPLETE / BLOCKED / UNVERIFIED, exact paths, PR/head SHA, tests and artifacts, checksums, deployment state, rollback and next continuation.
