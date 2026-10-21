// W1A: explicit public-to-private routing. Discord authorization remains in AASA.
// This module runs in Cloudflare Pages advanced mode and Workers static assets.
export const RELEASE = 'W1B-control-marketing-query-20261018-r1';
export const CANONICAL = 'https://adult-asa.org';
export const BACKEND = 'https://aasa-discord-bot-v-20-production.up.railway.app';
const COOKIE_NAMES = new Set(['__Host-rexy_console', '__Host-rexy_oauth']);
const PRIVATE_GET = new Set([
  '/control/', '/control/login', '/control/oauth/callback', '/control/app.js',
  '/control/app.css', '/control/app.webmanifest', '/control/icon.svg',
  '/control/api/me', '/control/api/overview', '/control/api/capabilities',
  '/control/api/beacon/status', '/control/api/beacon/services',
  '/control/api/beacon/host-preview',
]);
const BEACON_DEVICE_POST = new Set(['/control/api/beacon/start','/control/api/beacon/poll']);
const COMMUNITY_ROUTES = new Set(['/api/community/players','/api/community/players/history']);
const STATUS_ROUTES = new Map([
  ['/api/status', 'legacy'], ['/api/status/legacy', 'legacy'], ['/api/status/limited', 'limited'],
]);
const PUBLIC_FILES = new Set([
  '/index.html', '/servers.html', '/meet-the-players.html', '/mods.html', '/admin.html', '/gateway.css',
  '/assets/site.css', '/assets/site.js', '/assets/players.css', '/assets/players.js',
  '/assets/players-directory.json', '/assets/icon.svg', '/assets/mod-catalog.json',
  '/robots.txt', '/sitemap.xml',
]);
// Historic public screens included identifiable movement and unused placeholder tools.
// De-link and reject their assets; offer only safe public destinations.
const LEGACY_REDIRECTS = new Map([
  ['/cluster-status.html', '/servers'], ['/movement.html', '/servers'],
  ['/heatmap.html', '/servers'], ['/players.html', '/servers'],
  ['/tracker.html', '/servers'], ['/profile.html', '/servers'],
  ['/profile.fixed.html', '/servers'], ['/link-survivor.html', '/'],
  ['/staff.html', '/'], ['/tribe.html', '/'], ['/boss-roles.html', '/'],
]);
const PUBLIC_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
const ADMIN_ALIASES = new Set(['/admin.html', '/admin/', '/control/admin.html', '/staff-whitelist.html']);
const CSP = "default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const nullBody = status => status === 204 || status === 205 || status === 304;
function secureHeaders(input = {}) {
  const h = new Headers(input);
  h.set('X-Adult-ASA-Release', RELEASE);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'no-referrer');
  h.set('Cache-Control', 'no-store, max-age=0');
  h.set('CDN-Cache-Control', 'no-store');
  h.set('Cloudflare-CDN-Cache-Control', 'no-store');
  h.delete('Access-Control-Allow-Origin');
  h.delete('Access-Control-Allow-Credentials');
  return h;
}
function errorResponse(code, status) {
  return new Response(JSON.stringify({ error: code }), {
    status, headers: secureHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
  });
}
function redirect(path) {
  return new Response(null, { status: 302, headers: secureHeaders({ Location: path }) });
}
export function forwardedCookies(raw = '') {
  if (raw.length > 4096) throw Error('Cookie header too large');
  const seen = new Set(), cookies = [];
  for (const item of raw.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (!COOKIE_NAMES.has(key)) continue;
    if (seen.has(key)) throw Error('Duplicate authentication cookie');
    seen.add(key);
    const value = rest.join('=');
    if (/^[A-Za-z0-9_-]{43}$/.test(value)) cookies.push(key + '=' + value);
  }
  return cookies.join('; ');
}
function responseCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  if (typeof headers.getAll === 'function') return headers.getAll('Set-Cookie');
  if (headers.has('Set-Cookie')) throw Error('Cookie-preserving headers API unavailable');
  return [];
}
async function boundedBytes(body, limit, signal) {
  if (!body) return new Uint8Array();
  const reader = body.getReader(), parts = [];
  let size = 0;
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) throw Error('Deadline exceeded');
    while (true) {
      const { done, value } = await reader.read();
      if (signal?.aborted) throw Error('Deadline exceeded');
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw Error('Body too large'); }
      parts.push(value);
    }
  } finally { signal?.removeEventListener('abort', cancel); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}
