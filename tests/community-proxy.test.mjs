import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,projectPublicRoster,projectPublicHistory,CANONICAL,BACKEND} from '../_worker.js';

const secret='PRIVATE-PLATFORM-ACCOUNT-ID';
const now='2026-10-21T18:00:00.000Z';
const record=()=>({
  id:'0123456789abcdef01234567',displayName:'ARK Survivor',
  totalHours:11.5,timesJoined:4,firstSeen:'2026-10-18T10:00:00.000Z',
  lastSeen:now,isOnline:true,currentCluster:'limited',currentMap:'Astraeos',
  clustersVisited:['legacy','limited'],sessionCount:2,visitCount:0,transferCount:1,
  platformId:secret,steamId:secret,ip:secret,adminPassword:secret,
});
const roster=()=>({
  schema:'adult-asa.community.v1.roster',state:'RETAINED_GAME_DATA',
  updatedAt:now,page:1,pageSize:40,totalPages:1,totalPlayers:1,
  coverage:{historyComplete:false,limitedAvailability:'recording',legacyFirstRecordedAt:null,
    limited:['Astraeos','Extinction','Genesis','Lost Colony','The Island'].map(map=>({
      map,firstObservedAt:map==='Astraeos'?now:null,lastObservedAt:map==='Astraeos'?now:null,
      reliableScans:map==='Astraeos'?3:0,gapScans:0,host:secret,apiKey:secret}))},
  players:[record()],host:secret,apiKey:secret,
});
const history=()=>({
  schema:'adult-asa.community.v1.history',state:'RETAINED_GAME_DATA',
  updatedAt:now,page:1,pageSize:80,totalPages:1,totalEvents:3,
  player:record(),mapTotals:[{cluster:'legacy',map:'Scorched Earth',visits:1,totalMinutes:42,host:secret}],
  events:[
    {type:'session',occurredAt:'2026-10-19T10:00:00.000Z',endedAt:'2026-10-19T10:42:00.000Z',
      cluster:'legacy',map:'Scorched Earth',durationMinutes:42,rconPassword:secret},
    {type:'session',occurredAt:'2026-10-20T11:00:00.000Z',endedAt:'2026-10-20T11:20:00.000Z',
      cluster:'limited',map:'Astraeos',durationMinutes:20,discordUser:secret},
    {type:'transfer',occurredAt:'2026-10-20T12:00:00.000Z',
      fromCluster:'legacy',fromMap:'Scorched Earth',toCluster:'limited',toMap:'Astraeos',
      inferred:true,accessKey:secret,playerId:secret},
  ],gameSecrets:secret,
});
const json=(value,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{'Content-Type':'application/json'},
});
const req=(path,options={},origin=CANONICAL)=>new Request(origin+path,options);
const env={ASSETS:{fetch:async()=>new Response('asset')}};

