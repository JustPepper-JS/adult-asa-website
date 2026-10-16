# Adult ASA W1B — Public site redesign

Baseline: `JustPepper-JS/adult-asa-website` main `a6f310116d26d6e17b218647d0fed4b006bc5bda` (W1A.1, owner Discord login verified by screenshot). This document describes the scoped W1B release and its limits, not future features as built.

## Scope

- Replace only the public home, servers/maps, and mod research pages with a consistent semantic HTML/CSS/JavaScript design, including small-screen nav and accessible filters.
- Keep existing `/admin` Discord OAuth login and `/control/*` protection exactly as established in W1A.1. Release marker identifies the new Worker; no new app, Discord bot, user permission, Beacon grant, or game-control endpoint.
- Use the W1A aggregate `/api/status/legacy` and `/api/status/limited` projections only. Count only observed states; unknown and missing data are not zero, and `fetchedAt` is not substituted for the provider's `updatedAt`.
- Present 10 Legacy world slots and 5 Limited slots (The Island, Extinction, Genesis, Lost Colony, Astraeos), independent of API health. Dynamic server counts are derived from actual returned provider projections and never fabricated.
- Give a readable per-map current-occupancy comparison and accessible fallback counts, **not** a historical heatmap or individual player travel history. Real history requires W1C privacy remediation.
- Mod Research Library: 42 historical author-research profiles (reviewed 2026-08-07) plus two owner-observed October 8, 2026 Legacy enabled-list mod IDs. **Not a verified current installed-mod list.** Official author links are included. The earlier August source's broad `all` map scope is not a reliable current install claim after Limited expansion and Primal retirement; public UI does not assert current scope for those entries.
- Stop serving legacy public movement/heatmap/player/tracker/link-survivor/staff pages, and exclude them from Cloudflare static assets. Redirect old direct page URLs to safe public destinations. Do not claim this mitigates all historical direct-backend URL exposure.
- No new image generated. Colors and spacious typography are inspired by owner-supplied artwork. Visual elements are CSS and SVG. No new third-party scripts/fonts.

## Source provenance

Mod profiles: `Project-Zenthara/rexy3/adult-asa-knowledge.json` at `eb02c9cfa017af3ababf28336970dac82d7387e1` and owner-observed installation records in `zenthara/knowledge/mod-sme/adult-asa-installations.json` at the same commit. Source may be out of date; static JSON preserves an explicit warning. No synthetic example mod is included in the public catalog.

## Validation expectations

- Existing W1A/W1A.1 routing and security tests; new public navigation, CSP, source catalog, safe legacy redirects, freshness/partial data and JavaScript syntax tests.
- Deploy preview first; test desktop/mobile render, keyboard and search filters, real deployed HTTP status and source routes, and no runtime console errors on representative page paths.
- Review exact diff, merge only if tests and preview pass, then confirm production deploy terminal SUCCESS and public-domain readback. Recheck `/admin`, `/control/login` and protected API unauthorized behavior after release. Actual real non-owner Discord login, logout/expiry, and true real-time mod install verification remain UNVERIFIED unless separately tested.

## W1C / following work

Review backend raw player history, heatmap, tracker, sessions and identity authorization; do not publish personally identifiable player movement. Design hourly activity heatmap aggregated by map/cluster and authenticated individual movement only after dedicated backend policies and adversarial tests. Continue B3 Beacon read consent and verified 15-service UUID mapping, mod SME freshness, and player/mobile app milestones.

## Mandatory timeout-safe rule

If execution may time out, is interrupted or blocked, complete everything safely feasible. Separate COMPLETED, INCOMPLETE, BLOCKED, UNVERIFIED. Record exact errors, failed queries, changed/added/deleted paths, tests passed/failed/not run, artifact/checkpoint paths, SHA-256 checksums, integrity checks, and precise continuation. Never claim incomplete validation passed, and repeat this rule in every future Rexy implementation prompt and handoff.
