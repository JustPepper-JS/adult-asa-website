/* Public opt-in community profiles only. NEVER import Rexy's legacy /api/players,
   /api/heatmap, /api/movement, /api/tracker, or individual session feeds.
   This static catalog must contain only independently approved publication records. */
const MAPS=Object.freeze({
  legacy:Object.freeze(['The Island','Scorched Earth','Aberration','Extinction','Genesis','Valguero','Ragnarok','The Center','Astraeos','Lost Colony']),
  limited:Object.freeze(['Astraeos','Extinction','Genesis','Lost Colony','The Island']),
});
const CLUSTERS=new Set(['legacy','limited','both']);
const SAFE_NAME=/^[\p{L}\p{N}\p{M}\p{Extended_Pictographic} _.'\-#()&+!•\u200d]{2,48}$/u;
const MONTH=/^20\d{2}-(0[1-9]|1[0-2])$/;
const ROOT_KEYS=new Set(['schemaVersion','publicationState','reviewedAt','profiles']);
const PROFILE_KEYS=new Set(['displayName','bio','cluster','consent','mapHighlights','transferHighlights']);
const MAP_KEYS=new Set(['cluster','map','month']);
const TRANSFER_KEYS=new Set(['fromCluster','fromMap','toCluster','toMap','month']);
const CONSENT_KEYS=new Set(['profile','mapHistory','transfers','reviewedAt']);

function allowedKeys(record,allowed) {
  return record&&typeof record==='object'&&!Array.isArray(record)&&
    Object.keys(record).every(key=>allowed.has(key));
}
function validMap(cluster,map){return Object.hasOwn(MAPS,cluster) && MAPS[cluster].includes(map);}
function validMonth(month){return typeof month==='string'&&MONTH.test(month);}
function cleanMap(row){
  if(!allowedKeys(row,MAP_KEYS)||!validMap(row.cluster,row.map)||!validMonth(row.month))return null;
  return Object.freeze({cluster:row.cluster,map:row.map,month:row.month});
}
function cleanTransfer(row){
  if(!allowedKeys(row,TRANSFER_KEYS)||!validMap(row.fromCluster,row.fromMap)||
    !validMap(row.toCluster,row.toMap)||!validMonth(row.month))return null;
  return Object.freeze({fromCluster:row.fromCluster,fromMap:row.fromMap,
    toCluster:row.toCluster,toMap:row.toMap,month:row.month});
}
function emptyDirectory(message) {
  return Object.freeze({state:'EMPTY_OR_UNVERIFIED',message,profiles:Object.freeze([])});
}
/**
 * Only projects a deliberately public catalog; never converts provider records
 * to public consent. Consent evidence/identity validation MUST be established
 * outside this browser before data enters any public static file.
 * Reject the entire catalog if records are malformed to avoid partial leaks.
 */
export function projectPublicDirectory(payload){
  if(!allowedKeys(payload,ROOT_KEYS)||payload.schemaVersion!==1||
    !['awaiting_verified_player_consent','approved_profiles'].includes(payload.publicationState)||
    !Array.isArray(payload.profiles)||payload.profiles.length>100)
    return emptyDirectory('The approved player directory is unavailable.');
  if(payload.profiles.length===0)
    return emptyDirectory('No approved public player profiles have been published yet.');
  if(payload.publicationState!=='approved_profiles'||
    !validReviewDate(payload.reviewedAt))
    return emptyDirectory('The directory is awaiting publication review.');
  const seen=new Set(),profiles=[];
  for(const raw of payload.profiles){
    if(!allowedKeys(raw,PROFILE_KEYS)||typeof raw.displayName!=='string'||
      !SAFE_NAME.test(raw.displayName)||!CLUSTERS.has(raw.cluster)||
      typeof raw.bio!=='string'||raw.bio.length>180||/[\u0000-\u001f\u007f]/.test(raw.bio)||
      !allowedKeys(raw.consent,CONSENT_KEYS)||
      raw.consent.profile!==true||!validReviewDate(raw.consent.reviewedAt)||
      !Array.isArray(raw.mapHighlights)||raw.mapHighlights.length>10||
      !Array.isArray(raw.transferHighlights)||raw.transferHighlights.length>10)
      return emptyDirectory('The directory is awaiting publication review.');
    const key=raw.displayName.toLocaleLowerCase('en-US');
    if(seen.has(key))return emptyDirectory('The directory is awaiting publication review.');
    seen.add(key);
    // Optional map and transfer disclosures are controlled by separate scoped
    // consent. No precise times, server IDs, IPs, coordinates or platform IDs.
    if((raw.mapHighlights.length>0&&raw.consent.mapHistory!==true)||
       (raw.transferHighlights.length>0&&raw.consent.transfers!==true))
      return emptyDirectory('The directory is awaiting publication review.');
    const maps=raw.mapHighlights.map(cleanMap),transfers=raw.transferHighlights.map(cleanTransfer);
    if(maps.some(x=>!x)||transfers.some(x=>!x))
      return emptyDirectory('The directory is awaiting publication review.');
    profiles.push(Object.freeze({
      displayName:raw.displayName,bio:raw.bio,cluster:raw.cluster,
      mapHighlights:Object.freeze(maps),
      transferHighlights:Object.freeze(transfers),
    }));
  }
  return Object.freeze({state:'PUBLISHED_OPT_IN_ONLY',message:null,profiles:Object.freeze(profiles)});
}
function validReviewDate(s){
  if(typeof s!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(s))return false;
  const timestamp=Date.parse(s+'T00:00:00Z');
  return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===s;
}

function node(tag,className='',value=null){
  const x=document.createElement(tag);
  if(className)x.className=className;
  if(value!==null)x.textContent=String(value);
  return x;
}
function fullCluster(cluster) {return cluster==='legacy'?'Legacy':cluster==='limited'?'Limited':'Legacy + Limited';}
function monthName(month) {
  const [year,m]=month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,m-1,1)));
}
function detailPanel(title,items,format){
  const details=node('details','player-detail');
  details.append(node('summary','',title+' ('+items.length+')'));
  const list=node('ul','player-events');
  if(!items.length)list.append(node('li','quiet','No public stories shared.'));
  else for(const item of items)list.append(node('li','',format(item)));
  details.append(list);return details;
}
function playerCard(p){
  const card=node('article','player-card');
  const top=node('div','player-card-top');
  const badge=node('span','player-tag '+(p.cluster==='both'?'both':p.cluster),fullCluster(p.cluster));
  top.append(node('span','player-avatar','✦'),badge);
  const body=node('div','player-card-body');
  body.append(node('h3','',p.displayName),node('p','player-bio',p.bio||'Survivor of Adult ASA.'));
  card.append(top,body,
    detailPanel('Map stories',p.mapHighlights,
      m=>fullCluster(m.cluster)+' · '+m.map+' · '+monthName(m.month)),
    detailPanel('Transfer stories',p.transferHighlights,
      t=>fullCluster(t.fromCluster)+' '+t.fromMap+' → '+fullCluster(t.toCluster)+' '+t.toMap+' · '+monthName(t.month)));
  return card;
}
async function init(){
  const list=document.getElementById('player-directory');
  const status=document.getElementById('directory-status');
  const search=document.getElementById('player-search');
  const filter=document.getElementById('player-cluster');
  if(!list||!status||!search||!filter)return;
  let data=emptyDirectory('No approved public player profiles have been published yet.');
  try{
    const res=await fetch('/assets/players-directory.json',{
      credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}
    });
    if(!res.ok||!(res.headers.get('Content-Type')||'').includes('application/json'))
      throw Error('No vetted directory');
    const payload=await res.json();
    data=projectPublicDirectory(payload);
  }catch(_){data=emptyDirectory('The approved player directory is unavailable.');}
  function render(){
    list.replaceChildren();
    const query=search.value.trim().toLocaleLowerCase('en-US').slice(0,50);
    const mode=filter.value;
    const rows=data.profiles.filter(p=>(mode==='all'||p.cluster===mode||p.cluster==='both')&&
      p.displayName.toLocaleLowerCase('en-US').includes(query));
    const count=rows.length;
    status.textContent=data.state==='PUBLISHED_OPT_IN_ONLY'?
      count+' approved profiles shown · only player-authorized public information':
      data.message;
    if(!count){
      const panel=node('div','player-empty');
      panel.append(node('span','player-empty-glyph','◇'),
        node('h3','',query?'No matching public profiles':'Players choose what they share.'),
        node('p','',query?'Try another name or cluster.':
          'A player directory is being prepared. No names, map histories or transfer records are published without independently verified permission.'));
      list.append(panel);
    } else list.append(...rows.map(playerCard));
  }
  search.addEventListener('input',render);
  filter.addEventListener('change',render);
  render();
}
if(typeof document!=='undefined'&&document.body?.dataset.page==='meet-players')init();
