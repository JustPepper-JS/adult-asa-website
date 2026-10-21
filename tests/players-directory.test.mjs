import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectPublicDirectory} from '../assets/players.js';

const source=JSON.parse(fs.readFileSync(new URL('../assets/players-directory.json',import.meta.url),'utf8'));
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const approved=()=>({
  schemaVersion:1,publicationState:'approved_profiles',reviewedAt:'2026-10-21',
  profiles:[{
    displayName:'Synthetic Survivor',bio:'Likes building beautiful bases.',
    cluster:'both',
    consent:{profile:true,mapHistory:true,transfers:true,reviewedAt:'2026-10-21'},
    mapHighlights:[{cluster:'legacy',map:'Astraeos',month:'2026-10'}],
    transferHighlights:[{
      fromCluster:'legacy',fromMap:'Astraeos',
      toCluster:'limited',toMap:'The Island',month:'2026-10',
    }],
  }],
});
test('published public directory starts empty and includes no real identities or histories',()=>{
  assert.deepEqual(source,{
    schemaVersion:1,publicationState:'awaiting_verified_player_consent',
    reviewedAt:null,profiles:[],
  });
  const projected=projectPublicDirectory(source);
  assert.equal(projected.state,'EMPTY_OR_UNVERIFIED');
  assert.deepEqual(projected.profiles,[]);
  const code=read('assets/players.js');
  for(const forbidden of ["'/api/players'","'/api/player-profiles/admin'","'/api/movement'","'/api/tracker'"]){
    assert.ok(!code.includes('fetch('+forbidden));
  }
});
test('synthetic opt-in profiles project only safe public fields and month-level stories',()=>{
  const data=projectPublicDirectory(approved());
  assert.equal(data.state,'PUBLISHED_OPT_IN_ONLY');
  assert.equal(data.profiles.length,1);
  assert.deepEqual(Object.keys(data.profiles[0]),
    ['displayName','bio','cluster','mapHighlights','transferHighlights']);
  assert.equal(data.profiles[0].displayName,'Synthetic Survivor');
  assert.equal(data.profiles[0].mapHighlights[0].month,'2026-10');
  assert.ok(Object.isFrozen(data.profiles[0]));
  assert.ok(Object.isFrozen(data.profiles[0].transferHighlights));
  assert.ok(!JSON.stringify(data).includes('consent'));
});
test('no profile is published without explicit reviewed profile consent',()=>{
  for(const mutate of [
    p=>{delete p.consent;},
    p=>{p.consent.profile=false;},
    p=>{p.consent.reviewedAt='invalid';},
    p=>{p.displayName='';},
    p=>{p.cluster='admin';},
    p=>{p.displayName='<img onerror=alert(1)>';},
    p=>{p.bio='\u0000secret';},
    p=>{p.mapHighlights.push({cluster:'legacy',map:'Invalid Map',month:'2026-10'});},
    p=>{p.transferHighlights[0].toCluster='__proto__';},
    p=>{p.mapHighlights[0].month='2026-10-20T09:31:00Z';},
  ]){
    const d=approved();mutate(d.profiles[0]);
    const result=projectPublicDirectory(d);
    assert.equal(result.state,'EMPTY_OR_UNVERIFIED');
    assert.deepEqual(result.profiles,[]);
  }
});
test('map and transfer stories require independent scoped consent',()=>{
  const d=approved();
  d.profiles[0].consent.mapHistory=false;
  assert.equal(projectPublicDirectory(d).state,'EMPTY_OR_UNVERIFIED');
  d.profiles[0].consent.mapHistory=true;
  d.profiles[0].consent.transfers=false;
  assert.equal(projectPublicDirectory(d).state,'EMPTY_OR_UNVERIFIED');
});
test('reject catalog containing raw provider fields or unknown keys even if profile opts in',()=>{
  for(const mutate of [
    d=>{d.players=[{name:'Private Player'}];},
    d=>{d.profiles[0].playerId='private-steam-id';},
    d=>{d.profiles[0].ipAddress='192.0.2.1';},
    d=>{d.profiles[0].currentServer='Live location';},
    d=>{d.profiles[0].consent.adminOverride=true;},
    d=>{d.profiles[0].mapHighlights[0].coordinates='hidden base';},
    d=>{d.profiles[0].transferHighlights[0].timestamp='2026-10-21T09:31:00Z';},
  ]){
    const d=approved();mutate(d);
    const projected=projectPublicDirectory(d);
    assert.equal(projected.state,'EMPTY_OR_UNVERIFIED');
    assert.ok(!JSON.stringify(projected).includes('private-steam-id'));
  }
});
test('bad provenance, mixed data versions, duplicate names or oversized fleet fail closed',()=>{
  for(const mutate of [
    d=>{d.schemaVersion=2;},
    d=>{d.publicationState='awaiting_verified_player_consent';},
    d=>{d.reviewedAt=null;},
    d=>{d.profiles.push({...d.profiles[0],displayName:'synthetic survivor'});},
    d=>{d.profiles=Array.from({length:101},()=>({...d.profiles[0]}));},
  ]){
    const d=approved();mutate(d);
    assert.equal(projectPublicDirectory(d).state,'EMPTY_OR_UNVERIFIED');
  }
});
test('website page explains consent and does not use browser storage or raw tracking',()=>{
  const html=read('meet-the-players.html'),js=read('assets/players.js'),css=read('assets/players.css');
  assert.match(html,/Meet the <em>players/);
  assert.match(html,/player-directory/);
  assert.match(html,/\/assets\/players\.js/);
  assert.match(html,/\/assets\/players\.css/);
  assert.match(html,/private histories remain protected/i);
  assert.match(html,/Join the Discord/);
  assert.match(css,/@media\(max-width:480px\)/);
  assert.match(js,/textContent/);
  assert.doesNotMatch(js,/innerHTML|outerHTML|insertAdjacentHTML|eval\(|localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(js,/fetch\(['"]\/api\/(?:players|heatmap|movement|tracker|sessions)/);
});
