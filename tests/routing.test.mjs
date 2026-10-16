import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHandler, projectStatus, forwardedCookies, RELEASE, CANONICAL, BACKEND } from '../_worker.js';
const nonce = 'A'.repeat(43);
const headers = { Cookie: '__Host-rexy_console=' + nonce, Origin: CANONICAL, 'X-CSRF-Token': nonce };
const request = (path, opts = {}, origin = CANONICAL) => new Request(origin + path, opts);
const sample = { cluster: 'legacy', updatedAt: '2026-10-15T20:00:00Z', totalOnline: 2,
  servers: [{ name: 'Adult ASA - The Island', map: 'TheIsland_WP', players: 2, maxPlayers: 26, online: true,
    playerNames: ['not-for-public'], host: 'internal.invalid', rconPassword: 'do-not-forward', version: '94.29' }] };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const authURL = 'https://discord.com/oauth2/authorize?' + new URLSearchParams({
  response_type: 'code', client_id: '1450621944360603820', scope: 'identify',
  redirect_uri: CANONICAL + '/control/oauth/callback', state: nonce,
});
const env = { ASSETS: { fetch: async req => new Response('asset:' + new URL(req.url).pathname, { headers: { 'Content-Type': 'text/html' } }) } };
const failFetch = async () => { throw Error('Unexpected provider call'); };
function noCache(response) {
  for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control']) assert.match(response.headers.get(name), /no-store/);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('X-Adult-ASA-Release'), RELEASE);
}
test('admin aliases reach the dedicated login landing page', async () => {
  const handle = createHandler({ fetchImpl: failFetch });
  for (const path of ['/admin.html', '/admin/', '/control/admin.html', '/staff-whitelist.html']) {
    const res = await handle(request(path), env); assert.equal(res.status, 302); assert.equal(res.headers.get('Location'), '/admin'); noCache(res);
  }
  const res = await handle(request('/admin'), env); assert.equal(await res.text(), 'asset:/admin.html');
  assert.match(res.headers.get('Content-Security-Policy'), /default-src 'none'/);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
});
test('existing homepage and approved static files are preserved', async () => {
  const handle = createHandler({ fetchImpl: failFetch });
  assert.equal(await (await handle(request('/'), env)).text(), 'asset:/index.html');
  for (const path of ['/mods.html', '/gateway.css', '/movement.html']) assert.equal((await handle(request(path), env)).status, 200);
});
test('source files, unreviewed APIs and arbitrary proxy targets are not published', async () => {
  const handle = createHandler({ fetchImpl: failFetch });
  for (const path of ['/_worker.js', '/rexy-ai.js', '/rexy_entities.json', '/tests/routing.test.mjs', '/wrangler.jsonc',
    '/.github/workflows/routing-ci.yml', '/unknown.html', '/api/heatmap', '/api/tracker', '/api/players',
    '/api/player-profiles/admin', '/control/api/actions/execute', '/api/status/primal']) {
    const res = await handle(request(path), env); assert.equal(res.status, 404, path); noCache(res);
  }
});
test('encoded paths and overlong requests fail before upstream access', async () => {
  const handle = createHandler({ fetchImpl: failFetch });
  for (const path of ['/control/%61pi/me', '/control//api/me', '/api/status?' + 'x'.repeat(8300)]) assert.equal((await handle(request(path), env)).status, 400);
});
test('only intended methods are accepted, including admin aliases', async () => {
  const handle = createHandler({ fetchImpl: failFetch });
  for (const path of ['/admin', '/admin.html', '/control', '/control/login', '/api/status']) assert.equal((await handle(request(path, { method: 'POST' }), env)).status, 405);
  assert.equal((await handle(request('/control/api/logout'), env)).status, 405);
  assert.equal((await handle(request('/control/api/me', { method: 'OPTIONS' }), env)).status, 405);
});
test('preview and foreign origins cannot start or reuse production OAuth', async () => {
  const handle = createHandler({ fetchImpl: failFetch });
  for (const origin of ['https://preview.adult-asa-website.pages.dev', 'https://evil.invalid', 'http://adult-asa.org']) {
    assert.equal((await handle(request('/control/login', { headers }, origin), env)).status, 403);
    assert.equal((await handle(request('/control/api/me', { headers }, origin), env)).status, 403);
  }
});
test('OAuth redirect is forwarded without following it and keeps state cookie', async () => {
  let called = 0;
  const handle = createHandler({ fetchImpl: async (url, opts) => {
    called++; assert.equal(url, BACKEND + '/control/login'); assert.equal(opts.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: authURL, 'Set-Cookie': '__Host-rexy_oauth=' + nonce + '; Path=/; HttpOnly; Secure; SameSite=Lax' } });
  } });
  const res = await handle(request('/control/login'), env); assert.equal(called, 1); assert.equal(res.status, 302);
  assert.equal(new URL(res.headers.get('Location')).origin, 'https://discord.com'); assert.equal(res.headers.getSetCookie().length, 1); noCache(res);
});
test('dangerous and misconfigured OAuth redirects fail closed', async () => {
  for (const location of ['https://evil.invalid/', '//evil.invalid/control/', '/control/?next=evil',
    authURL.replace('scope=identify', 'scope=identify+email'), authURL.replace('1450621944360603820', '111111111111111111')]) {
    const handle = createHandler({ fetchImpl: async () => new Response(null, { status: 302, headers: { Location: location } }) });
    assert.equal((await handle(request('/control/login'), env)).status, 502, location);
  }
});
test('callback carries its exact code and state only to the fixed backend', async () => {
  const query = '?state=' + nonce + '&code=fixture-code';
  const handle = createHandler({ fetchImpl: async (url, opts) => {
    assert.equal(url, BACKEND + '/control/oauth/callback' + query); assert.equal(opts.headers.get('Cookie'), '__Host-rexy_oauth=' + nonce);
    return new Response('Authentication rejected', { status: 403, headers: { 'Content-Type': 'text/plain' } });
  } });
  assert.equal((await handle(request('/control/oauth/callback' + query, { headers: { Cookie: '__Host-rexy_oauth=' + nonce } }), env)).status, 403);
});
test('extra/duplicate callback parameters and redirect injection rejected', async () => {
  const handle = createHandler({ fetchImpl: failFetch });
  for (const path of ['/control/login?redirect_uri=https://evil.invalid', '/control/oauth/callback?state=a&state=b',
    '/control/oauth/callback?next=https://evil.invalid', '/api/status?upstream=https://evil.invalid']) assert.equal((await handle(request(path), env)).status, 400);
});
test('only valid dedicated cookies cross the origin boundary', () => {
  assert.equal(forwardedCookies('other=secret; __Host-rexy_console=' + nonce + '; irrelevant=yes'), '__Host-rexy_console=' + nonce);
  assert.equal(forwardedCookies('__Host-rexy_console=malformed'), '');
  assert.throws(() => forwardedCookies('__Host-rexy_console=' + nonce + '; __Host-rexy_console=' + nonce));
  assert.throws(() => forwardedCookies('x'.repeat(4097)));
});
test('privileged caller-supplied headers are stripped', async () => {
  const handle = createHandler({ fetchImpl: async (_, opts) => {
    for (const name of ['Authorization', 'X-User-Id', 'X-Admin', 'X-Forwarded-Host', 'X-Forwarded-For', 'Host']) assert.equal(opts.headers.get(name), null, name);
    assert.equal(opts.headers.get('Cookie'), headers.Cookie); return json({ error: 'NOT_AUTHENTICATED' }, 401);
  } });
  const res = await handle(request('/control/api/me', { headers: { ...headers, Authorization: 'Bearer fake', 'X-Admin': 'true', 'X-User-Id': 'owner', 'X-Forwarded-Host': 'evil.invalid' } }), env);
  assert.equal(res.status, 401); noCache(res);
});
test('backend authorization result, not cookie presence, grants or denies access', async () => {
  const handle = createHandler({ fetchImpl: async () => json({ error: 'NOT_AUTHENTICATED' }, 401) });
  assert.equal((await handle(request('/control/api/overview', { headers }), env)).status, 401);
});
test('multiple callback Set-Cookie headers survive separately including Expires comma', async () => {
  const h = new Headers({ Location: '/control/' });
  h.append('Set-Cookie', '__Host-rexy_oauth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax');
  h.append('Set-Cookie', '__Host-rexy_console=' + nonce + '; Path=/; HttpOnly; Secure; SameSite=Lax');
  const handle = createHandler({ fetchImpl: async () => new Response(null, { status: 303, headers: h }) });
  const res = await handle(request('/control/oauth/callback'), env);
  assert.equal(res.status, 303); assert.equal(res.headers.getSetCookie().length, 2); noCache(res);
});
test('cookies with widened domain or missing protections rejected', async () => {
  for (const attr of ['Path=/; HttpOnly; SameSite=Lax', 'Path=/; Secure; SameSite=Lax',
    'Path=/; Secure; HttpOnly; SameSite=Lax; Domain=adult-asa.org']) {
    const handle = createHandler({ fetchImpl: async () => new Response(null, { status: 302, headers: { Location: '/control/', 'Set-Cookie': '__Host-rexy_console=' + nonce + '; ' + attr } }) });
    assert.equal((await handle(request('/control/login'), env)).status, 502);
  }
});
test('logout validates Origin and CSRF header before forwarding', async () => {
  const handle = createHandler({ fetchImpl: failFetch });
  for (const h of [{}, { ...headers, Origin: 'https://evil.invalid' }, { ...headers, 'X-CSRF-Token': '' }]) {
    assert.equal((await handle(request('/control/api/logout', { method: 'POST', headers: h, body: '{}' }), env)).status, 403);
  }
});
test('logout preserves exact Origin and CSRF for backend session-bound validation', async () => {
  const handle = createHandler({ fetchImpl: async (url, opts) => {
    assert.equal(url, BACKEND + '/control/api/logout'); assert.equal(opts.method, 'POST');
    assert.equal(opts.headers.get('Origin'), CANONICAL); assert.equal(opts.headers.get('X-CSRF-Token'), nonce);
    assert.equal(new TextDecoder().decode(opts.body), '{}'); return new Response(null, { status: 204 });
  } });
  const res = await handle(request('/control/api/logout', { method: 'POST', headers, body: '{}' }), env);
  assert.equal(res.status, 204); assert.equal(await res.text(), ''); noCache(res);
});
test('oversized logout bodies are rejected without upstream access', async () => {
  const handle = createHandler({ fetchImpl: failFetch });
  assert.equal((await handle(request('/control/api/logout', { method: 'POST', headers, body: 'x'.repeat(1025) }), env)).status, 502);
});
test('public status projects only aggregate fields and does not forward cookies', async () => {
  const handle = createHandler({ now: () => Date.parse('2026-10-15T20:01:00Z'), fetchImpl: async (_, opts) => {
    assert.equal(opts.headers.get('Cookie'), null); assert.equal(opts.headers.get('Authorization'), null); return json(sample);
  } });
  const res = await handle(request('/api/status', { headers }), env); const raw = await res.text();
  assert.equal(res.status, 200); noCache(res);
  for (const value of ['not-for-public', 'internal.invalid', 'do-not-forward', 'playerNames', 'rconPassword']) assert.ok(!raw.includes(value));
  const body = JSON.parse(raw); assert.equal(body.totalOnline, 2); assert.equal(body.servers[0].players, 2); assert.equal(body.freshness, 'recent');
});
test('Limited and Legacy remain separate; source-cluster conflicts fail closed', async () => {
  const handle = createHandler({ fetchImpl: async () => json(sample) });
  assert.equal((await handle(request('/api/status/limited'), env)).status, 502);
  const limited = createHandler({ fetchImpl: async url => { assert.equal(url, BACKEND + '/api/status/limited'); return json({ ...sample, cluster: 'limited' }); } });
  assert.equal((await (await limited(request('/api/status/limited'), env)).json()).cluster, 'limited');
});
test('fresh response cannot disguise stale/missing/future source timestamps', () => {
  assert.equal(projectStatus(sample, 'legacy', Date.parse('2026-10-15T22:00:00Z')).freshness, 'stale');
  for (const updatedAt of [null, 'invalid', '2040-01-01T00:00:00Z']) {
    const result = projectStatus({ ...sample, updatedAt }, 'legacy'); assert.equal(result.updatedAt, null); assert.equal(result.freshness, 'unknown');
  }
  assert.equal(projectStatus({ ...sample, servers: [{ name: 'X' }] }, 'legacy').servers[0].players, null);
});
test('malformed JSON, HTML fallbacks and oversized provider responses rejected', async () => {
  for (const res of [new Response('<html>homepage</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('{', { headers: { 'Content-Type': 'application/json' } }), json({ ...sample, servers: [] }, 429),
    new Response('x'.repeat(1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } })]) {
    const handle = createHandler({ fetchImpl: async () => res }); assert.equal((await handle(request('/api/status'), env)).status, 502);
  }
});
test('private API HTML fallback is never returned as authenticated JSON', async () => {
  const handle = createHandler({ fetchImpl: async () => new Response('<html>home</html>') });
  assert.equal((await handle(request('/control/api/me'), env)).status, 502);
});
test('network errors and timeouts are bounded and reveal no provider internals', async () => {
  for (const fetchImpl of [async () => { throw Error('private provider stack'); }, async (_, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(Error('timeout'))))]) {
    const handle = createHandler({ timeoutMs: 20, fetchImpl });
    const res = await handle(request('/control/api/me'), env); assert.equal(res.status, 502); assert.equal(await res.text(), '{"error":"UPSTREAM_UNAVAILABLE"}');
  }
});
test('slow response stream is cancelled at the request deadline', async () => {
  let cancelled = false;
  const handle = createHandler({ timeoutMs: 20, fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'application/json' } }) });
  assert.equal((await handle(request('/api/status'), env)).status, 502); assert.equal(cancelled, true);
});
test('HEAD requests are bodyless while preserving status and protections', async () => {
  const handle = createHandler({ fetchImpl: async () => json(sample) });
  const res = await handle(request('/api/status', { method: 'HEAD' }), env); assert.equal(res.status, 200); assert.equal(await res.text(), ''); noCache(res);
});
test('missing static binding is an explicit service error, not homepage fallback', async () => {
  assert.equal((await createHandler({ fetchImpl: failFetch })(request('/admin'), {})).status, 503);
});
test('gateway contains a real canonical Discord login and no password/localStorage mechanism', () => {
  const html = fs.readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
  assert.match(html, /href="https:\/\/adult-asa.org\/control\/login"/);
  assert.doesNotMatch(html, /localStorage|type="password"|<script|client_secret/i);
});
test('Workers configuration invokes route guard before assets', () => {
  const cfg = JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(cfg.main, '_worker.js'); assert.equal(cfg.assets.run_worker_first, true); assert.equal(cfg.assets.binding, 'ASSETS');
  assert.equal(cfg.assets.not_found_handling, 'none');
});

