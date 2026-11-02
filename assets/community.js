/* Adult ASA W3 — data-driven public community listings, reviewed and opt-in.
   No credentials, private player identifiers, third-party tracking or remote image URLs. */
(() => {
  'use strict';
  if(document.body.dataset.page !== 'community')return;
  const $=id=>document.getElementById(id);
  const DISCORD='https://discord.gg/adultasa';
  const KINDS=new Set(['event','challenge','announcement']);
  const PHOTOS=new Set(['build','creature','moment']);
  const localPhoto=/^\/assets\/community\/gallery\/[a-z0-9][a-z0-9_-]{0,70}\.(?:webp|png|jpg)$/;
  let catalog=null;
  function element(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function norm(text){return String(text||'').toLocaleLowerCase('en-US').normalize('NFKC').trim();}
  function safeText(text,limit=500){return typeof text==='string'&&text.length<=limit&&text.trim()?text.trim():null;}
  function safeDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value))return null;
    const n=Date.parse(value);
    return Number.isFinite(n)?n:null;
  }
  function displayDate(iso){
    const n=safeDate(iso);
    if(n===null)return 'Date not announced';
    return new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(n));
  }
  function discordURL(value){
    if(typeof value!=='string'||value.length>220)return DISCORD;
    try{
      const url=new URL(value);
      if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash)return DISCORD;
      if(url.hostname==='discord.com'&&/^\/channels\/[0-9]{16,22}\/[0-9]{16,22}(?:\/[0-9]{16,22})?$/.test(url.pathname))return url.href;
      if(url.hostname==='discord.gg'&&url.pathname==='/adultasa')return url.href;
    }catch(_){}
    return DISCORD;
  }
  function link(text,url=DISCORD){
    const a=element('a','',text);a.href=discordURL(url);a.target='_blank';a.rel='noopener noreferrer';
    return a;
  }
  function empty(title,detail,cta){
    const card=element('div','community-empty');
    card.append(element('strong','',title),element('p','',detail),link(cta));
    return card;
  }
  function getList(name){
    if(!catalog||!Array.isArray(catalog[name]))return [];
    return catalog[name].filter(row=>row&&row.approved===true&&typeof row==='object'&&!Array.isArray(row));
  }
  function renderEvents(){
    const type=$('community-event-kind').value;
    const list=getList('updates').filter(item=>
      KINDS.has(item.kind)&&safeText(item.title,120)&&safeText(item.description,650)&&
      (type==='all'||item.kind===type));
    list.sort((a,b)=>(safeDate(b.publishedAt)||0)-(safeDate(a.publishedAt)||0));
    const root=$('community-event-list');root.replaceChildren();
    for(const item of list){
      const card=element('article','community-event-card');
      const label=item.kind==='event'?'Event':item.kind==='challenge'?'Weekly challenge':'Announcement';
      card.append(element('span','community-tag',label),element('h3','',item.title),
        element('p','',item.description));
      const when=safeDate(item.startsAt)!==null?'Scheduled · '+displayDate(item.startsAt):
        safeDate(item.publishedAt)!==null?'Published · '+displayDate(item.publishedAt):'Date not announced';
      card.append(element('small','',when),link('Read in Discord ↗',item.discordUrl));
      root.append(card);
    }
    if(!list.length)root.append(empty(type==='all'?'Community updates will appear here.':'No published '+type+' updates yet.',
      'The events and announcements section is ready. Staff-reviewed posts will appear when submitted; Discord has the latest information.','See announcements on Discord ↗'));
    $('community-event-status').textContent=list.length===0?'No staff-reviewed updates published yet':list.length+' published '+(list.length===1?'update':'updates');
  }
  function renderShops(){
    const query=norm($('community-shop-search').value);
    const list=getList('shops').filter(item=>{
      if(!safeText(item.name,100)||!safeText(item.description,520))return false;
      const searchable=[item.name,item.owner||'',item.description,...(Array.isArray(item.specialties)?item.specialties:[])];
      return !query||norm(searchable.join(' ')).includes(query);
    });
    list.sort((a,b)=>a.name.localeCompare(b.name));
    const root=$('community-shop-list');root.replaceChildren();
    for(const item of list){
      const card=element('article','community-shop-card');
      card.append(element('span','community-tag','Player-owned shop'),element('h3','',item.name),
        element('p','',item.description));
      if(safeText(item.owner,60))card.append(element('small','','Owner · '+item.owner));
      if(Array.isArray(item.specialties)&&item.specialties.length){
        const words=item.specialties.filter(x=>safeText(x,45)).slice(0,6);
        if(words.length)card.append(element('small','','Specialties · '+words.join(' · ')));
      }
      card.append(link('Visit the shop on Discord ↗',item.discordUrl));root.append(card);
    }
    if(!list.length)root.append(empty(query?'No shops match your search.':'Your shop could be featured here.',
      query?'Try a different shop or creature name.':'The directory is ready for approved listings. We do not publish owner names, inventory or Discord IDs without permission.','Ask staff about listing a shop ↗'));
    $('community-shop-status').textContent=list.length?list.length+' matching approved '+(list.length===1?'shop':'shops'):'No approved shops currently listed';
  }
  function renderGallery(){
    const filter=$('community-gallery-filter').value;
    const list=getList('gallery').filter(item=>
      safeText(item.title,100)&&safeText(item.alt,180)&&typeof item.image==='string'&&
      localPhoto.test(item.image)&&PHOTOS.has(item.kind)&&(filter==='all'||filter===item.kind));
    const root=$('community-gallery-list');root.replaceChildren();
    for(const item of list){
      const card=element('article','community-gallery-card');
      const img=element('img','community-gallery-photo');
      img.src=item.image;img.alt=item.alt;img.loading='lazy';img.decoding='async';
      const body=element('div','community-gallery-content');
      body.append(element('small','',item.kind==='build'?'Build':item.kind==='creature'?'Creature':'Adventure'),
        element('h3','',item.title));
      if(safeText(item.credit,80))body.append(element('p','','Shared by '+item.credit));
      card.append(img,body);root.append(card);
    }
    if(!list.length)root.append(empty(filter==='all'?'A place for the stories you capture.':'No approved photos in this collection.',
      'The gallery is ready for community-submitted screenshots. Images appear only after staff review and the creator’s permission.','Share a screenshot in Discord ↗'));
    $('community-gallery-status').textContent=list.length?list.length+' approved '+(list.length===1?'photo':'photos'):'No approved gallery photos published yet';
  }
  async function init(){
    $('community-event-kind').addEventListener('change',renderEvents);
    $('community-shop-search').addEventListener('input',renderShops);
    $('community-gallery-filter').addEventListener('change',renderGallery);
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),10000);
      let response;
      try{response=await fetch('/assets/community-content.json',{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});}
      finally{clearTimeout(timer);}
      if(!response.ok || !(response.headers.get('Content-Type')||'').includes('application/json'))throw Error('CATALOG_UNAVAILABLE');
      const data=await response.json();
      if(!data||data.schemaVersion!==1||
        !['shops','updates','gallery'].every(key=>Array.isArray(data[key])&&data[key].length<=100))
        throw Error('CATALOG_INVALID');
      catalog=data;
    }catch(_){
      catalog=null;
      for(const label of ['community-event-status','community-shop-status','community-gallery-status']){
        $(label).textContent='Community listings temporarily unavailable';
      }
    }
    renderEvents();renderShops();renderGallery();
  }
  init();
})();
