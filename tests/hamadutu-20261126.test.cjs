const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),cp=require('child_process');
const h=fs.readFileSync('hamadutu.html','utf8'),a=fs.readFileSync('hamadutu-hourly/adapter.js','utf8'),i=fs.readFileSync('hamadutu-hourly/index.html','utf8');
test('spot config and local reporting preserved',()=>{const old=cp.execFileSync('git',['show','05d7765:hamadutu.html'],{encoding:'utf8'});const config=s=>s.match(/const SPOT_CONFIG = \{[\s\S]*?\};/)[0];assert.equal(config(h),config(old));assert(h.includes("p.spot==='hamadutu'"));});
test('section order and Windy coordinates',()=>{const ids=['id="hamadutu-hourly-section"','id="ks10-forecast"','id="hamadutu-windy"','class="wave-report-box"','<span class="no">07</span>','class="context-call"','<span class="no">08</span>'].map(x=>h.indexOf(x));assert(ids.every((x,j)=>x>=0&&(j===0||x>ids[j-1])));assert(h.includes('lat=35.665200&amp;lon=134.966082'));assert(h.includes('overlay=wind')&&h.includes('overlay=waves'));});
test('hourly and tide are site specific',()=>{assert(a.includes('spot_hamadutu.json')&&a.includes('latitude: 35.665200, longitude: 134.966082')&&a.includes('station_id:"T6"'));assert(i.includes('data-default-spot="hamadutu"'));assert(!/kounohama|鳥羽|spot_isonoura|和歌山/.test(a+i));assert(!h.includes('潮位：気象庁・鳥羽'));});
test('JMA 2026 and 2027 complete and station verified',()=>{for(const y of [2026,2027]){const j=JSON.parse(fs.readFileSync('hamadutu-hourly/data/T6-'+y+'.json'));assert.equal(j.station_id,'T6');assert.equal(j.observation,false);assert.equal(j.days.length,365);assert.equal(new Set(j.days.map(d=>d.date)).size,365);assert(j.days.every(d=>d.hourly_cm.length===24&&d.hourly_cm.every(Number.isInteger)));}const d=JSON.parse(fs.readFileSync('hamadutu-hourly/data/T6-2026.json')).days.find(d=>d.date==='2026-11-26');assert.deepEqual(d.high.map(x=>x.time),['01:37','16:51']);assert.deepEqual(d.low.map(x=>x.time),['09:46','20:14']);});
test('script syntax and fallback',()=>{for(const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/application\/ld\+json|src=/.test(m[1]))new vm.Script(m[2]);new vm.Script(a);assert(h.includes('data/spot_hamadutu.json?ks10_cache=')&&h.includes('age<86400000'));});

test('tide link retained',()=>{assert(h.includes('https://www.umitenki.jp/tenki/2621/tide'));assert(!h.includes('https://www.umitenki.jp/tenki/2461/tide'));});

// Execute the production 10-day aggregation in a deterministic, offline VM.
const start=h.indexOf('function rowsOf(marine,weather){'),end=h.indexOf('function track(kind,value,max,text){',start);
assert(start>=0&&end>start);
const date='2026-11-26',plusDate=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const rowsOf=vm.runInNewContext(h.slice(start,end)+';rowsOf', {dateJST:()=>date,plusDate,hourlyMap:x=>new Map((x?.hourly?.time||[]).map((t,i)=>[t,i])),finite:v=>typeof v==='number'&&Number.isFinite(v)?v:null,calcScore:(wave,period,wind,windDir,waveDir)=>wave+wind/10,getVerdict:()=>({text:'mock'}),scoreToStars:()=>'*'});
function fixture(){const m={time:[],wave_height:[],wave_period:[],wave_direction:[]},w={time:[],wind_speed_10m:[],wind_direction_10m:[],weather_code:[]};for(let d=0;d<10;d++)for(const hr of [2,5,6,7,8,9,10,11,12,13,14,15,16,17]){const t=plusDate(date,d)+'T'+String(hr).padStart(2,'0')+':00';m.time.push(t);m.wave_height.push(hr===2?50:1.4);m.wave_period.push(8);m.wave_direction.push(100);w.time.push(t);w.wind_speed_10m.push(hr===2?99:5);w.wind_direction_10m.push(290);w.weather_code.push(0);}return [{hourly:m},{hourly:w}];}
test('ten-day aggregation excludes nighttime outliers and matches same-hour data',()=>{const r=rowsOf(...fixture());assert.equal(r.length,10);for(const d of r){assert.equal(d.max,1.4);assert.equal(d.min,1.4);assert.equal(d.speed,5);assert(Math.abs(d.judgment.score-1.9)<1e-8);}});
test('ten-day missing directions or fewer than seven synchronized observations produce no rating',()=>{let [m,w]=fixture();m.hourly.wave_direction.fill(null);assert(rowsOf(m,w).every(r=>r.judgment===null));[m,w]=fixture();w.hourly.time=w.hourly.time.map(t=>t.replace(/T(\d\d):00$/,'T$1:30'));assert(rowsOf(m,w).every(r=>r.judgment===null));});
test('ten-day absent data remains blank without invented wave or wind',()=>{const r=rowsOf(null,null);assert.equal(r.length,10);assert(r.every(d=>d.min===null&&d.max===null&&d.speed===null&&d.judgment===null));});