test('Pages clean-URL asset redirects are resolved internally without route loops', async () => {
  let calls = [];
  const assets = { ASSETS: { fetch: async req => {
    const p = new URL(req.url).pathname; calls.push(p);
    if (p === '/admin.html') return new Response(null, {status: 308, headers: {Location: '/admin'}});
    return new Response('Login page', {headers: {'Content-Type':'text/html'}});
  } } };
  const res = await createHandler({fetchImpl:failFetch})(request('/admin'), assets);
  assert.equal(res.status, 200); assert.equal(await res.text(), 'Login page');
  assert.deepEqual(calls, ['/admin.html', '/admin']);
});
test('asset redirects cannot turn into arbitrary external requests', async () => {
  const assets = { ASSETS: { fetch: async () => new Response(null, {status: 302, headers: {Location: 'https://evil.invalid'}}) } };
  assert.equal((await createHandler({fetchImpl:failFetch})(request('/admin'), assets)).status, 502);
});

test('Discord RFC 9207 issuer is accepted and passed unchanged to the C0 callback', async () => {
  const query = '?code=fixture-code&state=' + nonce + '&iss=https%3A%2F%2Fdiscord.com';
  let calls = 0;
  const handle = createHandler({ fetchImpl: async (url, opts) => {
    calls++;
    assert.equal(url, BACKEND + '/control/oauth/callback' + query);
    assert.equal(opts.redirect, 'manual');
    assert.equal(opts.headers.get('Cookie'), '__Host-rexy_oauth=' + nonce);
    return new Response('Authentication rejected', { status: 403, headers: { 'Content-Type': 'text/plain' } });
  } });
  const response = await handle(request('/control/oauth/callback' + query, { headers: { Cookie: '__Host-rexy_oauth=' + nonce } }), env);
  assert.equal(response.status, 403);
  assert.equal(calls, 1);
  noCache(response);
});

