/* Mobile installation only. No analytics, storage, private fetches or background tasks. */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(() => {});
  },{once:true});
  let promptEvent=null;
  let installButton=null;
  const installed=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if(installed)return;
  function showButton(){
    if(installButton||!promptEvent)return;
    installButton=document.createElement('button');
    installButton.type='button';
    installButton.className='app-install-button';
    installButton.textContent='Install Adult ASA app';
    installButton.setAttribute('aria-label','Install Adult ASA on this device');
    Object.assign(installButton.style,{position:'fixed',bottom:'max(16px, env(safe-area-inset-bottom))',right:'16px',zIndex:'35',background:'#8fe9ff',color:'#07101b',border:'1px solid #8fe9ff',borderRadius:'14px',padding:'13px 18px',font:'700 14px system-ui',boxShadow:'0 12px 32px #0009'});
    installButton.addEventListener('click',async()=>{
      if(!promptEvent)return;
      const event=promptEvent;promptEvent=null;installButton.remove();installButton=null;
      try {await event.prompt();await event.userChoice;}catch(_){}
    });
    document.body.append(installButton);
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();promptEvent=event;showButton();
  });
  window.addEventListener('appinstalled',()=>{
    promptEvent=null;installButton?.remove();installButton=null;
  });
})();
