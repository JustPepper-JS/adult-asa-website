/* Adult ASA player directory: all retained ARK gameplay names, maps,
   sessions and transfers. Never request raw legacy /api/players/heatmap,
   game connection secrets, Steam/EOS IDs, account links or base coordinates.
   Cloudflare independently validates every first-party public data response. */
const $=id=>document.getElementById(id);
const node=(tag,cls='',value=null)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(value!==null)el.textContent=String(value);
  return el;
};
const fullCluster=c=>c==='legacy'?'Legacy':c==='limited'?'Limited':'Cluster not established';
const when=iso=>{
  if(!iso)return 'Not recorded';
  const date=new Date(iso);
  return Number.isFinite(date.getTime())?
    date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Unknown date';
};
const hours=number=>Number.isFinite(number)?
  (Math.round(number*10)/10).toLocaleString(undefined,{maximumFractionDigits:1})+' hours':'Unknown';
export function activityDescription(event){
  if(event?.type==='transfer'){
    return 'Transfer: '+fullCluster(event.fromCluster)+' / '+event.fromMap+
      ' → '+fullCluster(event.toCluster)+' / '+event.toMap+
      ' · '+when(event.occurredAt)+(event.inferred?' · inferred by Rexy':' · observed map switch; identity unverified');
  }
  if(event?.type==='visit'){
    const end=event.endedAt?when(event.endedAt):'unknown';
    const reason=event.endedReason==='restart_gap'?'tracker restarted':
      event.endedReason==='coverage_gap'?'monitoring gap':
      event.endedReason==='observed_absence'?'not seen in next reliable scan':
      event.endedReason==='still_observed'?'still seen in latest named scan':'tracking state unknown';
    return 'Observed map visit: Limited / '+event.map+
      ' · First detected '+when(event.occurredAt)+
      ' · Last detected '+end+' · '+reason+
      ' · actual play duration and logout not established';
  }
  if(event?.type==='session'){
    return 'Session: '+fullCluster(event.cluster)+' / '+event.map+
      ' · '+when(event.occurredAt)+' to '+when(event.endedAt)+
      ' · '+Math.max(0,event.durationMinutes||0).toLocaleString()+' min';
  }
  return 'Unverified game event';
}
function endpoint(route,params){
  const s=new URLSearchParams(params);
  return '/api/community/players'+route+(s.size?'?'+s.toString():'');
}
async function getJson(url){
  const result=await fetch(url,{method:'GET',credentials:'omit',cache:'no-store',
    headers:{Accept:'application/json'}});
  if(!result.ok||!(result.headers.get('Content-Type')||'').includes('application/json'))
    throw Error('Game history source unavailable');
  return result.json();
}
function cardFor(player){
  const card=node('article','player-card');
  const top=node('div','player-card-top');
  const primarilyLimited=player.dominantCluster==='limited';
  const emblem=node('span','player-avatar'+(primarilyLimited?' limited-primary':''),primarilyLimited?'✹':'✦');
  emblem.setAttribute('aria-label',primarilyLimited?
    'Mostly Limited by reliably observed map time':'Community survivor emblem');
  if(primarilyLimited)emblem.title='Mostly Limited in sampled tracked map time';
  top.append(emblem);
  for(const cluster of player.clustersVisited.length?player.clustersVisited:['unknown']){
    top.append(node('span','player-tag '+cluster,fullCluster(cluster)));
  }
  card.append(top);
  const main=node('div','player-card-body');
  main.append(node('h3','',player.displayName));
  const status=player.isOnline?
    (player.currentMap&&player.currentCluster?
      'Recently detected · '+fullCluster(player.currentCluster)+' / '+player.currentMap:'Recently detected in-game'):
    (player.lastSeen?'Last observed '+when(player.lastSeen):'Previous ARK survivor');
  main.append(node('p','player-bio',status));
  const stats=node('div','player-stats');
  stats.append(node('span','',hours(player.totalHours)+' tracked'),
    node('span','',player.sessionCount+' completed sessions'),
    node('span','',(player.visitCount||0)+' observed map visits'),
    node('span','',player.transferCount+' transfer records'));
  main.append(stats);
  const favorite=node('p','player-favorite');
  favorite.append(node('span','player-favorite-label','Favorite map'));
  const favData=player.favoriteMap;
  if(favData){
    const name=node('strong','player-favorite-map '+favData.cluster,
      fullCluster(favData.cluster)+' · '+favData.map);
    favorite.append(name);
    favorite.title=favData.basis==='sampled-time'?
      'Most time counted between consecutive reliable named-player scans. This is partial tracked activity, not full lifetime playtime.':
      'Largest sum of retained completed map sessions. Missing activity is not included.';
  }else{
    favorite.append(node('span','player-favorite-unknown','Not established yet'));
    favorite.title='Insufficient comparable map-time records; no favorite is guessed.';
  }
  main.append(favorite);
  card.append(main);
  const button=node('button','player-history-trigger','View map and transfer history');
  button.type='button';button.setAttribute('aria-expanded','false');
  const info=node('div','player-history');
  info.hidden=true;
  const summary=node('div','player-map-totals');
  const events=node('ul','player-events');
  const more=node('button','player-more-events','Load older activity');
  more.type='button';more.hidden=true;
  info.append(summary,events,more);
  card.append(button,info);
  let nextPage=1,loading=false,opened=false;
  async function fetchHistory(){
    if(loading)return;loading=true;more.disabled=true;button.disabled=true;
    if(nextPage===1)events.replaceChildren(node('li','quiet','Loading retained game history…'));
    try{
      const data=await getJson(endpoint('/history',{id:player.id,page:String(nextPage)}));
      if(data.schema!=='adult-asa.community.v1.history'||data.player.id!==player.id)
        throw Error('Unexpected history response');
      if(nextPage===1){
        summary.replaceChildren(node('h4','','Recorded map activity ('+data.mapTotals.length+')'));
        if(!data.mapTotals.length)summary.append(node('p','quiet','No recorded map activity retained.'));
        for(const m of data.mapTotals)
          summary.append(node('p','player-map-entry',fullCluster(m.cluster)+' · '+m.map+
            ' · '+m.visits+' retained entries · '+hours(m.totalMinutes/60)+' confirmed session durations'));
        events.replaceChildren();
      }
      for(const event of data.events)events.append(node('li','',activityDescription(event)));
      if(nextPage===1&&!data.events.length)events.append(node('li','quiet','No retained events for this display name.'));
      more.hidden=nextPage>=data.totalPages;
      nextPage++;
    }catch(_){
      if(nextPage===1)events.replaceChildren();
      events.append(node('li','quiet','Recorded history could not be loaded. Try again.'));
      more.hidden=false;
    }finally{loading=false;more.disabled=false;button.disabled=false;}
  }
  button.addEventListener('click',async()=>{
    opened=!opened;info.hidden=!opened;
    button.textContent=opened?'Hide map and transfer history':'View map and transfer history';
    button.setAttribute('aria-expanded',String(opened));
    if(opened&&nextPage===1)await fetchHistory();
  });
  more.addEventListener('click',fetchHistory);
  return card;
}
async function init(){
  const list=$('player-directory'),status=$('directory-status'),
    search=$('player-search'),filter=$('player-cluster'),
    more=$('player-load-more'),coveragePanel=$('player-coverage');
  if(!list||!status||!search||!filter||!more)return;
  let rows=[],nextPage=1,lastTotal=0,lastPages=0,query='',ticket=0,loading=false;
  let historyCoverage=null;
  function renderTotals(totals){
    if(!totals)return;
    const fields=[['player-total-all','all'],['player-total-legacy','legacy'],
      ['player-total-limited','limited']];
    for(const [id,key] of fields){
      const element=$(id);
      if(element&&Number.isInteger(totals[key]))
        element.textContent=totals[key].toLocaleString();
    }
  }
  function renderCoverage(){
    if(!coveragePanel)return;
    coveragePanel.replaceChildren();
    coveragePanel.append(node('h3','','Where the records begin'));
    if(!historyCoverage){
      coveragePanel.append(node('p','quiet','Tracking coverage is not yet available.'));
      return;
    }
    coveragePanel.append(node('p','quiet','Historical coverage is incomplete. Gaps and unobserved gameplay are not reconstructed.'));
    if(historyCoverage.legacyFirstRecordedAt)
      coveragePanel.append(node('p','','Legacy tracking snapshot begins '+when(historyCoverage.legacyFirstRecordedAt)));
    coveragePanel.append(node('p','',historyCoverage.mapTimeStartedAt?
      'Favorite-map comparisons use bounded, consecutive named scans since '+when(historyCoverage.mapTimeStartedAt)+'.':
      'Per-map time comparisons are starting; earlier missing hours are not guessed.'));
    if(historyCoverage.mapTimeAvailability==='unavailable')
      coveragePanel.append(node('p','player-coverage-warning','Per-map time sampling is temporarily unavailable; existing evidence is preserved.'));
    if(historyCoverage.limitedAvailability==='unavailable')
      coveragePanel.append(node('p','player-coverage-warning','Limited history recording is unavailable; existing evidence has not been replaced.'));
    const mapList=node('div','player-coverage-maps');
    for(const m of historyCoverage.limited||[]){
      const entry=node('div','player-coverage-map');
      entry.append(node('strong','',m.map));
      entry.append(node('span','',m.firstObservedAt
        ?'First reliable scan '+when(m.firstObservedAt)+' · '+m.reliableScans+' scans · '+m.gapScans+' gaps'
        :'No reliable named-player scans recorded yet'));
      mapList.append(entry);
    }
    coveragePanel.append(mapList);
  }
  function render(){
    list.replaceChildren();
    // Filter on the backend against ALL retained player names before paging.
    list.append(...rows.map(cardFor));
    if(!rows.length&&!loading){
      const panel=node('div','player-empty');
      panel.append(node('span','player-empty-glyph','◇'),
        node('h3','','No matching retained player profiles'),
        node('p','','Try another cluster or name. Unobserved players cannot appear in these records.'));
      list.append(panel);
    }
    more.hidden=loading||nextPage>lastPages;
    status.textContent=loading?'Loading Rexy player records…':
      rows.length+' displayed · '+lastTotal+' matching game names in Rexy’s retained records';
  }
  async function load(reset=false){
    if(loading&&!reset)return;
    if(reset){rows=[];nextPage=1;lastTotal=0;lastPages=0;}
    const myTicket=++ticket;loading=true;
    more.disabled=true;render();
    try{
      const data=await getJson(endpoint('',{page:String(nextPage),...(query?{q:query}:{}),
        ...(filter.value!=='all'?{cluster:filter.value}:{})}));
      if(myTicket!==ticket)return;
      if(data.schema!=='adult-asa.community.v1.roster'||data.state!=='RETAINED_GAME_DATA')
        throw Error('Unexpected roster response');
      lastTotal=data.totalPlayers;lastPages=data.totalPages;
      historyCoverage=data.coverage;renderCoverage();
      renderTotals(data.totals);
      rows.push(...data.players);nextPage++;
    }catch(_){
      if(myTicket!==ticket)return;
      status.textContent='Rexy player history is not currently available. No records have been fabricated.';
      more.hidden=true;return;
    }finally{if(myTicket===ticket){loading=false;more.disabled=false;}}
    render();
  }
  let searchDelay=null;
  search.addEventListener('input',()=>{
    clearTimeout(searchDelay);
    searchDelay=setTimeout(()=>{
      query=search.value.trim().slice(0,50);load(true);
    },250);
  });
  filter.addEventListener('change',()=>load(true));
  more.addEventListener('click',()=>load(false));
  await load(true);
}
if(typeof document!=='undefined'&&document.body?.dataset.page==='meet-players')init();