test('OAuth error callback may also contain the exact Discord issuer', async () => {
  const query = '?error=access_denied&state=' + nonce + '&iss=https%3A%2F%2Fdiscord.com';
  let calls = 0;
  const handle = createHandler({ fetchImpl: async (url) => {
    calls++;
    assert.equal(url, BACKEND + '/control/oauth/callback' + query);
    return new Response('Authentication rejected', { status: 403, headers: { 'Content-Type': 'text/plain' } });
  } });
  const response = await handle(request('/control/oauth/callback' + query), env);
  assert.equal(response.status, 403);
  assert.equal(calls, 1);
});

test('unknown, spoofed, malformed and duplicate OAuth issuers are rejected before upstream', async () => {
  const base = '?code=fixture-code&state=' + nonce + '&iss=';
  const badIssuers = [
    'https://evil.invalid', 'http://discord.com', 'https://discord.com/',
    'https://discord.com.evil.invalid', 'https://discord.com@evil.invalid',
    'https://DISCORD.com', 'https://discord.com?extra=1', '',
    'https://discord.com\nadmin',
  ];
  const handle = createHandler({ fetchImpl: failFetch });
  for (const issuer of badIssuers) {
    const path = '/control/oauth/callback' + base + encodeURIComponent(issuer);
    assert.equal((await handle(request(path), env)).status, 400, path);
  }
  const discord = encodeURIComponent('https://discord.com');
  for (const path of [
    '/control/oauth/callback' + base + discord + '&iss=' + discord,
    '/control/oauth/callback' + base + discord + '&unexpected=true',
    '/control/oauth/callback' + base + discord + '&state=' + nonce,
    '/control/login?iss=' + discord,
    '/control/api/me?iss=' + discord,
    '/api/status?iss=' + discord,
  ]) {
    assert.equal((await handle(request(path), env)).status, 400, path);
  }
});

