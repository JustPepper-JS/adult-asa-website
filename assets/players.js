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
      ' · '+when(event.occurredAt)+(event.inferred?' · inferred by Rexy':' · recorded transfer');
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
  top.append(node('span','player-avatar','✦'));
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
    node('span','',player.sessionCount+' recorded sessions'),
    node('span','',player.transferCount+' transfers'));
  main.append(stats);
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
        summary.replaceChildren(node('h4','','Map history ('+data.mapTotals.length+')'));
        if(!data.mapTotals.length)summary.append(node('p','quiet','No completed map sessions retained.'));
        for(const m of data.mapTotals)
          summary.append(node('p','player-map-entry',fullCluster(m.cluster)+' · '+m.map+
            ' · '+m.visits+' visits · '+hours(m.totalMinutes/60)));
        events.replaceChildren();
      }
      for(const event of data.events)events.append(node('li','',activityDescription(event)));
      if(nextPage===1&&!data.events.length)events.append(node('li','quiet','No sessions or transfers retained.'));
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
    more=$('player-load-more');
  if(!list||!status||!search||!filter||!more)return;
  let rows=[],nextPage=1,lastTotal=0,lastPages=0,query='',ticket=0,loading=false;
  function render(){
    list.replaceChildren();
    const cluster=filter.value;
    const filtered=rows.filter(p=>cluster==='all'||p.clustersVisited.includes(cluster));
    list.append(...filtered.map(cardFor));
    if(!filtered.length){
      const panel=node('div','player-empty');
      panel.append(node('span','player-empty-glyph','◇'),
        node('h3','',rows.length?'No matching cluster':'No recorded player profiles found'),
        node('p','',rows.length?
          'Switch the cluster filter to view more players.':
          'Rexy has no player records to display for this search, or the history service is unavailable.'));
      list.append(panel);
    }
    more.hidden=loading||nextPage>lastPages;
    status.textContent=loading?'Loading Rexy player records…':
      filtered.length+' displayed · '+lastTotal+' matching game names in Rexy’s retained records';
  }
  async function load(reset=false){
    if(loading&&!reset)return;
    if(reset){rows=[];nextPage=1;lastTotal=0;lastPages=0;}
    const myTicket=++ticket;loading=true;
    more.disabled=true;render();
    try{
      const data=await getJson(endpoint('',{page:String(nextPage),...(query?{q:query}:{})}));
      if(myTicket!==ticket)return;
      if(data.schema!=='adult-asa.community.v1.roster'||data.state!=='RETAINED_GAME_DATA')
        throw Error('Unexpected roster response');
      lastTotal=data.totalPlayers;lastPages=data.totalPages;
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
  filter.addEventListener('change',render);
  more.addEventListener('click',()=>load(false));
  await load(true);
}
if(typeof document!=='undefined'&&document.body?.dataset.page==='meet-players')init();
