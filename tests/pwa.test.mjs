import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHandler,CANONICAL} from '../_worker.js';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pages=['index.html','servers.html','mods.html','meet-the-players.html'];
const manifest=JSON.parse(read('app.webmanifest'));
const sw=read('sw.js');
test('public pages expose install metadata while staff login is unchanged',()=>{
 for(const p of pages){
  const h=read(p);
  assert.match(h,/rel="manifest" href="\/app.webmanifest"/);
  assert.match(h,/src="\/assets\/install-app\.js"/);
  assert.match(h,/rel="apple-touch-icon" href="\/assets\/app-192\.png"/);
 }
 assert.doesNotMatch(read('admin.html'),/install-app\.js|app\.webmanifest/);
 assert.equal(manifest.scope,'/');
 assert.equal(manifest.display,'standalone');
 assert.ok(manifest.shortcuts.some(x=>x.url==='/admin'));
 assert.ok(manifest.icons.some(x=>x.sizes==='192x192'));
 assert.ok(fs.statSync(new URL('../assets/app-192.png',import.meta.url)).size>1000);
});
test('offline navigation never intercepts private pages, player data or API routes',()=>{
 assert.match(sw,/req\.mode!=='navigate'/);
 assert.match(sw,/ALLOWED\.has\(u\.pathname\)/);
 assert.match(sw,/!ALLOWED\.has\(u\.pathname\)\|\|u\.search/);
 assert.doesNotMatch(sw,/caches\.open|cache\.put|localStorage|sessionStorage|indexedDB/i);
 assert.doesNotMatch(sw,/\/control\/|\/api\/|\/admin\b|\/assets\/players/i);
 assert.match(sw,/no stale or invented counts/);
 assert.match(read('assets/install-app.js'),/beforeinstallprompt/);
});
test('worker serves install assets as public static only with no-store',async()=>{
 const handle=createHandler({fetchImpl:async()=>{throw Error('must not proxy')}});
 const env={ASSETS:{fetch:async req=>new Response('asset:'+new URL(req.url).pathname,{status:200})}};
 for(const [p,type] of [['/app.webmanifest','application/manifest+json'],['/sw.js','application/javascript'],['/assets/install-app.js',null],['/assets/app-192.png','image/png']]){
  const r=await handle(new Request(CANONICAL+p),env);
  assert.equal(r.status,200,p);
  assert.match(r.headers.get('Cache-Control'),/no-store/);
  if(type)assert.match(r.headers.get('Content-Type'),new RegExp(type.replace('+','\\+')));
 }
 const swr=await handle(new Request(CANONICAL+'/sw.js'),env);
 assert.equal(swr.headers.get('Service-Worker-Allowed'),'/');
 for(const p of ['/api/players','/control/api/recover','/rexy-ai.js']){
  const r=await handle(new Request(CANONICAL+p),env);
  assert.equal(r.status,404,p);
 }
});
