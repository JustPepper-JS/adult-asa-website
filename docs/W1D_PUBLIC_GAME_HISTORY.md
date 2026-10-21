# Adult ASA W1D — Full retained ARK player/map/transfer history (2026-10-21)

The Adult ASA owner explicitly requests the public `/meet-the-players` page list **all tracked in-game player display names and ALL retained gameplay sessions and transfers** without individual player confirmation. The old W1C static-consent catalog is no longer read by this page. The hero pill uses simply **Stories**.

## Actual data coverage and limitations

The new Project Zenthara backend feature PR #31 provides two **read-only** paginated endpoints. This website only calls those endpoints, via the first-party Cloudflare Worker, and **never** forwards Rexy's older unrestricted `/api/players`, `/api/heatmap`, `/api/movement`, `/api/tracker`, or `/api/player-profiles/admin` to the public.

- `/api/community/players?page=N&q=NAME`: in-game display names and recorded playtime, which clusters/maps the player has been seen on, recorded session and transfer totals, first/last observation. 40 names per page.
- `/api/community/players/history?id=24-hex&page=N`: ALL session/transfer events still retained for the selected in-game name, 80 per page. Shows exact gameplay timestamps, map-history durations, and explicitly notes inferred vs recorded transfers.
- Older history that Rexy has already truncated or never collected **cannot be recreated**. Historical transfer association may be inferred, game names are not verified unique humans, and a provider/RCON outage can temporarily affect freshness.
- Legacy and Limited are kept distinct; an ambiguous or missing cluster association is labeled unknown instead of guessed. Physical Beacon/Nitrado mapping verification remains 0/15 independently attested.

## Security boundaries

The Cloudflare gateway explicitly allows **only** the two named public community routes, with small validated query keys (`q,page,id`), no credential cookies/headers forwarded, timeout and response size limits, and an **independent second JSON projection** on top of the backend source allowlist. It drops arbitrary fields before returning a response. It returns a controlled 400/404/502 error on unsupported queries, legacy APIs, malformed, inaccurate, overlong or unparseable replies. No public source objects, Steam/EOS/Xbox account identifiers, Discord IDs, IP addresses, RCON/FTP, keys, passwords, base locations/coordinates, tribe inventories, admin notes, or private operator controls.

This is about gameplay observations attributed to **in-game pseudonyms**, not external real-world user identities. The public history page never calls private owner APIs and does not allow game commands. The old unused `assets/players-directory.json` opt-in empty asset is deprecated and is **not** queried by the new page.

## Exact public site change

- `_worker.js` — two narrowly approved public gameplay paths, query validator and independent reply whitelist
- `assets/players.js` — all-player searchable paginated directory and lazy per-player event paging
- `assets/players.css` — responsive cards, map summaries, inferred transfer indicators, loading controls
- `meet-the-players.html` — text and controls for complete retained game histories, no opt-in claim
- `servers.html` — updated navigation/privacy note reflecting the public game-history summary
- `tests/players-directory.test.mjs`, `tests/community-proxy.test.mjs`, `tests/site.test.mjs` — rendering/projection/adversarial regression
- This document — handoff, source limitations and rollback.

**Deployment gate:** Website CI `npm run check` plus Project Zenthara PR #31 seven inherited security workflows (including 60/60 deterministic Rexy evaluation) must PASS. The website may display unavailable source until Railway has an independently verified successful new backend deployment. GitHub merge is not proof that Cloudflare/ Railway are live; inspect production response and owner/RBAC before claiming success.

**Rollback:** Revert exact reviewed W1D website change if any private data leaks or website fails, and if needed separately revert Project Zenthara PR #31 without changing Nitrado, ARK servers, RCON, Beacon, Discord or player stored files.

**Timeout-safe handoff:** Report COMPLETE/INCOMPLETE/BLOCKED/UNVERIFIED with PR HEAD SHAs, all CI statuses, source file path lists, artifact checksum provenance, live deployments and further steps. Record in the permanent Rexy master continuity ledger. No fabricated player count or unverified production claim.
