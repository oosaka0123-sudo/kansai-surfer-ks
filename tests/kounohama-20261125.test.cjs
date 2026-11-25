'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'kounohama.html'),'utf8'),dir=path.join(root,'kounohama-hourly');
const adapter=fs.readFileSync(path.join(dir,'adapter.js'),'utf8'),index=fs.readFileSync(path.join(dir,'index.html'),'utf8');
test('only Kounohama coordinates and proper section sequence',()=>{
 const words=['id="ks10-forecast"','id="kounohama-windy"','class="wave-report-box"','class="context-call"'];
 for(const x of words)assert.equal(html.split(x).length-1,1,x);
 const positions=['id="kounohama-hourly-section"','id="ks10-forecast"','id="kounohama-windy"','class="wave-report-box"','<span class="no">06</span>','<span class="no">07</span>','class="context-call"','<span class="no">08</span>'].map(x=>html.indexOf(x));
 assert(positions.every(x=>x>0)&&positions.slice(1).every((x,i)=>x>positions[i]));
 assert(html.includes('lat=34.34&amp;lon=136.92')&&html.includes('zoom=11')&&html.includes('overlay=wind&amp;product=ecmwf'));
 assert.equal((html.match(/sns-(?:ig|fb|tt|x|yt)'\)\?\.addEventListener/g)||[]).length,5);
 assert(!html.includes('id="hourlySvg"'));
});
test('Kounohama hourly sources do not reuse Isonoura model/tide',()=>{
 assert(index.includes('data-default-spot="kounohama"'));
 assert(adapter.includes('spot_kounohama.json')&&adapter.includes('latitude: 34.34, longitude: 136.92'));
 assert(adapter.includes('station_id:"TB"')&&adapter.includes('wave_height_m:modelWave'));
 assert(index.includes('気象庁・鳥羽'));
 assert(!/isonoura|Isonoura|和歌山|Wakayama|WY-/.test(adapter+index));
});
test('JMA Toba tide is 365 complete daily records for each year',()=>{
 for(const year of [2026,2027]){
  const j=JSON.parse(fs.readFileSync(path.join(dir,'data','TB-'+year+'.json'),'utf8'));
  assert.equal(j.station_id,'TB');assert.equal(j.observation,false);assert.equal(j.year,year);assert.equal(j.days.length,365);
  assert.equal(new Set(j.days.map(x=>x.date)).size,365);
  assert(j.days.every(x=>x.hourly_cm.length===24&&x.hourly_cm.every(Number.isInteger)));
 }
 const today=JSON.parse(fs.readFileSync(path.join(dir,'data','TB-2026.json'),'utf8')).days.find(x=>x.date==='2026-11-25');
 assert.deepEqual(today.high.map(x=>x.time),['06:31','17:35']);assert.deepEqual(today.low.map(x=>x.time),['12:04']);
});
const start=html.indexOf('function rowsOf(marine,weather){'),end=html.indexOf('    function track(kind,value,max,text){',start);
assert(start>0&&end>start);
const fns={dateJST:()=> '2026-11-25',plusDate:(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),
 hourlyMap:x=>new Map((x?.hourly?.time||[]).map((t,i)=>[t,i])),finite:v=>typeof v==='number'&&Number.isFinite(v)?v:null,
 calcScore:h=>h,getVerdict:()=>({text:'test',action:'mock',emoji:'test'}),scoreToStars:()=> '★'};
const rowsOf=vm.runInNewContext(html.slice(start,end)+';rowsOf',fns);
function fixture(){
 const marine={hourly:{time:[],wave_height:[],wave_period:[],wave_direction:[]}},weather={hourly:{time:[],wind_speed_10m:[],wind_direction_10m:[],weather_code:[]}};
 for(let day=0;day<10;day++){const date=fns.plusDate('2026-11-25',day);for(const hour of [2,5,6,7,8,9,10,11,12,13,14,15,16,17]){
 const stamp=date+'T'+String(hour).padStart(2,'0')+':00';marine.hourly.time.push(stamp);marine.hourly.wave_height.push(hour===2?50:1.4);
 marine.hourly.wave_period.push(8);marine.hourly.wave_direction.push(100);weather.hourly.time.push(stamp);weather.hourly.wind_speed_10m.push(5);weather.hourly.wind_direction_10m.push(290);weather.hourly.weather_code.push(0);}}
 return {marine,weather};
}
test('10day uses only 05-17 synchronized scores, not 2am 50m',()=>{
 const data=fixture(),rows=rowsOf(data.marine,data.weather);assert.equal(rows.length,10);
 for(const r of rows){assert(Math.abs(r.max-1.4)<1e-8);assert(Math.abs(r.judgment.score-1.4)<1e-8);}
});
test('no rating if wave direction unknown',()=>{
 const data=fixture();data.marine.hourly.wave_direction.fill(null);
 const rows=rowsOf(data.marine,data.weather);assert.equal(rows[0].judgment,null);
});

test('iframe height uses forecast component and shared refresh button reloads chart',()=>{
 const inner=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
 assert(inner.includes("getBoundingClientRect().height"));
 assert(!inner.includes('setInterval(send,2000)'));
 assert(html.includes("frame.src=base+'&_refresh='+Date.now()"));
 assert(html.includes('height>=320&&height<=2200'));
 assert(app.includes('(root.dataset.defaultSpot||"kounohama")'));
});
test('10day starts after DOM parsing and falls back to fresh local site forecast without guessing',()=>{
 assert(html.includes("document.addEventListener('DOMContentLoaded',load,{once:true})"));
 assert(html.includes('configWaits++<12'));
 assert(html.includes("data/spot_kounohama.json?ks10_cache="));
 assert(html.includes("age<86400000"));
 assert(html.includes("savedCache={marine:siteData.marine,weather:siteData.weather}"));
 assert(html.includes("10日分取得不可：サイト保存分"));
});