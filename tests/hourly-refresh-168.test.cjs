const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const codes={isonoura:'WY',kounohama:'TB',ikumi:'L7',komatsu:'KM',irago:'I4',shizunami:'OM',hamadutu:'T6',takahama:'MZ',hakuto:'ZE'};
for(const [s,code] of Object.entries(codes))test(s+' refreshes three-day axis and tide across midnight, rejects empty data',async()=>{
 const dir=s+'-hourly/',src=fs.readFileSync(dir+'adapter.js','utf8'),app=fs.readFileSync(dir+'app.js','utf8');let now=Date.parse('2026-12-31T23:59:00+09:00'),empty=false,requests=[],scripts=0;
 const DateMock=class extends Date{static now(){return now;}};
 const day=()=>new Date(now+9*3600000).toISOString().slice(0,10);
 const state={},win={},root={querySelector:()=>state},geo=src.match(/latitude: ([\d.]+), longitude: ([\d.]+)/);
 assert(geo,s);
 if(s==='isonoura'){vm.runInNewContext(fs.readFileSync('isonoura-beach-wave.js','utf8'),win);}
 const fetch=async u=>{requests.push(u);const t=day()+'T12:00';const times=empty?[]:[t];const data=u.includes('spot_')?{spot:s,updated_at:new Date(now).toISOString(),marine:{hourly:{time:times,wave_height:[1.2],wave_period:[8],wave_direction:[200],swell_wave_height:[1],swell_wave_period:[8],swell_wave_direction:[200]}},weather:{hourly:{time:times,wind_speed_10m:[4],wind_direction_10m:[0]}}}:u.includes('.json')?JSON.parse(fs.readFileSync(dir+'data/'+code+'-'+(u.includes('2027')?'2027':'2026')+'.json')):{latitude:+geo[1],longitude:+geo[2],hourly:{time:[t],precipitation:[1.3],precipitation_probability:[80]}};
 return{ok:true,json:async()=>data}};
 await vm.runInNewContext(src,{Date:DateMock,document:{querySelector:q=>q==='[data-forecast]'?root:{},createElement:()=>({}),body:{appendChild:()=>{scripts++}}},window:win,AbortController,URLSearchParams,setTimeout,clearTimeout,console:{warn(){}},fetch});
 assert.equal(win.KANTO_FORECAST_DATA.status,'model_only');assert.equal(win.KANTO_FORECAST_DATA.hourly.length,72);assert.equal(scripts,1);
 const before=win.KANTO_FORECAST_DATA.hourly[0].time;now+=120000;requests=[];const next=await win.ksRefreshHourlyForecast();assert.notEqual(next.hourly[0].time,before);assert(next.hourly[71].time.startsWith('2027-01-03'));assert(next.tide.days.some(x=>x.date==='2027-01-01'));assert(requests.some(u=>u.includes('spot_')&&u.includes(String(now))));assert(requests.some(u=>u.includes('2027.json')));assert.equal(scripts,1);
 empty=true;const missing=await win.ksRefreshHourlyForecast();assert.equal(missing.status,'model_unavailable');assert(missing.hourly.every(x=>x.wave_height_m===null&&x.wind_speed_ms===null));assert(missing.tide.days.length>=365);
 assert(app.includes('if(changed||Date.now()-lastReload>=15*60000)void refreshData()'));assert(app.includes('visibilitychange'));assert(app.includes('source=next;'));
});