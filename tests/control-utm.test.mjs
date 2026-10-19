import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,RELEASE,CANONICAL,BACKEND} from '../_worker.js';

const noUpstream=async()=>{throw Error('Blocked: marketing query must not hit private backend');};
const request=(path,options={},origin=CANONICAL)=>new Request(origin+path,options);
const env={ASSETS:{fetch:async()=>{throw Error('No static asset should resolve a private command-center route');}}};
function noStore(r) {
  for(const name of ['Cache-Control','CDN-Cache-Control','Cloudflare-CDN-Cache-Control'])
    assert.match(r.headers.get(name)||'',/no-store/);
  assert.equal(r.headers.get('Access-Control-Allow-Credentials'),null);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal(r.headers.get('X-Adult-ASA-Release'),RELEASE);
  assert.equal(r.headers.get('Referrer-Policy'),'no-referrer');
}
test('ChatGPT appended utm_source on Command Center redirects to clean exact URL without proxying or cookies',async()=>{
  let upstream=0;
  const handler=createHandler({fetchImpl:async()=>{upstream++;throw Error('Do not forward');}});
  const response=await handler(request('/control/?utm_source=chatgpt.com'),env);
  assert.equal(response.status,302);
  assert.equal(response.headers.get('Location'),'/control/');
  assert.equal(response.headers.get('Set-Cookie'),null);
  assert.equal(await response.text(),'');
  assert.equal(upstream,0);
  noStore(response);
});
test('clean redirected Command Center path still uses the existing private backend and its 401 login behavior',async()=>{
  let count=0;
  const handler=createHandler({fetchImpl:async(url,opts)=>{
    count++;
    assert.equal(url,BACKEND+'/control/');
    assert.equal(opts.method,'GET');
    return new Response(null,{status:302,headers:{Location:'/control/login'}});
  }});
  const r=await handler(request('/control/'),env);
  assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'/control/login');
  assert.equal(count,1);noStore(r);
});
test('ChatGPT and normal UTM campaign tags are removed on both landing and login',async()=>{
  const handler=createHandler({fetchImpl:noUpstream});
  const paths=[
    '/control/?utm_source=chatgpt.com&utm_medium=referral',
    '/control/?utm_source=chatgpt.com&utm_medium=referral&utm_campaign=beacon_app',
    '/control/?utm_medium=chat&utm_term=game-masters&utm_content=admin_panel',
    '/control/login?utm_source=chatgpt.com',
    '/control/login?utm_campaign=asa-public-website',
    '/control?utm_source=chatgpt.com',
  ];
  for(const path of paths) {
    const res=await handler(request(path),env);
    const destination=path.startsWith('/control/login')?'/control/login':'/control/';
    assert.equal(res.status,302,path);
    assert.equal(res.headers.get('Location'),destination,path);
    noStore(res);
  }
});
test('unparameterized /control alias retains canonical redirect',async()=>{
  const response=await createHandler({fetchImpl:noUpstream})(request('/control'),env);
  assert.equal(response.status,302);assert.equal(response.headers.get('Location'),'/control/');
});
test('HEAD requests return bodyless same-origin stripping redirect',async()=>{
  const handler=createHandler({fetchImpl:noUpstream});
  for(const path of ['/control?utm_source=chatgpt.com','/control/?utm_source=chatgpt.com','/control/login?utm_source=chatgpt.com']){
    const res=await handler(request(path,{method:'HEAD'}),env);
    assert.equal(res.status,302);
    assert.equal(await res.text(),'');
    noStore(res);
  }
});
test('unknown and forged query keys never become open redirect, OAuth or admin authorization',async()=>{
  const handler=createHandler({fetchImpl:noUpstream});
  const bad=[
    '/control/?next=https://evil.invalid',
    '/control/?returnUrl=https://evil.invalid',
    '/control/?redirect_uri=https://evil.invalid',
    '/control/?utm_source=chatgpt.com&next=/control/api/beacon/start',
    '/control/login?state=forged',
    '/control/login?utm_source=chatgpt.com&client_id=1234',
    '/control?utm_source=chatgpt.com&redirect=/',
  ];
  for(const path of bad){
    const res=await handler(request(path),env);
    assert.equal(res.status,400,path);
    noStore(res);
  }
});
test('duplicate, empty, huge, encoded control and invalid UTM values are rejected',async()=>{
  const handler=createHandler({fetchImpl:noUpstream});
  const bad=[
    '/control/?utm_source=chatgpt.com&utm_source=attacker',
    '/control/?utm_source=',
    '/control/?utm_source=chatgpt.com%0Aevil',
    '/control/?utm_source=chatgpt.com%2Fevil',
    '/control/?utm_source='+ 'a'.repeat(129),
    '/control/?utm_source='+ 'a'.repeat(780),
    '/control/?utm_medium=referral&utm_medium=evil',
    '/control/?utm_source=%3Cscript%3E',
  ];
  for(const path of bad)assert.equal((await handler(request(path),env)).status,400,path.slice(0,110));
});
test('marketing parameters remain forbidden on OAuth callback, APIs, Beacon services and script assets',async()=>{
  const handler=createHandler({fetchImpl:noUpstream});
  for(const path of [
    '/control/oauth/callback?code=synthetic&state=synthetic&utm_source=chatgpt.com',
    '/control/api/me?utm_source=chatgpt.com',
    '/control/api/beacon/status?utm_source=chatgpt.com',
    '/control/api/beacon/services?utm_source=chatgpt.com',
    '/control/app.js?utm_source=chatgpt.com',
    '/api/status?utm_source=chatgpt.com',
  ])assert.equal((await handler(request(path),env)).status,400,path);
});
test('marketing queries cannot bypass Beacon POST method or CSRF checks',async()=>{
  const handler=createHandler({fetchImpl:noUpstream});
  const path='/control/api/beacon/start?utm_source=chatgpt.com';
  assert.equal((await handler(request(path,{method:'GET'}),env)).status,405);
  assert.equal((await handler(request(path,{method:'POST',headers:{Origin:CANONICAL,'Content-Type':'application/json','X-CSRF-Token':'A'.repeat(43)},body:'{}'}),env)).status,400);
  assert.equal((await handler(request('/control/?utm_source=chatgpt.com',{method:'POST'}),env)).status,405);
});
test('Cloudflare preview and hostile origins cannot reuse production tagged login',async()=>{
  const handler=createHandler({fetchImpl:noUpstream});
  for(const origin of ['https://evil.invalid','https://preview.adult-asa-website.pages.dev','http://adult-asa.org']){
    for(const path of ['/control/?utm_source=chatgpt.com','/control/login?utm_source=chatgpt.com','/control?utm_source=chatgpt.com']){
      assert.equal((await handler(request(path,{},origin),env)).status,403,origin+path);
    }
  }
});
test('marketing redirect never forwards a valid-looking owner cookie to the upstream provider',async()=>{
  let fetched=false;
  const handler=createHandler({fetchImpl:async()=>{fetched=true;throw Error('No upstream');}});
  const r=await handler(request('/control/?utm_source=chatgpt.com',{
    headers:{Cookie:'__Host-rexy_console='+'B'.repeat(43),Authorization:'Bearer attack'}
  }),env);
  assert.equal(r.status,302);assert.equal(r.headers.get('Set-Cookie'),null);assert.equal(fetched,false);
  assert.equal(r.headers.get('Location'),'/control/');
});
