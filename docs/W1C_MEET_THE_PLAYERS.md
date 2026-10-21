# W1C — Meet the Players (2026-10-21)

## Owner request and constraints

The owner wants a public "Meet the Players" page listing everyone, map history, and transfers. The historic backend already has `GET /api/players` with `buildPlayerProfiles()` returning individual names, historical sessions, last-seen details, current server and transfer records. It is **not an appropriate public API** without a separately reviewed consent, identity and safety model. Existing Cloudflare Worker intentionally returns 404 for that route and archives `players.html`; this release preserves both boundaries.

**Delivered safe first stage:** An accessible public `/meet-the-players` directory page, shared nav and footer links, search, cluster filter, opt-in profile/map/transfer story rendering, responsive styling, and an explicit empty state. An empty catalog contains no identities or histories. No claim of current player enumeration or transfers. Public pages use a dedicated static `assets/players-directory.json`, NOT raw Rexy API data, and no new database or login.

## Public consent contract

A published player profile must be approved **by that player**, with verified game/Discord identity and revocable scope. Publishing the JSON catalog is itself public disclosure; client-side filtering is *not* authorization. Before adding a real entry, separately implement and audit a consent and release pipeline outside the public repository:

1. Authenticate the actual player (not a self-asserted name, staff impersonation, or a screenshot alone), link to the correct survivor and cluster without guesswork, verify any requested map/transfer records against approved sources. A shared display name is not sufficient identity.
2. Obtain separate affirmative consent for public display name/bio, optional coarse map highlights, and optional coarse transfer highlights. Default every category OFF. Players can decline, revoke, correct, or request deletion. Avoid opt-out-only publication.
3. Maintain private consent evidence, scoped effective/revoked timestamps, processing audit and retention rules outside the public asset bundle. No raw player IDs, IPs, linked Discord IDs, base coordinates, exact join/logout times, session IDs, access keys, secret refs, platform IDs or real-time current map exposure.
4. After independent owner/privacy review, publish **only** a separately generated, restricted public projection to the curated catalog. Public story dates are month-only `YYYY-MM`, deliberately not precise movement breadcrumbs. Both cluster and map must match the advertised 10 Legacy / 5 Limited map vocabulary. Duplicate names and unsupported fields fail closed.
5. Make revocation remove public assets promptly and invalidate CDN caches; do not assume deleting a profile from a future API removes a previously downloadable static file. Add a documented contact/removal process.
6. Every update to the directory requires strict schema checks and publication approval. The initial catalog stays `profiles:[]` until this work is completed.

**No public data exists in this tranche**; there are no fictitious populated players, fabricated transfers or unauthorised mass-publication. The first implementation supports future approved public cards without relaxing the legacy route boundary.

## Owner-private companion (future separately reviewed stage)

Separately, the owner wants useful all-player administration intelligence. Design a truly authenticated owner-only UI in the C0 Command Center, not a frontend `fetch('/api/players')` workaround. Access should be server-side owner-verified, audit logged and purpose limited, with Game Master permissions explicitly reviewed and least privilege. Historical player rows require accurate provenance, transfer deduplication, source freshness and alias/Steam/Xbox/EOS identity reconciliation. The current Beacon B3-8 physical server identity mappings are still **0/15 independently verified**; do not silently connect sessions to the wrong Legacy/Limited machine.

An owner-private all-player view can show historical records only after separate authorization and the necessary privacy safeguards. The public web directory must never become a proxy for owner-private records.

## Exact site changes

- New `meet-the-players.html` and `assets/players.css`, `assets/players.js`, `assets/players-directory.json`
- New `tests/players-directory.test.mjs`, this design note
- Modified `_worker.js`, `index.html`, `servers.html`, `mods.html`, `sitemap.xml`, `tests/site.test.mjs`, `tests/routing.test.mjs`
- Do not change `index.js` (bot), Nitrado, Beacon, Railway, Discord, live server configs or secrets.

**Testing:** Node 22 `npm run check` must pass new adversarial public-directory schema, no raw API exposure, safe archival, worker allowlist, navigation, JS syntax, layout and original OAuth/C0 privacy tests. GitHub CI passing is synthetic; Cloudflare live deployment and browser rendering require separate checks.

## Timeout-safe handoff

Always report COMPLETED / INCOMPLETE / BLOCKED / UNVERIFIED, exact source paths, GitHub commit/PR, test runs PASS/FAIL/NOT RUN, artifact hashes, rollback and continuation. A live public page with no real profiles is NOT a completed all-player-history data feature. Preserve Rexy's master continuity ledger and original Beacon drafts.
