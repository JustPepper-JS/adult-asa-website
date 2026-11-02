import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHandler,CANONICAL} from '../_worker.js';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('community.html'),script=read('assets/community.js'),css=read('assets/community.css');
const content=JSON.parse(read('assets/community-content.json'));
test('W3 original community hub has SEO, sections, accessible filters and consistent navigation',()=>{
  assert.match(html,/<html lang="en">/);
  for(const x of ['community-events','community-shops','community-gallery','community-event-list','community-shop-list','community-gallery-list'])assert.ok(html.includes('id="'+x+'"'));
  for(const path of ['/servers','/mods','/meet-the-players','/recovery.html','/admin','/community'])assert.ok(html.includes('href="'+path+'"'));
  for(const id of ['community-shop-search','community-event-kind','community-gallery-filter'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/role="status"/);
  assert.match(html,/https:\/\/adult-asa\.org\/community/);
  assert.doesNotMatch(html,/shattered.?skies|<iframe|onclick=|onerror=|<script[^>]+src="https?:/i);
  assert.ok(css.includes('@media(max-width:520px)'));
});
test('W3 static content catalog starts empty, not with invented events, shops or photos',()=>{
  assert.equal(content.schemaVersion,1);
  assert.equal(content.sourceUpdatedAt,null);
  assert.deepEqual(content.shops,[]);
  assert.deepEqual(content.updates,[]);
  assert.deepEqual(content.gallery,[]);
  assert.match(content.contentPolicy,/staff-reviewed opt-in/i);
});
test('W3 private records and credentialed requests are never wired into public community UI',()=>{
  assert.doesNotMatch(script,/innerHTML|localStorage|sessionStorage|document\.cookie|eval\(|fetch\(['"]\/control|fetch\(['"]\/api\/(?:community\/players|heatmap|sessions)/);
  assert.match(script,/\.textContent/);
  assert.match(script,/approved===true/);
  assert.match(script,/const localPhoto=/);
  assert.match(script,/credentials:'omit'/);
  assert.match(script,/url\.hostname==='discord\.com'/);
});
test('W3 Worker allows only public hub and bounded gallery image routes without opening private APIs',async()=>{
  const fail=async()=>{throw Error('upstream call forbidden');};
  const handler=createHandler({fetchImpl:fail});
  const env={ASSETS:{fetch:async req=>new Response('static '+new URL(req.url).pathname,{headers:{'Content-Type':'text/html'}})}};
  for(const route of ['/community','/community.html','/assets/community.js','/assets/community.css',
      '/assets/community-content.json','/assets/community/gallery/approved-photo.webp']){
    const response=await handler(new Request(CANONICAL+route),env);
    assert.equal(response.status,200,route);
    assert.match(response.headers.get('Cache-Control'),/no-store/);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
    if(route==='/community'||route==='/community.html')assert.match(response.headers.get('Content-Security-Policy'),/script-src 'self'/);
  }
  for(const route of ['/assets/community/gallery/hidden.txt','/assets/community/gallery/.secret.jpg',
    '/assets/community/gallery/evil.svg','/assets/community/gallery/large.jpg.exe','/api/community/shops']){
    const response=await handler(new Request(CANONICAL+route),env);
    assert.equal(response.status,404,route);
  }
});
class FakeNode{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.textContent='';this.listeners={};this.value='';}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  setAttribute(key,value){this[key]=value;}
  addEventListener(type,callback){this.listeners[type]=callback;}
  dispatch(type){this.listeners[type]?.();}
}
function simulatedCommunity(data){
  const ids=['community-event-kind','community-shop-search','community-gallery-filter',
    'community-event-status','community-shop-status','community-gallery-status',
    'community-event-list','community-shop-list','community-gallery-list'];
  const nodes=Object.fromEntries(ids.map(id=>[id,new FakeNode()]));
  nodes['community-event-kind'].value='all';
  nodes['community-gallery-filter'].value='all';
  const document={body:{dataset:{page:'community'}},getElementById:id=>nodes[id],
    createElement:tag=>new FakeNode(tag)};
  let fetchCount=0;
  const fetch=async(url,opts)=>{
    fetchCount++;assert.equal(url,'/assets/community-content.json');assert.equal(opts.credentials,'omit');
    return {ok:true,headers:{get:()=> 'application/json'},json:async()=>data};
  };
  vm.runInNewContext(script,{document,fetch,AbortController,URL,Date,Intl,setTimeout,clearTimeout});
  return {nodes,get fetchCount(){return fetchCount;}};
}
function flatten(node){return node.textContent+' '+node.children.map(flatten).join(' ');}
test('W3 UI uses only approved opt-in records, ignores invalid image URLs, and filters interactively',async()=>{
  const data={schemaVersion:1,
    shops:[
      {approved:true,name:'Test Dino Exchange',owner:'Test owner',description:'Creature breeding',
        specialties:['Rex'],discordUrl:'https://discord.com/channels/123456789012345678/123456789012345678'},
      {approved:false,name:'Private Player',description:'Never publish',discordUrl:'https://evil.invalid'}
    ],
    updates:[{approved:true,kind:'event',title:'Test event',description:'Test event details',
      startsAt:'2026-11-02T18:00:00Z',discordUrl:'https://evil.invalid'},
      {approved:true,kind:'announcement',title:'Test bulletin',description:'Test notice',publishedAt:'2026-11-01T21:00:00Z'}],
    gallery:[{approved:true,kind:'build',title:'Approved base',alt:'A stone base at sunset',image:'/assets/community/gallery/approved-photo.webp'},
      {approved:true,kind:'creature',title:'External image',alt:'Should never render',image:'https://evil.invalid/img.png'}]};
  const {nodes,fetchCount}=simulatedCommunity(data);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fetchCount,1);
  assert.equal(nodes['community-shop-list'].children.length,1);
  assert.doesNotMatch(flatten(nodes['community-shop-list']),/Private Player/);
  assert.equal(nodes['community-event-list'].children.length,2);
  assert.equal(nodes['community-gallery-list'].children.length,1);
  assert.equal(nodes['community-gallery-list'].children[0].children[0].src,'/assets/community/gallery/approved-photo.webp');
  nodes['community-shop-search'].value='no match';nodes['community-shop-search'].dispatch('input');
  assert.match(flatten(nodes['community-shop-list']),/No shops match/);
  nodes['community-event-kind'].value='announcement';nodes['community-event-kind'].dispatch('change');
  assert.equal(nodes['community-event-list'].children.length,1);
  assert.match(flatten(nodes['community-event-list']),/Test bulletin/);
  const card=nodes['community-event-list'].children[0];
  const a=card.children.at(-1);
  assert.equal(a.target,'_blank');
  assert.equal(a.rel,'noopener noreferrer');
});
test('W3 mod field guide visuals are original first-party CSS with author research explicitly labeled',()=>{
  const site=read('assets/site.js'),mod=read('mods.html'),siteCss=read('assets/site.css');
  assert.match(site,/mod-visual/);
  assert.match(siteCss,/mod-visual-creatures/);
  assert.match(siteCss,/mod-visual-building/);
  assert.match(mod,/not a live installed-mod list/);
  assert.doesNotMatch(site,/<img[^>]+src=['"]https?:/);
});
