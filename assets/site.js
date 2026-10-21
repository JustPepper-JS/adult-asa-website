/* Adult ASA public UI: aggregate status only; no private movement/session requests. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const MAPS = Object.freeze({
    legacy:['The Island','Scorched Earth','Aberration','Extinction','Genesis','Valguero','Ragnarok','The Center','Astraeos','Lost Colony'],
    limited:['Astraeos','Extinction','Genesis','Lost Colony','The Island'],
  });
  const ALIASES = Object.freeze({
    'The Island':['theisland','islandwp','theislandwp'],
    'Scorched Earth':['scorched','scorchedearth'],
    Aberration:['aberration'], Extinction:['extinction'], Genesis:['genesis','genpart1','gen1'],
    Valguero:['valguero'], Ragnarok:['ragnarok'], 'The Center':['thecenter','centerwp','center'],
    Astraeos:['astraeos'], 'Lost Colony':['lostcolony'],
  });
  const GROUPS = Object.freeze([
    ['creatures','Creatures & variants',['creatures','variants','spawns','finder','levels']],
    ['building','Building & décor',['structures','building','decoration','protection']],
    ['quality','Quality of life',['quality-of-life','engram','engrams','tools','controls']],
    ['breeding','Breeding & taming',['breeding','imprinting','mutations','taming','tranqs','potions','kibble']],
    ['trade','Trading & crafting',['trading','currency','shops','crafting','upgrades']],
    ['travel','Travel & transport',['transport','ships','creature-storage','cryopods']],
    ['resources','Farming & resources',['resources','farming','automation','storage','stacks']],
    ['misc','Other systems',['admin','events','combat','exploration','casino','games']],
  ]);
  function el(tag, cls = '', text = null) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== null) node.textContent = String(text);
    return node;
  }
  function dateLabel(iso) {
    const n = Date.parse(iso || '');
    if (!Number.isFinite(n)) return 'Source time unknown';
    const minutes = Math.floor((Date.now() - n) / 60000);
    if (minutes < -1) return 'Source clock inconsistent';
    if (minutes < 1) return 'Source updated moments ago';
    if (minutes < 60) return `Source updated ${minutes} min ago`;
    if (minutes < 1440) return `Source updated ${Math.floor(minutes / 60)} hr ago`;
    return `Source updated ${Math.floor(minutes / 1440)} d ago`;
  }
  function isFresh(raw) {
    const n = Date.parse(raw?.updatedAt || '');
    return Number.isFinite(n) && n <= Date.now() + 30000 && Date.now() - n < 180000 && raw?.freshness === 'recent';
  }
  function safeSnapshot(raw, expected) {
    if (!raw || typeof raw !== 'object' || raw.cluster !== expected || !Array.isArray(raw.servers) || raw.servers.length > 25) throw Error('Invalid response');
    return { ...raw, servers:raw.servers.filter(row => row && typeof row === 'object') };
  }
  function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g,''); }
  function inferMap(row, options) {
    // Nitrado/Rexy currently lists Legacy Scorched Earth as 'Adult ASA - SE'.
    // Match the short name exactly: never treat a generic 'se' substring as a map.
    if (options.includes('Scorched Earth') &&
        (/^Adult ASA(?: Legacy)?\s*-\s*SE$/i.test(String(row.name || '').trim()) ||
         ['se', 'sewp'].includes(normalize(row.map)))) return 'Scorched Earth';
    for (const field of [row.map, row.name]) {
      const n = normalize(field);
      if (!n) continue;
      const matches = options.filter(map => ALIASES[map].some(alias => n.includes(alias)));
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return null;
    }
    return null;
  }
  function modelMap(cluster, map, raw) {
    const matches = raw?.servers.filter(row => inferMap(row, MAPS[cluster]) === map) || [];
    if (matches.length !== 1) return {cluster,map,status:'unknown',players:null,capacity:null,freshness:raw?.freshness || 'unknown',updatedAt:raw?.updatedAt || null};
    const data=matches[0];
    const status = data.online === true ? 'online' : data.online === false ? 'offline' : 'unknown';
    const players = Number.isInteger(data.players) && data.players >= 0 ? data.players : null;
    const capacity = Number.isInteger(data.maxPlayers) && data.maxPlayers > 0 ? data.maxPlayers : null;
    return {cluster,map,status,players,capacity,freshness:isFresh(raw)?'recent':'stale',updatedAt:raw.updatedAt};
  }
  function allMaps(data){ return Object.entries(MAPS).flatMap(([cluster,maps]) => maps.map(map=>modelMap(cluster,map,data[cluster]))); }
  function setupNavigation() {
    const btn=document.querySelector('.menu-button'),nav=$('primary-nav');
    if(!btn || !nav)return;
    btn.addEventListener('click',()=>{
      const expanded=btn.getAttribute('aria-expanded')==='true';
      btn.setAttribute('aria-expanded',String(!expanded)); nav.classList.toggle('open',!expanded);
    });
    nav.addEventListener('click',e=>{if(e.target.closest('a')){btn.setAttribute('aria-expanded','false');nav.classList.remove('open');}});
  }
  async function getFleet() {
    const result={legacy:null,limited:null};
    await Promise.all(Object.keys(result).map(async cluster=>{
      try {
        const ctl=new AbortController(), timer=setTimeout(()=>ctl.abort(),10000);
        try {
          const res=await fetch(`/api/status/${cluster}`,{method:'GET',credentials:'omit',cache:'no-store',signal:ctl.signal,headers:{Accept:'application/json'}});
          if(!res.ok || !(res.headers.get('Content-Type')||'').includes('application/json'))throw Error('Provider unavailable');
          result[cluster]=safeSnapshot(await res.json(),cluster);
        } finally {clearTimeout(timer);}
      } catch(_){result[cluster]=null;}
    }));
    return result;
  }
  function summary(data) {
    const sources=Object.values(data).filter(Boolean), complete=sources.length===2;
    const survivors=sources.length && sources.every(s=>Number.isInteger(s.totalOnline)&&s.totalOnline>=0) ? sources.reduce((sum,s)=>sum+s.totalOnline,0) : null;
    const known=sources.flatMap(s=>s.servers).filter(row=>typeof row.online==='boolean');
    const responding=known.filter(row=>row.online===true).length;
    const fresh=complete&&sources.every(isFresh);
    const unavailable=sources.length===0;
    const maxAge=sources.length ? Math.max(...sources.map(s=>Date.now()-Date.parse(s.updatedAt || ''))) : null;
    return {sources,complete,survivors,responding,known:known.length,fresh,unavailable,maxAge};
  }
  function displayHome(data){
    const s=summary(data);
    $('home-survivors').textContent=s.survivors===null?'—':String(s.survivors)+(s.complete?'':'+');
    $('home-responding').textContent=s.unavailable||!s.known?'—':`${s.responding}/${s.known}`;
    $('home-freshness').textContent=s.unavailable?'Status source unavailable':s.fresh?'Both cluster sources recently updated':s.complete?'Source stale or incomplete':'Partial data · one cluster unavailable';
  }
  function setBanner(text,sub,klass){$('fleet-banner-title').textContent=text;$('fleet-banner-sub').textContent=sub;document.querySelector('.status-light')?.setAttribute('class',`status-light ${klass}`);}
  function stateText(model){if(model.status==='unknown')return 'Not reporting';if(model.status==='offline')return 'Not responding';return 'Responding';}
  function createMapCard(model){
    const card=el('article','map-card');card.dataset.cluster=model.cluster;
    const top=el('div','map-top');const nameArea=el('div');const topLabel=el('span','cluster-mini',model.cluster==='legacy'?'Legacy cluster':'Limited cluster');
    const h=el('h3','',model.map);nameArea.append(topLabel,h);
    top.append(nameArea,el('span','map-icon',model.cluster==='legacy'?'✦':'⌁'));
    const bottom=el('div','map-bottom');const countArea=el('div');const count=el('strong','',model.players===null?'—':String(model.players));const label=el('small','',` / ${model.capacity??'—'} players`);
    countArea.append(count,label);bottom.append(countArea,el('span',`map-state ${model.status}`,stateText(model)));
    card.append(top,bottom,el('p','map-note',model.updatedAt?dateLabel(model.updatedAt):'Source unavailable'));
    return card;
  }
  function activityRow(model) {
    const row=el('div','activity-row');row.setAttribute('role','group');row.setAttribute('aria-label',`${model.cluster} ${model.map}: ${model.players===null?'unknown player count':model.players+' players'}`);
    const label=el('span',`activity-label ${model.cluster}`,`${model.map} · ${model.cluster==='legacy'?'Legacy':'Limited'}`);
    const track=el('div','activity-track');const fill=el('div',`activity-fill ${model.cluster==='limited'?'limited':''}`);
    if(model.players!==null){ const meter=el('meter','activity-meter'); meter.min=0; meter.max=model.capacity||Math.max(model.players,1);meter.value=Math.min(model.players,meter.max);meter.setAttribute('aria-label',`${model.players} players currently reported`);track.append(meter);}
    row.append(label,track,el('span','activity-count',model.players===null?'—':String(model.players)));
    return row;
  }
  let serverUI=null;
  function setupServers(data){
    const s=summary(data);const sourceTimes=s.sources.map(x=>x.updatedAt).filter(Boolean);
    $('fleet-total').textContent=s.survivors===null?'—':`${s.survivors}${s.complete?'':'+'}`;
    $('fleet-responding').textContent=s.unavailable||!s.known?'—':`${s.responding}/${s.known}`;
    $('fleet-health').textContent=s.unavailable?'Unavailable':s.fresh?'Recent':s.complete?'Stale or unknown':'Partial';
    $('fleet-source-age').textContent=sourceTimes.length?dateLabel(sourceTimes.reduce((a,b)=>Date.parse(a)<Date.parse(b)?a:b)):'Source time unavailable';
    setBanner(s.unavailable?'Server data unavailable':s.fresh?'Live status reported recently':s.complete?'Status may be stale':'Partial fleet status',s.unavailable?'Try refreshing later; player counts are intentionally unavailable.':s.complete?'Both clusters have been contacted. Check the source ages below.':'One cluster did not return data. Counts are incomplete.',s.fresh?'good':'warn');
    const models=allMaps(data);const mapList=$('map-list'), bars=$('activity-bars');
    if(!serverUI){
      serverUI={cluster:new URL(location.href).searchParams.get('cluster')?.toLowerCase()||'all',status:'all',models,unavailable:s.unavailable};
      if(!['all','legacy','limited'].includes(serverUI.cluster))serverUI.cluster='all';
      const buttons=[...document.querySelectorAll('[data-cluster-filter]')];
      buttons.forEach(btn=>btn.addEventListener('click',()=>{
        serverUI.cluster=btn.dataset.clusterFilter;const url=new URL(location.href);
        if(serverUI.cluster==='all')url.searchParams.delete('cluster');else url.searchParams.set('cluster',serverUI.cluster);
        history.replaceState(null,'',url.pathname+url.search);renderServerMaps();
      }));
      $('map-search').addEventListener('input',renderServerMaps);
      $('map-status-filter').addEventListener('change',e=>{serverUI.status=e.target.value;renderServerMaps();});
    }
    serverUI.models=models;serverUI.unavailable=s.unavailable;
    bars.replaceChildren(...models.map(activityRow));renderServerMaps();
  }
  function renderServerMaps(){
    const ui=serverUI;if(!ui)return;
    const query=normalize($('map-search').value),list=ui.models.filter(m=>
      (ui.cluster==='all'||m.cluster===ui.cluster)&&
      (ui.status==='all'||m.status===ui.status)&&normalize(m.map).includes(query));
    const mapList=$('map-list');mapList.replaceChildren(...list.map(createMapCard));
    if(!list.length)mapList.append(el('p','empty-state','No worlds match those filters. Try another search.'));
    $('map-filter-summary').textContent=`Showing ${list.length} of ${ui.models.length} configured world slots. ${ui.unavailable?'Live status currently unavailable.':'Source reports are shown where available.'}`;
    document.querySelectorAll('[data-cluster-filter]').forEach(button=>{
      const current=button.dataset.clusterFilter===ui.cluster;
      button.setAttribute('aria-pressed',String(current));button.classList.toggle('active',current);
    });
  }
  function groupFor(mod){const categories=Array.isArray(mod.categories)?mod.categories:[];return GROUPS.filter(g=>g[2].some(key=>categories.includes(key))).map(g=>g[0]);}
  function modCard(mod){
    const card=el('article','mod-card');const badges=el('div','mod-badges');
    const cats=groupFor(mod);badges.append(el('span','mod-badge',GROUPS.find(g=>g[0]===cats[0])?.[1]||'Other'));
    badges.append(el('span',mod.listedLegacyOn?'mod-badge evidence':'mod-badge',mod.listedLegacyOn?'Legacy list observed · Oct 8':'Author research · Aug 7'));
    card.append(badges,el('h3','',mod.name),el('p','',mod.summary));
    const details=el('details');details.append(el('summary','',mod.features?.length?'What this mod covers':'Research & evidence'));
    const area=el('div');if(Array.isArray(mod.features)&&mod.features.length){const list=el('ul');mod.features.slice(0,5).forEach(f=>list.append(el('li','',f)));area.append(list);}
    area.append(el('p','map-note',mod.listedLegacyOn?'Observed in Legacy enabled-mod listings on 2026-10-08; in-game loading still unverified.':'Cataloged from earlier community research; not confirmed installed today.'));
    const source=el('div','mod-source'),link=el('a','', 'Read the mod-author page ↗');
    try{const url=new URL(mod.sourceUrl);if(url.protocol==='https:' && url.hostname==='www.curseforge.com' && url.pathname.startsWith('/ark-survival-ascended/mods/')){link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';}else link.textContent='Source URL not available';}catch(_){link.textContent='Source URL not available';}
    source.append(link);area.append(source);details.append(area);card.append(details);return card;
  }
  async function setupMods(){
    const target=$('mod-list'), summaryNode=$('mod-filter-summary');
    let mods=[];
    try{
      const res=await fetch('/assets/mod-catalog.json',{credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});
      if(!res.ok)throw Error('Unable to load');const data=await res.json();
      if(data.schemaVersion!==1||!Array.isArray(data.entries)||data.entries.length>100)throw Error('Invalid catalog');
      mods=data.entries.filter(x=>x&&typeof x.name==='string'&&typeof x.summary==='string');
    }catch(_){target.replaceChildren(el('p','empty-state','The research library is temporarily unavailable. Please use Discord for the current mod list.'));summaryNode.textContent='Catalog unavailable';return;}
    const category=$('mod-category');for(const g of GROUPS){const op=el('option','',g[1]);op.value=g[0];category.append(op);}
    function render(){
      const query=normalize($('mod-search').value),kind=category.value,evidence=$('mod-evidence').value;
      const visible=mods.filter(m=>(!query||normalize([m.name,m.summary,...(m.categories||[]),...(m.features||[])].join(' ')).includes(query))&&(kind==='all'||groupFor(m).includes(kind))&&(evidence==='all'||(evidence==='legacy'?!!m.listedLegacyOn:!m.listedLegacyOn)));
      target.replaceChildren(...visible.map(modCard));if(!visible.length)target.append(el('p','empty-state','No matching research entries. Try a broader search.'));
      summaryNode.textContent=`${visible.length} of ${mods.length} documented research entries · Source review August 7, 2026 · Not a live installed-mod inventory`;
    }
    $('mod-search').addEventListener('input',render);category.addEventListener('change',render);$('mod-evidence').addEventListener('change',render);render();
  }
  setupNavigation();const page=document.body.dataset.page;
  if(page==='mods')setupMods();
  if(page==='servers'||page==='home'){
    let loading=false;
    async function refresh(){if(loading)return;loading=true;const button=$('refresh-status');if(button){button.disabled=true;button.textContent='Refreshing…';}
      try{const data=await getFleet();if(page==='home')displayHome(data);else setupServers(data);}finally{loading=false;if(button){button.disabled=false;button.textContent='↻ Refresh';}}
    }
    refresh();if(page==='servers')$('refresh-status')?.addEventListener('click',refresh);
    window.setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
  }
})();
