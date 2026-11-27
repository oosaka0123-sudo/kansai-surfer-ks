'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const SPOTS=['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto'];
const HOURS=[7,8,9,10];
const dateJST=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
const issuedMs=s=>/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)?Date.parse(s.replace(' ','T')+'+09:00'):NaN;
const timestamp=(date,hour)=>date+'T'+String(hour).padStart(2,'0')+':00';
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max?x:null;
function field(data,key,unit,i,min,max){return data?.hourly_units?.[key]===unit&&i>=0?finite(data.hourly?.[key]?.[i],min,max):null}
function grid(data){const lat=finite(data?.latitude,-90,90),lon=finite(data?.longitude,-180,180);return lat===null||lon===null?null:[lat,lon]}
function exactIndex(a,t){if(!Array.isArray(a))return -1;const i=a.indexOf(t);return i===a.lastIndexOf(t)?i:-1}
function freezeRow(spot,j,captured,date){
 assert(SPOTS.includes(spot)&&j.spot===spot,'wrong spot');
 assert(j._status==='fresh','nonfresh source');
 const issued=issuedMs(j.updated_at);
 assert(Number.isFinite(issued)&&issued<=captured&&captured-issued<=2*3600000,'invalid issue time');
 assert(captured<Date.parse(timestamp(date,7)+'+09:00'),'forecast must precede target');
 assert(date===dateJST(captured+86400000),'only next-day forecast');
 const m=j.marine,w=j.weather,marine=grid(m),weather=grid(w);
 assert(marine&&weather,'invalid grid');
 const values=HOURS.map(h=>{const t=timestamp(date,h),i=exactIndex(m?.hourly?.time,t),k=exactIndex(w?.hourly?.time,t);return [h,field(m,'wave_height','m',i,0,40),field(m,'wave_period','s',i,0.001,40),field(m,'wave_direction','°',i,0,360),field(w,'wind_speed_10m','m/s',k,0,100),field(w,'wind_direction_10m','°',k,0,360)]});
 return {s:spot,issued:j.updated_at,marine,weather,values};
}
const fields=['hour_jst','offshore_model_hs_m','period_s','wave_dir_deg','wind_ms','wind_dir_deg'];
async function capture(now=Date.now(),fetcher=fetch){
 const valid_jst=dateJST(now+86400000),rows=[],missing=[];
 for(const s of SPOTS){try{const r=await fetcher('https://kansai.rss7.net/data/spot_'+s+'.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});assert(r.ok,'HTTP '+r.status);rows.push(freezeRow(s,await r.json(),now,valid_jst))}catch(e){missing.push({s,reason:String(e.message).slice(0,120)})}}
 return {schema:1,captured_at:new Date(now).toISOString(),valid_jst,fields,rows,missing};
}
function validateSnapshot(snap){
 assert(snap.schema===1&&JSON.stringify(snap.fields)===JSON.stringify(fields),'schema');
 const cap=Date.parse(snap.captured_at);assert(Number.isFinite(cap)&&snap.valid_jst===dateJST(cap+86400000),'invalid capture');
 const ids=new Set();for(const row of snap.rows){assert(SPOTS.includes(row.s)&&!ids.has(row.s),'duplicate or unknown spot');ids.add(row.s);const iss=issuedMs(row.issued);assert(Number.isFinite(iss)&&iss<=cap&&cap-iss<=7200000,'invalid issue');assert(Array.isArray(row.values)&&row.values.length===4,'hour count');for(let i=0;i<4;i++){const v=row.values[i];assert(v.length===6&&v[0]===HOURS[i],'hour mismatch');assert(v.slice(1).every(x=>x===null||Number.isFinite(x)),'invalid numeric value');}assert(grid({latitude:row.marine?.[0],longitude:row.marine?.[1]}),'grid');}
 return snap;
}
function distanceKm(a,b){const rad=Math.PI/180,dlat=(a[0]-b[0])*rad,dlon=(a[1]-b[1])*rad,h=Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)))}
function metrics(errors){const n=errors.length;if(!n)return {n:0,bias_m:null,mae_m:null,rmse_m:null};return {n,bias_m:errors.reduce((a,b)=>a+b,0)/n,mae_m:errors.reduce((a,b)=>a+Math.abs(b),0)/n,rmse_m:Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/n)}}
function compare(snap,observations,asOf=Date.now()){
 validateSnapshot(snap);assert(Array.isArray(observations),'observations array required');const matches=[],rejected=[],keys=new Set();
 for(const o of observations){const key=o.spot+'|'+o.station_id+'|'+o.time_jst;
  try{assert(!keys.has(key),'duplicate');keys.add(key);assert(o.kind==='observed_significant_wave_height'&&o.unit==='m','not observed Hs in metres');assert(typeof o.station_id==='string'&&o.station_id.trim()&&typeof o.source_url==='string'&&/^https:\/\//.test(o.source_url),'missing provenance');assert(typeof o.representativeness==='string'&&['same_location','proxy'].includes(o.representativeness),'comparison class missing');assert(typeof o.location_note==='string'&&o.location_note.trim(),'location note required');
   const p=snap.rows.find(x=>x.s===o.spot);assert(p,'no frozen forecast');
   const v=p.values.find(x=>timestamp(snap.valid_jst,x[0])===o.time_jst);assert(v&&finite(v[1],0,40)!==null,'no same-hour valid forecast');assert(Date.parse(o.time_jst+'+09:00')<=asOf,'future observation');
   const y=finite(o.hs_m,0,40),g=grid({latitude:o.latitude,longitude:o.longitude});assert(y!==null&&g,'invalid observation');
   const km=distanceKm(p.marine,g);
   assert(o.representativeness!=='same_location'||km<=1,'same location claim exceeds 1 km; classify proxy');
   matches.push({spot:o.spot,station:o.station_id,time:o.time_jst,distance_km:km,kind:o.representativeness,error_m:v[1]-y});
  }catch(e){rejected.push({key,reason:e.message})}
 }
 // Do not pool different stations or proxy comparisons into one accuracy score.
 const groups={};for(const m of matches){const k=[m.spot,m.station,m.kind].join('|');(groups[k]??=[]).push(m)}
 return {valid_jst:snap.valid_jst,expected_forecast_hours:SPOTS.length*HOURS.length,matches,rejected,groups:Object.fromEntries(Object.entries(groups).map(([k,items])=>[k,{...metrics(items.map(x=>x.error_m)),matched_hours:new Set(items.map(x=>x.time)).size,expected_hours:4}]))};
}
async function cli(){const [mode,a,b]=process.argv.slice(2);if(mode==='capture'){assert(a,'output file required');const snap=await capture();fs.writeFileSync(a,JSON.stringify(snap,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({capture:snap.captured_at,valid:snap.valid_jst,spots:snap.rows.length,missing:snap.missing}));if(snap.missing.length||snap.rows.some(r=>r.values.some(v=>v.slice(1).includes(null))))process.exitCode=2;}else if(mode==='compare'){assert(a&&b,'snapshot and observations files required');console.log(JSON.stringify(compare(JSON.parse(fs.readFileSync(a,'utf8')),JSON.parse(fs.readFileSync(b,'utf8'))),null,2));}else throw Error('capture OUTPUT.json | compare SNAPSHOT.json OBSERVATIONS.json');}
if(require.main===module)cli().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={freezeRow,capture,compare,metrics,validateSnapshot};
