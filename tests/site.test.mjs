import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../',import.meta.url);
const read=(file)=>fs.readFileSync(new URL(file,root),'utf8');
const pages=['index.html','servers.html','mods.html'];
const css=read('assets/site.css'),js=read('assets/site.js'),worker=read('_worker.js');
const siteLinks=(html)=>[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(x=>x[1]);

test('public pages use the same accessible, standalone navigation and stylesheet',()=>{
  for(const page of pages){const html=read(page);
    assert.match(html,/<!doctype html>/i);assert.match(html,/lang="en"/);
    assert.match(html,/href="\/assets\/site.css"/);assert.match(html,/src="\/assets\/site.js"/);
    assert.match(html,/href="\/admin"/);assert.match(html,/href="\/servers"/);
    assert.match(html,/href="\/mods"/);assert.match(html,/Skip to content/);
    assert.match(html,/aria-label="Primary navigation"/);
    assert.doesNotMatch(html,/localStorage|type="password"|onclick=|onload=/i);
    for(const url of siteLinks(html))if(url.startsWith('/')){
      const clean=url.split('?')[0].split('#')[0];if(['','/','/admin','/servers','/mods'].includes(clean))continue;
      assert.ok(fs.existsSync(new URL('.'+clean,root)),page+' references missing asset '+clean);
    }
  }
});
test('no unused pages or individual movements are linked from published navigation',()=>{
  for(const page of pages){const html=read(page);
    assert.doesNotMatch(html,/href="\/(?:heatmap|movement|players|profile|tracker|staff|link-survivor|boss-roles|tribe)(?:\.html)?"/);
    assert.doesNotMatch(html,/Primal Chaos|All Systems Online|7 \/ 7 Admin Tools/i);
  }
});
test('live public JS accesses only approved aggregate status and archived source library',()=>{
  assert.match(js,/fetch\(`\/api\/status\/\$\{cluster\}`/);
  assert.match(js,/fetch\('\/assets\/mod-catalog\.json'/);
  assert.doesNotMatch(js,/fetch\([^)]*\/api\/(?:heatmap|players|movement|tracker|sessions)/);
  assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie|innerHTML|eval\(/);
  assert.match(js,/textContent/);assert.match(js,/stale/);assert.match(js,/Source time unknown/);
});
test('legacy private-source paths are excluded from the asset bundle and Worker',()=>{
  const ignore=read('.assetsignore');
  for(const x of ['movement.html','heatmap.html','players.html','rexy-ai.js','shared-nav.js'])assert.match(ignore,new RegExp(x.replaceAll('.','\\.')));
  assert.match(worker,/LEGACY_REDIRECTS/);assert.match(worker,/PUBLIC_FILES/);
  assert.match(worker,/\/assets\/site\.js/);assert.match(worker,/\/servers\.html/);
  assert.match(worker,/function validQuery/);assert.match(worker,/value !== 'https:\/\/discord\.com'/);
  assert.match(worker,/default-src 'none'; script-src 'self'/);
});
test('mod library separates historical research from installed/runtime verification',()=>{
  const html=read('mods.html');assert.match(html,/not a live installed-mod list/);
  assert.match(html,/August 7, 2026/);assert.match(html,/October 8, 2026/);
  assert.match(js,/listedLegacyOn/);assert.match(js,/in-game loading still unverified/);
});
test('CSP allows only first-party assets and never permits credentialed CORS',()=>{
  assert.doesNotMatch(worker,/Access-Control-Allow-Origin', '\*'/);
  assert.match(worker,/headers\.set\('Content-Security-Policy', PUBLIC_CSP\)/);
  assert.match(worker,/img-src 'self' data:/);
  assert.doesNotMatch(read('index.html'),/<script[^>]+src="https?:/);
});
test('marketing accurately distinguishes snapshot counts, cluster differences and data age',()=>{
  const home=read('index.html'),servers=read('servers.html');
  assert.match(home,/No scheduled full wipes/);assert.match(home,/inactivity policy/i);
  assert.match(home,/5× taming\*/);assert.match(home,/3× taming\*/);
  assert.match(servers,/Unknown ≠ empty/);assert.match(servers,/not a historical movement tracker/);
  assert.match(js,/Source clock inconsistent/);
  assert.doesNotMatch(home,/15 \/ 15 online|Players online: 999/);
});

test('activity shows full blue Legacy and gold Limited names with readable responsive labels',()=>{
  assert.match(js,/activity-label \$\{model\.cluster\}/);
  assert.match(js,/model\.cluster==='legacy'\?'Legacy':'Limited'/);
  assert.doesNotMatch(js,/model\.cluster==='legacy'\?'L':'M'/);
  assert.match(css,/\.activity-label\.legacy\{color:var\(--blue\)\}/);
  assert.match(css,/\.activity-label\.limited\{color:var\(--gold\)\}/);
  assert.match(css,/\.activity-label\{[^}]*white-space:normal/);
  assert.match(css,/@media\(max-width:480px\)\{[\s\S]*?\.activity-row\{grid-template-columns:/);
  assert.match(js,/model\.players===null\?'—':String\(model\.players\)/);
  assert.match(js,/const meter=el\('meter','activity-meter'\)/);
  assert.match(read('servers.html'),/Unknown ≠ empty/);
});
