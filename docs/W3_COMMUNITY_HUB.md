# W3 — Adult ASA Community Hub & Rexy Field Guide

## Design reference and originality
The owner cited https://www.shatteredskiesasa.com/mods as an example of a polished ARK cluster website. We inspected its **public-facing feature organization** (mods, shops, maps, gallery, events, staff, announcements). This branch contains original Adult ASA text, original CSS-generated decorative artwork, original UI logic, and reuses our pre-existing brand and mod-author research. It does **not** embed, copy, scrape or hotlink their private code, images, text, logo, or admin functionality.

## New user-facing experience
- `/community`: animated-free holographic hero, community routes, opt-in player shops, staff-reviewed events/challenges/announcements, opt-in local-image gallery, Rexy mod-guide CTA, and safe links to support.
- `/mods`: researched mod cards now show first-party CSS category artwork. The existing 44 researched mod entries, author links, evidence states and search filters remain intact. **No mod installation is invented.**
- Site-wide navigational link from home, servers, players, mods and recovery; homepage CTA and sitemap update.
- Cloudflare static Worker route is deliberately restricted to `/community`, three reviewed assets, and narrowly scoped gallery image files. No new public API, user tracking or write capability.
- Strict CSP unchanged: first-party scripts and images only; no embedded third-party content or live Discord scraping.
- The existing private Rexy Command Center, login, recovery APIs, OAuth and AASA backend are untouched.

## Staff-curated data source
`assets/community-content.json` initially ships empty. Never display invented shops, events, player names, reviews or photos.

**Schema version 1:**
- `shops`: `{approved:true,name,owner?,description,specialties?:string[],discordUrl?}`.
- `updates`: `{approved:true,kind:'event'|'challenge'|'announcement',title,description,startsAt?,publishedAt?,discordUrl?}`.
- `gallery`: `{approved:true,kind:'build'|'creature'|'moment',title,alt,credit?,image:'/assets/community/gallery/<safe-name>.webp'}`.

For each record: verify player consent for display name, accurate content, a valid source and the right to post image. Commit permitted images as reviewed local static assets with non-identifying filenames. The frontend ignores records without `approved:true`, rejects non-local gallery URLs, bounds fields and uses DOM `textContent` instead of HTML injection.

The frontend permits only `discord.gg/adultasa` or exact `discord.com/channels/<guild>/<channel>[/<message>]` links; other URLs fall back to the Adult ASA invite. New published content is a normal reviewed Git commit; **do not create an unauthenticated image upload or self-publishing API**.

## Visual / security QA
`npm run check` includes syntax validation and all website tests. New `tests/community-hub.test.mjs` exercises route allowlist, CSP, unpublished/approved record filtering, safe images, search/event filters, and no private API access.

## Deployment boundaries
This is a **draft pull request only** until CI, mobile/desktop visual QA, and the owner's review. Do not merge or deploy to adult-asa.org without explicit sign-off. No modifications to Railway production or the unrelated Rexy C39 character/item recovery. After merge, Cloudflare Pages deployment must be verified using public routes and negative security checks.

## Next iterations (separate reviews)
1. Owner-controlled community content approval workflow sourced from Discord, with per-post allowlisting and auditing.
2. Actual opt-in shop cards, event schedule, challenge library and consented photo gallery.
3. Optional public-safe Rexy enrichment (map occupancy summaries, already available under `/api/status/{cluster}`), without exposing private player intelligence, account identifiers or staff operations.
4. Progressive mobile visual QA and accessible interaction fixes.
