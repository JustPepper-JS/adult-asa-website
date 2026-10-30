/* Public app shell only. Never cache authentication, status, player history or API data. */
'use strict';
const ALLOWED = new Set(['/','/servers','/meet-the-players','/mods']);
const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#081321"><title>Adult ASA — Offline</title><style>body{margin:0;min-height:100vh;background:#07101b;color:#f0f5ff;font:16px system-ui;display:grid;place-items:center;padding:24px;box-sizing:border-box}main{max-width:460px;padding:32px;border:1px solid #304358;background:#101f32;border-radius:24px}h1{margin:0 0 14px;font-size:30px}p{color:#bbc9de;line-height:1.65}a{display:inline-block;margin-top:14px;color:#07101b;background:#8fe9ff;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none}</style></head><body><main><h1>Adult ASA is offline</h1><p>Your device cannot reach the website right now. Server statuses and player records are never stored for offline viewing, so no stale or invented counts are shown.</p><a href="/">Try again</a></main></body></html>`;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.mode!=='navigate'||req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin!==self.location.origin||!ALLOWED.has(u.pathname)||u.search)return;
  event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>
    new Response(OFFLINE,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
