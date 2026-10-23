import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {activityDescription} from '../assets/players.js';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('real Meet the Players page promises all retained gameplay events, not opt-in publication',()=>{
  const h=read('meet-the-players.html');
  assert.match(h,/Meet the <em>players/);
  assert.match(h,/<span>Stories<\/span>/);
  assert.doesNotMatch(h,/Stories, not surveillance|approved profile|consent|ask staff about sharing|players can choose/i);
  assert.match(h,/retained|recorded/i);
  assert.match(h,/id="player-load-more"/);
  assert.match(h,/id="player-cluster"/);
  assert.match(h,/id="player-search"/);
  assert.match(read('servers.html'),/For recorded in-game player sessions/);
});
test('website only reads independently projected community endpoints, never private legacy player or game APIs',()=>{
  const js=read('assets/players.js');
  assert.match(js,/\/api\/community\/players/);
  assert.match(js,/\/history/);
  assert.match(js,/page:String\(nextPage\)/);
  assert.match(js,/nextPage>=data.totalPages/);
  for(const s of ['/api/players','/api/heatmap','/api/movement','/api/tracker']){
    assert.ok(!js.includes("fetch('"+s));
    assert.ok(!js.includes('fetch("'+s));
  }
  assert.match(js,/credentials:'omit'/);
  assert.doesNotMatch(js,/innerHTML|outerHTML|insertAdjacentHTML|eval\(|localStorage|sessionStorage|document\.cookie/);
  assert.match(js,/textContent/);
  assert.match(js,/inferred by Rexy/);
});
test('transfer and session event format distinguishes inferred moves and maps without provider IDs',()=>{
  const transfer={type:'transfer',fromCluster:'legacy',fromMap:'Scorched Earth',
    toCluster:'limited',toMap:'Astraeos',inferred:true,occurredAt:'2026-10-20T15:00:00.000Z',
    rconPassword:'DO-NOT-RENDER',platformId:'DO-NOT-RENDER'};
  const text=activityDescription(transfer);
  assert.match(text,/Legacy \/ Scorched Earth/);
  assert.match(text,/Limited \/ Astraeos/);
  assert.match(text,/inferred by Rexy/);
  assert.ok(!text.includes('DO-NOT-RENDER'));
  const session=activityDescription({type:'session',cluster:'legacy',map:'Scorched Earth',
    durationMinutes:72,occurredAt:'2026-10-20T10:00:00.000Z',
    endedAt:'2026-10-20T11:12:00.000Z'});
  assert.match(session,/72 min/);
});
test('mobile layouts and history card expansion are accessible with no direct player account information',()=>{
  const css=read('assets/players.css'),html=read('meet-the-players.html'),js=read('assets/players.js');
  assert.match(css,/@media\(max-width:480px\)/);
  assert.match(css,/\.player-more-events/);
  assert.match(js,/aria-expanded/);
  assert.match(js,/replaceChildren/);
  assert.match(html,/Player account identifiers|Account IDs, credentials and base coordinates/i);
  assert.doesNotMatch(html,/Steam ID|EOS ID|RCON_PASSWORD|AdminPassword/);
});

test('W1E Limited observed visits never claim actual session length or logout',()=>{
 const visit=activityDescription({type:'visit',cluster:'limited',map:'Astraeos',
   occurredAt:'2026-10-23T15:00:00.000Z',endedAt:'2026-10-23T15:04:00.000Z',
   endedReason:'coverage_gap',actualLogoutConfirmed:false,durationMinutes:0,
   rconPassword:'DO-NOT-RENDER'});
 assert.match(visit,/Observed map visit: Limited \/ Astraeos/);
 assert.match(visit,/monitoring gap/);
 assert.match(visit,/actual play duration and logout not established/);
 assert.doesNotMatch(visit,/DO-NOT-RENDER/);
 const worker=read('_worker.js');
 assert.match(worker,/x\.type==='visit'/);
 assert.match(worker,/x\.evidence!=='named-rcon-poll'/);
 assert.match(worker,/x\.actualLogoutConfirmed!==false/);
 assert.doesNotMatch(read('assets/players.js'),/document\.cookie|innerHTML/);
});

test('full-roster cluster filtering, independent visit counts and map provenance render in real source',()=>{
 const js=read('assets/players.js'),html=read('meet-the-players.html'),css=read('assets/players.css');
 assert.match(js,/filter\.value!=='all'/);
 assert.match(js,/filter\.addEventListener\('change',\(\)=>load\(true\)\)/);
 assert.doesNotMatch(js,/rows\.filter\(p=>cluster==='all'/);
 assert.match(js,/player\.visitCount/);
 assert.match(js,/historyCoverage\.limited/);
 assert.match(html,/id="player-coverage"/);
 assert.match(css,/\.player-coverage-maps/);
 assert.match(css,/@media\(max-width:390px\)/);
});
test('recent active Limited observation is shown as a visit and not a confirmed login',()=>{
 const visit=activityDescription({type:'visit',cluster:'limited',map:'The Island',
   occurredAt:'2026-10-23T15:00:00.000Z',endedAt:'2026-10-23T15:01:00.000Z',
   endedReason:'still_observed',actualLogoutConfirmed:false,durationMinutes:0});
 assert.match(visit,/Observed map visit/);
 assert.match(visit,/still seen in latest named scan/);
 assert.match(visit,/actual play duration and logout not established/);
});
