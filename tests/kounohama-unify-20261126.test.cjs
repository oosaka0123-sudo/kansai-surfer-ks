const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),cp=require('child_process');
const spotId='kounohama';
const stationCode={isonoura:'WY',kounohama:'TB',ikumi:'L7',komatsu:'KM',irago:'I4'}[spotId];
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
