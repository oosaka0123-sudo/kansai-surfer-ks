'use strict';
// KS PWA: live surf information must never be served from an offline cache.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys()){
    if(/^ks-pwa-v\d+$/.test(key)) await caches.delete(key);
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  // Do not intercept API, camera, static resources or private requests.
  // Only same-origin top-level public navigations need a clear offline response.
  if(request.mode!=='navigate'||request.destination!=='document') return;
  if(!/^\/(?:index\.html|(?:isonoura|kounohama|ikumi|komatsu|irago|shizunami|hamadutu|takahama|hakuto|ukibuchi|irino|futami|hirano|oki)\.html)?$/.test(url.pathname)) return;
  event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>new Response(
    '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>通信できません｜関西サーファーKS</title><body style="background:#0a1520;color:#fff;font:16px system-ui;padding:32px;line-height:1.7"><h1>通信できません</h1><p>最新の波・風・潮位を取得できません。古い予報は表示していません。</p><p>通信状況を確認して、ページを再読み込みしてください。</p><a href="/" style="color:#8bd5ff">ホームに戻る</a></body></html>',
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
  )));
});