function safeLocation(value) {
  const url = new URL(value, CANONICAL);
  if (url.username || url.password || url.hash) throw Error('Invalid redirect');
  if (url.origin === CANONICAL && ['/control/', '/control/login'].includes(url.pathname) && !url.search) {
    return url.pathname;
  }
  if (url.origin === 'https://discord.com' && url.pathname === '/oauth2/authorize' &&
      url.searchParams.get('client_id') === '1450621944360603820' &&
      url.searchParams.get('redirect_uri') === CANONICAL + '/control/oauth/callback' &&
      url.searchParams.get('response_type') === 'code' && url.searchParams.get('scope') === 'identify' &&
      /^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('state') || '') &&
      [...url.searchParams.keys()].length === 5) return url.href;
  throw Error('Unexpected authentication redirect');
}
// External links may append analytics parameters to the private landing
// page. Strip only standard, bounded UTM tags with a SAME-ORIGIN redirect.
// OAuth callbacks, APIs, login state, and credentials continue to reject all
// non-protocol query keys. This never forwards the tag to the AASA backend.
const TRACKING_KEYS = new Set([
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
]);
const TRACKING_ENTRY = /^[A-Za-z0-9._~-]{1,128}$/;
function isRemovableTrackingQuery(url) {
  if (!url.search || url.search.length > 768) return false;
  const seen = new Set();
  for (const [key,value] of url.searchParams) {
    if (!TRACKING_KEYS.has(key) || seen.has(key) || !TRACKING_ENTRY.test(value)) return false;
    seen.add(key);
  }
  return seen.size >= 1 && seen.size <= TRACKING_KEYS.size;
}
function validCommunityQuery(url){
  if(url.search.length>220)return false;
  const history=url.pathname==='/api/community/players/history';
  const allowed=new Set(history?['id','page']:['page','q']);
  const seen=new Set();
  for(const [key,value] of url.searchParams){
    if(!allowed.has(key)||seen.has(key))return false;
    seen.add(key);
    if(key==='page'&&!/^[1-9][0-9]{0,2}$/.test(value))return false;
    if(key==='id'&&!/^[0-9a-f]{24}$/.test(value))return false;
    if(key==='q'&&(value.length>50||/[\x00-\x1f\x7f<>]/.test(value)))return false;
  }
  return !history||seen.has('id');
}
function validQuery(url) {
  if(COMMUNITY_ROUTES.has(url.pathname))return validCommunityQuery(url);
  if (!url.search) return true;
  if (url.pathname !== '/control/oauth/callback') return false;
  const allowed = new Set(['state', 'code', 'error', 'error_description', 'iss']);
  const seen = new Set();
  for (const [key, value] of url.searchParams) {
    if (!allowed.has(key) || seen.has(key) || value.length > 2048) return false;
    seen.add(key);
    // RFC 9207 issuer identification: Discord supplies this parameter on its
    // authorization callback. Accept only the exact expected issuer.
    if (key === 'iss' && value !== 'https://discord.com') return false;
  }
  return true;
}
const text = (value, max = 100) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, max) : '';
const count = value => Number.isInteger(value) && value >= 0 && value <= 10000 ? value : null;
export function projectStatus(raw, cluster, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || raw.cluster !== cluster || !Array.isArray(raw.servers) || raw.servers.length > 25) {
    throw Error('Invalid status response');
  }
  const sourceTime = typeof raw.updatedAt === 'string' ? Date.parse(raw.updatedAt) : NaN;
  const timestampValid = Number.isFinite(sourceTime) && sourceTime <= now + 30000;
  return {
    cluster, clusterName: cluster === 'legacy' ? 'Adult ASA Legacy' : 'Adult ASA Limited',
    totalOnline: count(raw.totalOnline), updatedAt: timestampValid ? new Date(sourceTime).toISOString() : null,
    fetchedAt: new Date(now).toISOString(),
    freshness: !timestampValid ? 'unknown' : now - sourceTime > 180000 ? 'stale' : 'recent',
    servers: raw.servers.map(row => ({
      name: text(row?.name), map: text(row?.map),
      online: typeof row?.online === 'boolean' ? row.online : null,
      players: count(row?.players), maxPlayers: count(row?.maxPlayers), version: text(row?.version, 30) || null,
    })),
  };
}
// A second, independent Cloudflare security projection for B3-8c owner data.
// No upstream address, UUID, AccessKey, player name or arbitrary property leaves
// this bridge, even when the backend provider response is accidentally broader.
export function projectOwnerHostPreview(raw) {
  const hidden={state:'UNVERIFIED',readOnly:true,verifiedMappings:0,slots:[]};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
     raw.state!=='CORROBORATION_ONLY'||raw.verifiedMappings!==0||
     !Array.isArray(raw.slots)||raw.slots.length!==15||
     !Number.isInteger(raw.candidateCount)||raw.candidateCount<0||raw.candidateCount>15||
     !Number.isInteger(raw.reportedHostEqualCount)||raw.reportedHostEqualCount<0||
     raw.reportedHostEqualCount>raw.candidateCount||
     typeof raw.observedAt!=='string'||
     !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw.observedAt)||
     !Number.isFinite(Date.parse(raw.observedAt)))return hidden;
  const outcome=new Set([
    'IP_EQUAL_UNVERIFIED','IP_DIFFERENT_UNVERIFIED',
    'PROVIDER_IP_UNAVAILABLE','UNSUPPORTED_PROVIDER_ADDRESS',
    'SHARED_IP_AMBIGUOUS','NO_NAME_CANDIDATE',
  ]);
  const seen=new Set(),slots=[];
  for(const item of raw.slots){
    if(!item||typeof item!=='object'||Array.isArray(item)||
       typeof item.slot!=='string'||!(/^(legacy|limited):[a-z0-9 &'()/-]{1,70}$/.test(item.slot))||
       seen.has(item.slot)||!outcome.has(item.addressEvidence))
      return hidden;
    seen.add(item.slot);
    slots.push({slot:item.slot,addressEvidence:item.addressEvidence});
  }
  return {state:'CORROBORATION_ONLY',readOnly:true,verifiedMappings:0,
    candidateCount:raw.candidateCount,reportedHostEqualCount:raw.reportedHostEqualCount,
    observedAt:raw.observedAt,slots};
}

// Public ARK gameplay only. Re-project every backend field at the Cloudflare
// boundary; raw /api/players, /api/heatmap and platform/account data stay closed.
const CLUSTERS=new Set(['legacy','limited','unknown']);
const VALID_MAPS=new Set(['The Island','Scorched Earth','Aberration','Extinction',
  'Genesis','Valguero','Ragnarok','The Center','Astraeos','Lost Colony','Unknown']);
function safeIso(value){
  if(value===null)return null;
  return typeof value==='string'&&/^(?:20\d{2})-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&
    Number.isFinite(Date.parse(value))?value:undefined;
}
function intWithin(value,max=1e7){return Number.isInteger(value)&&value>=0&&value<=max;}
function publicName(name){return typeof name==='string'&&name.length>=1&&name.length<=80&&
  !/[\x00-\x1f\x7f<>]/.test(name);}
function publicMap(c,m){return CLUSTERS.has(c)&&VALID_MAPS.has(m);}
function projectPlayer(row){
  if(!row||typeof row!=='object'||!publicName(row.displayName)||
    !/^[0-9a-f]{24}$/.test(row.id)||
    !Number.isFinite(row.totalHours)||row.totalHours<0||row.totalHours>1e8||
    !intWithin(row.timesJoined)||!intWithin(row.sessionCount)||!intWithin(row.transferCount)||
    !Array.isArray(row.clustersVisited)||row.clustersVisited.length>2||
    row.clustersVisited.some(c=>!['legacy','limited'].includes(c))||
    typeof row.isOnline!=='boolean'||safeIso(row.firstSeen)===undefined||
    safeIso(row.lastSeen)===undefined||
    !(row.currentCluster===null&&row.currentMap===null) &&
    !publicMap(row.currentCluster,row.currentMap))
    throw Error('Untrusted player summary');
  return {id:row.id,displayName:row.displayName,totalHours:row.totalHours,
    timesJoined:row.timesJoined,firstSeen:row.firstSeen,lastSeen:row.lastSeen,
    isOnline:row.isOnline,currentCluster:row.currentCluster,currentMap:row.currentMap,
    clustersVisited:[...new Set(row.clustersVisited)],sessionCount:row.sessionCount,transferCount:row.transferCount};
}
export function projectPublicRoster(raw){
  if(!raw||typeof raw!=='object'||raw.schema!=='adult-asa.community.v1.roster'||
    raw.state!=='RETAINED_GAME_DATA'||safeIso(raw.updatedAt)===undefined||
    !intWithin(raw.totalPlayers,20000)||!intWithin(raw.totalPages,1000)||
    !intWithin(raw.page,1000)||raw.page<1||raw.pageSize!==40||
    !Array.isArray(raw.players)||raw.players.length>40)
      throw Error('Invalid public player roster');
  const ids=new Set(),players=raw.players.map(row=>{
    const p=projectPlayer(row);
    if(ids.has(p.id))throw Error('Duplicate public player ID');
    ids.add(p.id);return p;
  });
  if(players.length>raw.totalPlayers||raw.totalPages!==Math.ceil(raw.totalPlayers/40))
    throw Error('Inconsistent roster totals');
  return {schema:'adult-asa.community.v1.roster',state:'RETAINED_GAME_DATA',
    updatedAt:raw.updatedAt,totalPlayers:raw.totalPlayers,page:raw.page,
    pageSize:40,totalPages:raw.totalPages,players};
}
export function projectPublicHistory(raw){
  if(!raw||typeof raw!=='object'||raw.schema!=='adult-asa.community.v1.history'||
    raw.state!=='RETAINED_GAME_DATA'||safeIso(raw.updatedAt)===undefined||
    !intWithin(raw.totalEvents,1000000)||!intWithin(raw.totalPages,12500)||
    !intWithin(raw.page,1000)||raw.page<1||raw.pageSize!==80||
    !Array.isArray(raw.events)||raw.events.length>80||
    !Array.isArray(raw.mapTotals)||raw.mapTotals.length>16)
    throw Error('Invalid public player history');
  const player=projectPlayer(raw.player);
  const mapTotals=raw.mapTotals.map(x=>{
    if(!x||!publicMap(x.cluster,x.map)||!intWithin(x.visits)||!intWithin(x.totalMinutes,1e9))
      throw Error('Invalid map history');
    return {cluster:x.cluster,map:x.map,visits:x.visits,totalMinutes:x.totalMinutes};
  });
  const events=raw.events.map(x=>{
    if(!x||safeIso(x.occurredAt)===undefined)return (()=>{throw Error('Invalid observed event')})();
    if(x.type==='session'){
      if(!publicMap(x.cluster,x.map)||safeIso(x.endedAt)===undefined||
        !intWithin(x.durationMinutes,1e7))throw Error('Invalid session event');
      return {type:'session',occurredAt:x.occurredAt,endedAt:x.endedAt,
        cluster:x.cluster,map:x.map,durationMinutes:x.durationMinutes};
    }
    if(x.type==='transfer'&&publicMap(x.fromCluster,x.fromMap)&&
       publicMap(x.toCluster,x.toMap)&&typeof x.inferred==='boolean')
      return {type:'transfer',occurredAt:x.occurredAt,
        fromCluster:x.fromCluster,fromMap:x.fromMap,toCluster:x.toCluster,
        toMap:x.toMap,inferred:x.inferred};
    throw Error('Invalid transfer event');
  });
  if(raw.totalPages!==Math.ceil(raw.totalEvents/80)||events.length>raw.totalEvents)
    throw Error('Inconsistent history totals');
  return {schema:'adult-asa.community.v1.history',state:'RETAINED_GAME_DATA',
    updatedAt:raw.updatedAt,player,totalEvents:raw.totalEvents,
    page:raw.page,pageSize:80,totalPages:raw.totalPages,mapTotals,events};
}

export function createHandler({ fetchImpl = globalThis.fetch, timeoutMs = 12000, now = Date.now } = {}) {
  return async function handle(request, env) {
    const url = new URL(request.url), pathname = url.pathname;
    if (request.url.length > 8192 || /[%\\]/.test(pathname) || pathname.includes('//')) return errorResponse('INVALID_PATH', 400);
    const isControl = pathname === '/control' || pathname.startsWith('/control/');
    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    if (ADMIN_ALIASES.has(pathname)) {
      return request.method === 'GET' || request.method === 'HEAD' ? redirect('/admin') : errorResponse('METHOD_NOT_ALLOWED', 405);
    }
    if (pathname === '/control') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return errorResponse('METHOD_NOT_ALLOWED', 405);
      if (url.origin !== CANONICAL) return errorResponse('USE_CANONICAL_LOGIN', 403);
      return !url.search || isRemovableTrackingQuery(url) ? redirect('/control/') : errorResponse('INVALID_QUERY', 400);
    }
    if (isControl || isApi) {
      if (isControl && url.origin !== CANONICAL) return errorResponse('USE_CANONICAL_LOGIN', 403);
      const isStatus = STATUS_ROUTES.has(pathname);
      const isCommunity = COMMUNITY_ROUTES.has(pathname);
      const isLogout = pathname === '/control/api/logout';
      const isDevicePost = BEACON_DEVICE_POST.has(pathname);
      const isMutation = isLogout || isDevicePost;
      if (!isStatus && !isCommunity && !PRIVATE_GET.has(pathname) && !isMutation) return errorResponse('NOT_FOUND', 404);
      const methodOK = isMutation ? request.method === 'POST' : ['GET', 'HEAD'].includes(request.method);
      if (!methodOK) return errorResponse('METHOD_NOT_ALLOWED', 405);
      if (url.search && (pathname === '/control/' || pathname === '/control/login') &&
          isRemovableTrackingQuery(url)) {
        // Browser receives a no-store, relative redirect to the exact
        // canonical endpoint. No tracking parameters reach OAuth or APIs.
        return redirect(pathname);
      }
      if (!validQuery(url)) return errorResponse('INVALID_QUERY', 400);
      if (isMutation && (request.headers.get('Origin') !== CANONICAL ||
          !/^[A-Za-z0-9_-]{43}$/.test(request.headers.get('X-CSRF-Token') || '') ||
          !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')))
        return errorResponse('CSRF_DENIED', 403);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const headers = new Headers({ Accept: isStatus || pathname.includes('/api/') ? 'application/json' : '*/*' });
        if (isControl) {
          const cookies = forwardedCookies(request.headers.get('Cookie') || '');
          if (cookies) headers.set('Cookie', cookies);
          if (isMutation) {
            headers.set('Origin', CANONICAL);
            headers.set('X-CSRF-Token', request.headers.get('X-CSRF-Token'));
            headers.set('Content-Type', 'application/json');
          }
        }
        const body = isMutation ? await boundedBytes(request.body, 1024, controller.signal) : undefined;
        const upstream = await fetchImpl(BACKEND + pathname + url.search, {
          method: isStatus || pathname === '/control/api/beacon/host-preview' ? 'GET' : request.method, headers, body, redirect: 'manual',
          signal: controller.signal, cf: { cacheTtl: 0, cacheEverything: false },
        });
        const bytes = await boundedBytes(upstream.body, 1024 * 1024, controller.signal);
        if(pathname==='/control/api/beacon/host-preview'){
          if(upstream.status===401||upstream.status===403)
            return errorResponse('NOT_AUTHORIZED',upstream.status);
          if(upstream.status!==200||!/^\s*application\/json\b/i.test(upstream.headers.get('Content-Type')||''))
            return errorResponse('UPSTREAM_UNAVAILABLE',502);
          const safe=projectOwnerHostPreview(JSON.parse(new TextDecoder().decode(bytes)));
          return new Response(request.method==='HEAD'?null:JSON.stringify(safe),{
            status:200,headers:secureHeaders({'Content-Type':'application/json; charset=utf-8'}),
          });
        }
        if(isCommunity){
          if(upstream.status===400)return errorResponse('INVALID_QUERY',400);
          if(upstream.status===404)return errorResponse('NOT_FOUND',404);
          if(upstream.status!==200||!/^application\/json\b/i.test(upstream.headers.get('Content-Type')||''))
            return errorResponse('UPSTREAM_UNAVAILABLE',502);
          const raw=JSON.parse(new TextDecoder().decode(bytes));
          const projected=pathname==='/api/community/players'?
            projectPublicRoster(raw):projectPublicHistory(raw);
          return new Response(request.method==='HEAD'?null:JSON.stringify(projected),{
            status:200,headers:secureHeaders({'Content-Type':'application/json; charset=utf-8'}),
          });
        }
        if (isStatus) {
          if (upstream.status !== 200 || !/^application\/json\b/i.test(upstream.headers.get('Content-Type') || '')) throw Error('Status unavailable');
          const projected = projectStatus(JSON.parse(new TextDecoder().decode(bytes)), STATUS_ROUTES.get(pathname), now());
          return new Response(request.method === 'HEAD' ? null : JSON.stringify(projected), {
            headers: secureHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
          });
        }
        if (pathname.includes('/api/') && !nullBody(upstream.status) &&
            !/^application\/json\b/i.test(upstream.headers.get('Content-Type') || '')) throw Error('Unexpected API response');
        const output = secureHeaders();
        for (const name of ['Content-Type', 'Content-Security-Policy', 'Retry-After']) {
          const value = upstream.headers.get(name); if (value) output.set(name, value);
        }
        if (upstream.headers.has('Location')) output.set('Location', safeLocation(upstream.headers.get('Location')));
        for (const cookie of responseCookies(upstream.headers)) {
          if (!COOKIE_NAMES.has(cookie.split('=')[0]) || /;\s*Domain=/i.test(cookie) ||
              !/;\s*Secure(?:;|$)/i.test(cookie) || !/;\s*HttpOnly(?:;|$)/i.test(cookie) ||
              !/;\s*Path=\/(?:;|$)/i.test(cookie) || !/;\s*SameSite=Lax(?:;|$)/i.test(cookie)) throw Error('Unsafe session cookie');
          output.append('Set-Cookie', cookie);
        }
        return new Response(request.method === 'HEAD' || nullBody(upstream.status) ? null : bytes, { status: upstream.status, headers: output });
      } catch (_) {
        return errorResponse('UPSTREAM_UNAVAILABLE', 502);
      } finally { clearTimeout(timer); }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return errorResponse('METHOD_NOT_ALLOWED', 405);
    if (LEGACY_REDIRECTS.has(pathname)) return redirect(LEGACY_REDIRECTS.get(pathname));
    const file = pathname === '/' ? '/index.html' : pathname === '/admin' ? '/admin.html'
      : pathname === '/servers' ? '/servers.html' : pathname === '/meet-the-players' ? '/meet-the-players.html'
      : pathname === '/mods' ? '/mods.html' : pathname;
    if (!PUBLIC_FILES.has(file)) return errorResponse('NOT_FOUND', 404);
    try {
      const assetURL = new URL(file, url.origin);
      let response = await env.ASSETS.fetch(new Request(assetURL, { method: request.method }));
      // Pages canonicalizes file.html to /file; Workers uses exact files.
      if ([301, 302, 307, 308].includes(response.status) && response.headers.has('Location')) {
        const target = new URL(response.headers.get('Location'), assetURL);
        const clean = file === '/index.html' ? '/' : file.replace(/\.html$/, '');
        if (target.origin !== assetURL.origin || target.search || target.hash ||
            ![clean, clean + '/'].includes(target.pathname)) return errorResponse('INVALID_ASSET_REDIRECT', 502);
        response = await env.ASSETS.fetch(new Request(target, { method: request.method }));
      }
      if (response.status !== 200) return errorResponse('ASSET_UNAVAILABLE', 404);
      const headers = secureHeaders(response.headers);
      if (file === '/admin.html') { headers.set('Content-Security-Policy', CSP); headers.set('X-Robots-Tag', 'noindex'); }
      else if (['/index.html', '/servers.html', '/meet-the-players.html', '/mods.html'].includes(file)) headers.set('Content-Security-Policy', PUBLIC_CSP);
      return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers });
    } catch (_) { return errorResponse('ASSET_UNAVAILABLE', 503); }
  };
}
const handle = createHandler();
export default { fetch: (request, env) => handle(request, env) };