test('public roster strips all upstream private/account/provider fields',()=>{
 const row=projectPublicRoster(roster());
 assert.equal(row.totalPlayers,1);
 assert.equal(row.players[0].displayName,'ARK Survivor');
 assert.deepEqual(row.players[0].clustersVisited,['legacy','limited']);
 assert.equal(row.coverage.limited.length,5);
 assert.equal(row.coverage.historyComplete,false);
 assert.deepEqual(Object.keys(row.players[0]).sort(),[
   'id','displayName','totalHours','timesJoined','firstSeen','lastSeen','isOnline',
   'currentCluster','currentMap','clustersVisited','sessionCount','visitCount','transferCount'
 ].sort());
 const encoded=JSON.stringify(row);
 for(const field of [secret,'steamId','platformId','adminPassword','host','apiKey'])
   assert.ok(!encoded.includes(field),field);
});
test('full recorded and inferred transfer timeline passes projection with no raw IDs',()=>{
 const row=projectPublicHistory(history());
 assert.equal(row.totalEvents,3);
 assert.equal(row.events.length,3);
 assert.equal(row.events.at(-1).inferred,true);
 assert.equal(row.events[0].map,'Scorched Earth');
 const encoded=JSON.stringify(row);
 for(const field of [secret,'accessKey','rconPassword','discordUser','playerId'])
   assert.ok(!encoded.includes(field),field);
});
test('schema conflicts, forged verified fields and invalid dates/counts fail closed',()=>{
 const mutants=[
   o=>{o.schema='unsafe';},
   o=>{o.totalPlayers=-1;},
   o=>{o.pageSize=100000;},
   o=>{o.players[0].totalHours='99';},
   o=>{o.players[0].id='secret';},
   o=>{o.players[0].currentCluster='admin';},
   o=>{o.players[0].clustersVisited=['legacy','owner'];},
   o=>{o.players.push({...o.players[0]});},
   o=>{o.updatedAt='2026-90-90T01:00:00.000Z';},
 ];
 for(const mutate of mutants){
  const x=roster();mutate(x);
  assert.throws(()=>projectPublicRoster(x));
 }
 const badHistory=[
  o=>{o.events[2].fromCluster='other';},
  o=>{o.events[1].durationMinutes=-1;},
  o=>{o.mapTotals[0].map='Sensitive Base';},
  o=>{o.events[0].type='admin';},
  o=>{o.totalPages=7;},
 ];
 for(const mutate of badHistory){
   const x=history();mutate(x);
   assert.throws(()=>projectPublicHistory(x));
 }
});
test('canonical public route returns complete sanctioned gameplay projection and no cookies',async()=>{
 let called=0;
 const handler=createHandler({fetchImpl:async(url,options)=>{
  called++;
  assert.equal(url,BACKEND+'/api/community/players?page=1');
  assert.equal(options.method,'GET');
  assert.equal(options.headers.get('Cookie'),null);
  assert.equal(options.headers.get('Authorization'),null);
  return json(roster());
 }});
 const response=await handler(req('/api/community/players?page=1',{
  headers:{Cookie:'private=secret',Authorization:'Bearer malicious'}}),env);
 assert.equal(response.status,200);
 const body=await response.text();
 assert.equal(called,1);
 assert.ok(!body.includes(secret));
 assert.equal(JSON.parse(body).players.length,1);
 assert.match(response.headers.get('Cache-Control')||'',/no-store/);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
test('history page and HEAD method return bounded output without raw upstream fields',async()=>{
 const handler=createHandler({fetchImpl:async(url,options)=>{
  assert.equal(url,BACKEND+'/api/community/players/history?id=0123456789abcdef01234567&page=1');
  assert.equal(options.method,'GET');
  return json(history());
 }});
 const path='/api/community/players/history?id=0123456789abcdef01234567&page=1';
 const response=await handler(req(path),env);
 assert.equal(response.status,200);
 assert.equal((await response.json()).events.length,3);
 const head=await handler(req(path,{method:'HEAD'}),env);
 assert.equal(head.status,200);
 assert.equal(await head.text(),'');
});
test('reject unknown, duplicate, malicious queries, unsafe methods and old raw history routes',async()=>{
 const handler=createHandler({fetchImpl:async()=>{throw Error('Forbidden upstream contact');}});
 for(const p of [
  '/api/community/players?page=0',
  '/api/community/players?page=1000',
  '/api/community/players?page=1&page=2',
  '/api/community/players?token=secret',
  '/api/community/players?cluster=admin',
  '/api/community/players?cluster=limited&cluster=all',
  '/api/community/players/history',
  '/api/community/players/history?id=x',
  '/api/community/players/history?id=0123456789abcdef01234567&role=admin',
 ])assert.equal((await handler(req(p),env)).status,400,p);
 for(const p of ['/api/players','/api/heatmap','/api/tracker','/api/movement',
   '/api/player-profiles/admin','/api/community/private']) {
   assert.equal((await handler(req(p),env)).status,404,p);
 }
 assert.equal((await handler(req('/api/community/players',{method:'POST'}),env)).status,405);
});
test('upstream errors, malformed JSON and HTML fail to private data-safe status',async()=>{
 for(const upstream of [
   json({error:'private-unavailable'},503),
   new Response('<html>server-error</html>',{status:200,headers:{'Content-Type':'text/html'}}),
   new Response('not-json',{status:200,headers:{'Content-Type':'application/json'}}),
 ]) {
  const handler=createHandler({fetchImpl:async()=>upstream});
  const response=await handler(req('/api/community/players'),env);
  assert.equal(response.status,502);
  assert.ok(!(await response.text()).includes(secret));
 }
});

test('server-wide Limited query is forwarded without account identity or cookies',async()=>{
 const handler=createHandler({fetchImpl:async(url,options)=>{
   assert.equal(url,BACKEND+'/api/community/players?page=1&cluster=limited');
   assert.equal(options.headers.get('Cookie'),null);
   return json(roster());
 }});
 const response=await handler(req('/api/community/players?page=1&cluster=limited'),env);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.coverage.limited[0].map,'Astraeos');
 assert.ok(!JSON.stringify(body).includes(secret));
});
test('Limited visit projection is evidence-bounded and raw fields never escape',()=>{
 const x=history();
 x.events[1]={type:'visit',occurredAt:'2026-10-20T11:00:00.000Z',
   endedAt:'2026-10-20T11:20:00.000Z',cluster:'limited',map:'Astraeos',
   durationMinutes:0,evidence:'named-rcon-poll',endedReason:'still_observed',
   actualLogoutConfirmed:false,accessKey:secret,playerId:secret};
 const projection=projectPublicHistory(x);
 assert.equal(projection.events[1].type,'visit');
 assert.equal(projection.events[1].endedReason,'still_observed');
 assert.ok(!JSON.stringify(projection).includes(secret));
 for(const mutation of [
   y=>{y.evidence='caller-defined';},
   y=>{y.actualLogoutConfirmed=true;},
   y=>{y.durationMinutes=20;},
   y=>{y.endedReason='guessed-transfer';},
   y=>{y.cluster='legacy';}
 ]){const bad=history();bad.events[1]={...x.events[1]};mutation(bad.events[1]);
   assert.throws(()=>projectPublicHistory(bad));}
});
test('bad or incomplete coverage never gets a public projection',()=>{
 for(const mutate of [
   x=>{x.coverage.limited.pop();},
   x=>{x.coverage.historyComplete=true;},
   x=>{x.coverage.limited[0].reliableScans=-1;},
   x=>{x.coverage.limited[0].map='Admin Base';},
   x=>{x.coverage.limited[0].lastObservedAt='2026-10-20T00:00:00.000Z';},
   x=>{x.coverage.limitedAvailability='secret';}
 ]){const obj=roster();mutate(obj);assert.throws(()=>projectPublicRoster(obj));}
});
