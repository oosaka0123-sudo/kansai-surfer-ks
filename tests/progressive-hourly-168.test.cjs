const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const codes={isonoura:'WY',kounohama:'TB',ikumi:'L7',komatsu:'KM',irago:'I4',shizunami:'OM',hamadutu:'T6',takahama:'MZ',hakuto:'ZE'};
const now=Date.parse('2026-11-27T08:12:00+09:00'),time='2026-11-27T08:00';
const DateMock=class extends Date{static now(){return now;}};
const response=v=>({ok:true,json:async()=>v});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const [s,code] of Object.entries(codes))test(s+' renders first available source and never waits for delayed rain; refresh is atomic',async()=>{
 const dir=s+'-hourly/',src=fs.readFileSync(dir+'adapter.js','utf8'),app=fs.readFileSync(dir+'app.js','utf8'),geo=src.match(/latitude: ([\d.]+), longitude: ([\d.]+)/);
 const tide=JSON.parse(fs.readFileSync(dir+'data/'+code+'-2026.json'));
 const model={spot:s,updated_at:'2026-11-27 08:05:00',marine:{hourly:{time:[time],wave_height:[1.2],wave_period:[8],wave_direction:[200],swell_wave_height:[1],swell_wave_period:[8],swell_wave_direction:[200]}},weather:{hourly:{time:[time],wind_speed_10m:[4],wind_direction_10m:[0]}}};
 const rain={latitude:+geo[1],longitude:+geo[2],hourly:{time:[time],precipitation:[1.3],precipitation_probability:[80]}};
 const state={},win={},root={querySelector:()=>state},seen=[];let release,fail=false,scriptCount=0,fetchCount=0;
 if(s==='isonoura')vm.runInNewContext(fs.readFileSync('isonoura-beach-wave.js','utf8'),win);
 const fetch=async u=>{fetchCount++;if(u.includes('spot_'))return response(model);if(u.includes('2026.json'))return response(tide);return new Promise((resolve,reject)=>{release=()=>fail?reject(Error('simulated rain outage')):resolve(response(rain))});};
 const run=vm.runInNewContext(src,{Date:DateMock,document:{querySelector:q=>q==='[data-forecast]'?root:{},createElement:()=>({}),body:{appendChild:()=>{scriptCount++;win.ksHourlySourceChanged=p=>seen.push(p)}}},window:win,AbortController,URLSearchParams,setTimeout,clearTimeout,console:{warn(){}},fetch});
 try{await tick();assert.equal(scriptCount,1);const partial=win.KANTO_FORECAST_DATA;assert.equal(partial.status,'model_only');assert.deepEqual(Array.from(partial.pending_sources),['rain']);assert.equal(partial.tide.days.length,365);assert(partial.hourly.some(x=>x.wave_height_m!==null));assert(partial.hourly.every(x=>x.precipitation_1h_mm===null));assert.equal(typeof release,'function');const joined=win.ksRefreshHourlyForecast();assert.equal(fetchCount,3);release();await run;const final=await joined;assert.equal(final,win.KANTO_FORECAST_DATA);assert.equal(final.pending_sources.length,0);assert(final.hourly.some(x=>x.precipitation_1h_mm===1.3));assert.equal(scriptCount,1);assert(seen.includes(final));
 const previous=win.KANTO_FORECAST_DATA;fail=true;const refresh=win.ksRefreshHourlyForecast();await tick();assert.equal(win.KANTO_FORECAST_DATA,previous);release();const unavailable=await refresh;assert.equal(unavailable.status,'model_only');assert.equal(unavailable.tide.days.length,365);assert(unavailable.hourly.every(x=>x.precipitation_1h_mm===null));assert.equal(scriptCount,1);assert.equal(fetchCount,6);assert(app.includes('window.ksHourlySourceChanged=applySource'));assert(app.includes('source.pending_sources?.length'));}finally{if(release)release();await run;}
});