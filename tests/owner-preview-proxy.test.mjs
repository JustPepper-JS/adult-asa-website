import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,projectOwnerHostPreview,CANONICAL,BACKEND} from '../_worker.js';

const nonce='A'.repeat(43);
const record=()=>({
  state:'CORROBORATION_ONLY',readOnly:true,verifiedMappings:0,
  candidateCount:15,reportedHostEqualCount:1,observedAt:'2026-10-21T17:00:00.000Z',
  providerAccessKey:'private-secret',
  slots:Array.from({length:15},(_,i)=>({
    slot:i<10?'legacy:fixture '+i:'limited:fixture '+i,
    addressEvidence:'IP_EQUAL_UNVERIFIED',
    providerReportedIp:'31.214.196.58',
    providerServiceId:'00000000-0000-4000-8000-000000000000',
    playerName:'private-player',
    accessKey:'private-secret',
  })),
});
const request=(path,opts={},origin=CANONICAL)=>new Request(origin+path,opts);
const env={ASSETS:{fetch:async()=>new Response('static asset')}};
const json=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json'},
});
test('only 15 exact owner preview classifications and safe counts cross public gateway',()=>{
  const projected=projectOwnerHostPreview(record());
  assert.deepEqual(Object.keys(projected),
    ['state','readOnly','verifiedMappings','candidateCount','reportedHostEqualCount','observedAt','slots']);
  assert.equal(projected.verifiedMappings,0);
  assert.equal(projected.slots.length,15);
  assert.deepEqual(Object.keys(projected.slots[0]),['slot','addressEvidence']);
  for(const value of ['private-secret','private-player','31.214.196.58','providerReportedIp','providerServiceId'])
    assert.ok(!JSON.stringify(projected).includes(value),value);
});
test('fail closed on bad counts, duplicate slots, non-ISO dates and embedded secrets',()=>{
  const mutators=[
    x=>{x.verifiedMappings=1;},
    x=>{x.candidateCount='accessKey=private-secret';},
    x=>{x.reportedHostEqualCount=16;},
    x=>{x.slots[2].slot=x.slots[1].slot;},
    x=>{x.observedAt='invalid';},
    x=>{x.slots[1].addressEvidence='PHYSICALLY_VERIFIED';},
    x=>{x.slots[1].slot='limited:<script>';},
    x=>{x.slots.push(x.slots[0]);},
    x=>{x.slots=[];},
  ];
  for(const mutate of mutators){
    const x=record();mutate(x);
    const result=projectOwnerHostPreview(x);
    assert.deepEqual(result,{state:'UNVERIFIED',readOnly:true,verifiedMappings:0,slots:[]});
    assert.ok(!JSON.stringify(result).includes('private-secret'));
  }
});
test('canonical session-bound GET forwards exact path and no forged identity headers',async()=>{
  let calls=0;
  const handle=createHandler({fetchImpl:async(url,opts)=>{
    calls++;
    assert.equal(url,BACKEND+'/control/api/beacon/host-preview');
    assert.equal(opts.method,'GET');
    assert.equal(opts.headers.get('Cookie'),'__Host-rexy_console='+nonce);
    assert.equal(opts.headers.get('Authorization'),null);
    assert.equal(opts.headers.get('X-Role'),null);
    return json(record());
  }});
  const res=await handle(request('/control/api/beacon/host-preview',{
    headers:{Cookie:'__Host-rexy_console='+nonce+'; tracking=bad',
      Authorization:'Bearer malicious','X-Role':'owner'}}),env);
  assert.equal(calls,1);assert.equal(res.status,200);
  const txt=await res.text(),out=JSON.parse(txt);
  assert.equal(out.slots.length,15);
  for(const secret of ['private-secret','private-player','31.214.196.58','providerServiceId'])
    assert.ok(!txt.includes(secret),secret);
  assert.match(res.headers.get('Cache-Control'),/no-store/);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'),null);
});
test('unauthenticated and Game Master backend denials remain denials at gateway',async()=>{
  const handle=createHandler({fetchImpl:async(url,opts)=>
    json({error:opts.headers.get('Cookie')?'BEACON_OWNER_CONSENT_REQUIRED':'NOT_AUTHENTICATED'},
      opts.headers.get('Cookie')?403:401)});
  const stranger=await handle(request('/control/api/beacon/host-preview'),env);
  assert.equal(stranger.status,401);
  const gm=await handle(request('/control/api/beacon/host-preview',{
    headers:{Cookie:'__Host-rexy_console='+nonce}}),env);
  assert.equal(gm.status,403);
  assert.equal((await gm.json()).error,'NOT_AUTHORIZED');
});
test('no query forgery, POST, unknown API access, or foreign OAuth origin',async()=>{
  const fail=async()=>{throw Error('must not reach backend');};
  const handle=createHandler({fetchImpl:fail});
  assert.equal((await handle(request('/control/api/beacon/host-preview?role=owner'),env)).status,400);
  assert.equal((await handle(request('/control/api/beacon/host-preview',{method:'POST'}),env)).status,405);
  assert.equal((await handle(request('/api/beacon/host-preview'),env)).status,404);
  assert.equal((await handle(request('/control/api/beacon/host-preview',{},
    'https://preview.invalid'),env)).status,403);
});

test('HEAD returns approved status and security headers without leaking upstream JSON',async()=>{
  let called=0;
  const h=createHandler({fetchImpl:async(_url,options)=>{
    called++;assert.equal(options.method,'GET');return json(record());
  }});
  const res=await h(request('/control/api/beacon/host-preview',{
    method:'HEAD',headers:{Cookie:'__Host-rexy_console='+nonce}}),env);
  assert.equal(res.status,200);assert.equal(await res.text(),'');assert.equal(called,1);
  assert.match(res.headers.get('Content-Type')||'',/application\/json/);
  assert.match(res.headers.get('Cache-Control')||'',/no-store/);
});