const spotId=process.cwd().split(/[\\/]/).pop().match(/ks-(.+)-overhaul-20261126/)[1];
const stationCode={shizunami:'OM',hamadutu:'T6',takahama:'MZ',hakuto:'ZE'}[spotId];
const adapter=fs.readFileSync(spotId+'-hourly/adapter.js','utf8');
const tideYear=JSON.parse(fs.readFileSync(spotId+'-hourly/data/'+stationCode+'-2026.json'));
async function simulateModel({missing=false,stale=false,yearEnd=false}={}){
  const now=Date.parse(yearEnd?'2026-12-31T03:00:00Z':'2026-11-26T03:00:00Z');
  const day=yearEnd?'2026-12-31':'2026-11-26',time=day+'T12:00';
  const state={},win={},root={querySelector:()=>state};
  const geo=adapter.match(/latitude: ([\d.]+), longitude: ([\d.]+)/);
  const model={spot:spotId,updated_at:stale?'2026-11-24 12:00:00':day+' 11:00:00',marine:{hourly:{time:[time],wave_height:[1.2],wave_period:[8]}},weather:{hourly:{time:[time],wind_speed_10m:[4]}}};
  const fetch=async u=>({ok:!(u.includes('2027.json')||missing&&u.includes('spot_')),status:404,json:async()=>u.includes('2026.json')?tideYear:u.includes('spot_')?model:{latitude:+geo[1],longitude:+geo[2],hourly:{time:[time],precipitation:[1.3],precipitation_probability:[80]}}});
  await vm.runInNewContext(adapter,{Date:class extends Date{static now(){return now}},document:{querySelector:q=>q==='[data-forecast]'?root:{},createElement:()=>({}),body:{appendChild:()=>{}}},window:win,AbortController,URLSearchParams,setTimeout,clearTimeout,console:{warn:()=>{}},fetch});
  assert(win.KANTO_FORECAST_DATA);return win.KANTO_FORECAST_DATA;
}
test('model outage and stale model keep independent tide and rain on three-day JST axis',async()=>{
  for(const options of [{missing:true},{stale:true}]){
    const p=await simulateModel(options);assert.equal(p.status,'model_unavailable');assert.equal(p.hourly.length,72);
    assert(p.hourly.every(x=>x.wave_height_m===null&&x.wind_speed_ms===null));
    assert(p.hourly.some(x=>x.precipitation_1h_mm===1.3));assert.equal(p.tide.days.length,365);
  }
  const fresh=await simulateModel();assert.equal(fresh.status,'model_only');assert(fresh.hourly.some(x=>x.wave_height_m===1.2));
});
test('year-end missing next year preserves current-year tide',async()=>{const p=await simulateModel({yearEnd:true});assert.equal(p.tide.days.length,365);assert(p.tide.days.some(x=>x.date==='2026-12-31'));assert.equal(p.hourly.length,72);assert(p.hourly.some(x=>x.time.startsWith('2027-01-02')));});
test('even-number median wave uses both middle hours and flat-wave label matches stars',()=>{
  const config=h.match(/const SPOT_CONFIG = \{[\s\S]*?\};/)[0];
  const actual=h.slice(h.indexOf('function getSpotConfig()'),h.indexOf('function track(kind'));
  const production=vm.runInNewContext(config+actual.replace(/function dateJST\(\)\{[^\n]+\}/,'function dateJST(){return "2026-11-26";}')+';rowsOf');
  const times=[5,6,7,8,9,10,11,12].map(n=>'2026-11-26T'+String(n).padStart(2,'0')+':00');
  const r=production({hourly:{time:times,wave_height:[0,0,0,0,1.2,1.2,1.2,1.2],wave_period:times.map(()=>11),wave_direction:times.map(()=>110)}},{hourly:{time:times,wind_speed_10m:times.map(()=>1),wind_direction_10m:times.map(()=>290)}})[0];
  assert(r.judgment);if(r.judgment.score>=2.5)assert.notEqual(r.judgment.result.text,'諦めよ');
});