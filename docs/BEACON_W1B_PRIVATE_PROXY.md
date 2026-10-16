# W1B.1 — Beacon/Sentinel private API routing

Source base: website `3a77975b5eef80664317d077074c95847d83a730`. This exact Worker release adds only four C0 Beacon private API paths. It does not change public website pages, the admin login, historical movement privacy, Discord bot credentials or game settings.

## Routes

- Exact authenticated GET paths: `/control/api/beacon/status`, `/control/api/beacon/services`.
- Exact CSRF-protected POST paths: `/control/api/beacon/start`, `/control/api/beacon/poll`.
- The existing `/control/api/logout` remains supported. Every authenticated POST requires exact adult-asa.org `Origin`, 43-character session-bound CSRF token and JSON content type. Only host-bound C0 authentication cookies pass upstream.
- Cloudflare preview origins get 403 on all private C0 paths. Arbitrary control/API paths and game-mutation endpoints remain 404. No CORS credentials or shared caching.
- Backend AASA performs **real** owner/Game Master authentication, while Cloudflare only enforces exact routing, headers, method and origin. The browser cannot add a trusted role/user header. Game Masters may use read-only provider views but cannot initiate owner-bound Beacon account consent.
- Secrets, device private codes, refresh tokens, auth headers and individual player histories are never returned through public routes. Public aggregate server-status response shape remains unchanged.

## Rollout and dependencies

1. B3-2 private Command Center must be merged, deployed and verified on Railway (owner-only, read-only, default disabled). Staff-role release must have passed if GM access is being enabled.
2. Test Worker unit/adversarial suite and Cloudflare preview, then merge website PR. Verify the actual canonical domain (anonymous GET /beacon/status must be 401 JSON; preview must be 403; invalid POST must be 403; working logout and original Discord OAuth must remain intact).
3. Store Beacon B3 private variables on **AASA only**: registered Beacon UUID `6f32a9f2-318e-4c70-b202-33777a54cb2f`, `REXY_BEACON_STORE_FILE=/data/rexy/beacon-tokens.v1.enc`, separately generated 32-byte encrypted-vault key and `REXY_BEACON_B3_ENABLED=true` only after the tested runtime and actual /data volume are confirmed.
4. The actual owner—not a Game Master—must complete the official https://usebeacon.app/device authorization. Request **common sentinel:read** only. Tokens remain encrypted on the persistent private Railway volume.
5. Independently enumerate provider service UUIDs; map **Limited Astraeos** first, then all 15 with clear owner-approved evidence. Do not infer service ID from map display labels.
6. Continue B4 live tribes and player/admin app packaging only after read-only provider verification. No Beacon write, player kicks, automated tribe mutations or RCON.

## Validation limits

Automated preview checks and a backend 401 prove the access guard is functioning but are not equivalent to a real owner OAuth grant. Tests must NOT replay a real callback token or impersonate Discord staff. Real role denial, session expiry and Sentinel UUID mapping remain unverified until their separate acceptance gates pass.

## Mandatory timeout-safe continuation

If interrupted or blocked, finish safely feasible work. Report COMPLETED / INCOMPLETE / BLOCKED / UNVERIFIED, exact failure queries and errors, changed files, PASS/FAIL/NOT RUN, artifact paths and SHA-256/integrity, and exact continuation steps. Never claim incomplete validations passed.
