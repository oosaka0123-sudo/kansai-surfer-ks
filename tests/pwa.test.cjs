'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const handlers={},deleted=[];let claimed=false,skipped=false,offline=false,options;
const ctx={URL,Response,self:{location:{origin:'https://kansai.rss7.net'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{claimed=true;}}},caches:{keys:async()=>['ks-pwa-v1020','ks-pwa-v999','other-cache'],delete:async k=>deleted.push(k)},fetch:async(r,o)=>{options=o;if(offline)throw Error('offline');return new Response('fresh');}};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),ctx);
function lifecycle(name){let p;handlers[name]({waitUntil:x=>p=x});return p;}
function req(path,mode='navigate',destination='document',method='GET'){let p;handlers.fetch({request:{url:new URL(path,ctx.self.location.origin).href,mode,destination,method},respondWith:x=>p=x});return p;}
(async()=>{
 await lifecycle('install');assert.ok(skipped);await lifecycle('activate');assert.ok(claimed);assert.deepEqual(deleted,['ks-pwa-v1020','ks-pwa-v999']);
 for(const p of ['/','/index.html?source=pwa',...['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto','ukibuchi','irino','futami','hirano','oki'].map(x=>'/'+x+'.html')]){assert.equal(await(await req(p)).text(),'fresh');assert.equal(options.cache,'no-store');}
 for(const p of ['/data/wave_api.json','/shimanto/spot-candidates.json','/admin/','/blog/','https://marine-api.open-meteo.com/v1/marine','https://maps.google.com/maps'])assert.equal(req(p),undefined,p);
 assert.equal(req('/ukibuchi.html','navigate','iframe'),undefined);assert.equal(req('/','navigate','document','POST'),undefined);
 offline=true;const r=await req('/ukibuchi.html');assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(await r.text(),/古い予報は表示していません/);
 const m=JSON.parse(fs.readFileSync('manifest.json','utf8'));assert.equal(m.id,'/');assert.equal(m.scope,'/');assert.equal(m.display,'standalone');assert.equal(m.start_url,'/index.html?source=pwa');assert.equal(m.icons.length,4);
 console.log('KS PWA checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
