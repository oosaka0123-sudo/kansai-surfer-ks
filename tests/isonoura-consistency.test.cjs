'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'isonoura.html'),'utf8'),js=fs.readFileSync(path.join(root,'nami_isonoura.js'),'utf8');
function codePart(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+1);assert(i>=0&&j>i);return s.slice(i,j);}
test('JST hourly selection is timezone independent',()=>{
 const source=codePart(js,'  const CURRENT_MAX_AGE_MS=','  function isOffshore(deg) {');
 const times=Array.from({length:24},(_,h)=>'2026-11-24T'+String(h).padStart(2,'0')+':00');
 const FakeDate=class extends Date{static now(){return Date.parse('2026-11-24T10:15:00+09:00')}};
 const fn=vm.runInNewContext(source+';findCurrentHourIdx',{Date:FakeDate});
 const prev=process.env.TZ;
 try{for(const tz of ['Asia/Tokyo','UTC','America/Los_Angeles']){process.env.TZ=tz;assert.equal(fn(times),10,tz);}}
 finally{if(prev===undefined)delete process.env.TZ;else process.env.TZ=prev;}
});
function fixture(){
 const m={hourly:{time:[],wave_height:[],wave_period:[],wave_direction:[]}},w={hourly:{time:[],wind_speed_10m:[],wind_direction_10m:[],weather_code:[]}};
 for(let d=0;d<10;d++){
 const date=new Date(Date.parse('2026-11-24T00:00Z')+d*86400000).toISOString().slice(0,10);
 for(const h of [3,5,6,7,8,9,10,11,12,13,14,15,16,17]){
 const t=date+'T'+String(h).padStart(2,'0')+':00';
 m.hourly.time.push(t);m.hourly.wave_height.push(h===3?100:2);m.hourly.wave_period.push(7);m.hourly.wave_direction.push(200);
 w.hourly.time.push(t);w.hourly.wind_speed_10m.push(4);w.hourly.wind_direction_10m.push(240);w.hourly.weather_code.push(0);
 }}return {m,w};
}
const beachContext={};vm.runInNewContext(fs.readFileSync(path.join(root,'isonoura-beach-wave.js'),'utf8'),beachContext);const helpers={window:beachContext,getSpotConfig:()=>({WAVE_FACTOR:.7}),dateJST:()=> '2026-11-24',plusDate:(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),
 hourlyMap:x=>new Map((x?.hourly?.time||[]).map((t,i)=>[t,i])),finite:x=>typeof x==='number'&&Number.isFinite(x)?x:null,
 calcScore:h=>h,getVerdict:()=>({text:'test',action:'action-ok'}),scoreToStars:()=> '★★☆☆☆'};
const rowsOf=vm.runInNewContext(codePart(html,'    function rowsOf(marine,weather){','    function track(kind,value,max,text){')+';rowsOf',helpers);
test('10 daytime rows corrected, same-hour median excludes night peak',()=>{
 const {m,w}=fixture();const rows=rowsOf(m,w);assert.equal(rows.length,10);
 for(const r of rows){assert.ok(Math.abs(r.min-1.4)<1e-8);assert.ok(Math.abs(r.max-1.4)<1e-8);assert.equal(r.speed,4);assert.ok(Math.abs(r.judgment.score-1.4)<1e-8);}
});
test('Incomplete wave directions show no invented rating',()=>{
 const {m,w}=fixture();m.hourly.wave_direction=m.hourly.wave_direction.map((v,i)=>(i%14)>=7?null:v);
 assert.equal(rowsOf(m,w)[0].judgment,null);
});
test('Only Isonoura dedicated JS, null guards and fallback link',()=>{
 assert.match(html,/src="nami_isonoura\.js\?v=20261126-5"/);
 assert.match(js,/AbortController/);
 assert.match(html,/isonoura-hourly\/index\.html/);
 assert.match(html,/id="ks10-updated" role="status"/);
});
