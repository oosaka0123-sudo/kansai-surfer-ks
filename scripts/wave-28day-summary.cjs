'use strict';
function directionBand(v){if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>360)return "unknown";return ["N","NE","E","SE","S","SW","W","NW"][Math.floor(((v%360)+22.5)/45)%8]}
function periodBand(v){if(typeof v!=="number"||!Number.isFinite(v)||v<=0||v>40)return "unknown";return v<6?"<6":v<8?"6-<8":v<10?"8-<10":v<12?"10-<12":"12+"}

const fs=require('node:fs'),assert=require('node:assert/strict');
const {compare,validateSnapshot,metrics}=require('./forecast-accuracy-audit.cjs');
const spots=['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto'];
const dateAt=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
function summarize(end,days){
 assert(/^\d{4}-\d{2}-\d{2}$/.test(end)&&dateAt(end,0)===end&&Array.isArray(days),'invalid window/input');
 const start=dateAt(end,-27),groups=new Map(),seenDates=new Set(),seenRuns=new Set(),rejects=[],seenSpots=new Set(),dayCounts={};
 for(const d of days){
  assert(d?.forecast_event==='schedule'&&Number.isSafeInteger(d.forecast_run_id)&&d.forecast_run_id>0&&Number.isInteger(d.forecast_run_attempt)&&d.forecast_run_attempt>0,'scheduled provenance required');
  const s=validateSnapshot(d.snapshot),date=s.valid_jst;
  assert(date>=start&&date<=end&&dateAt(date,0)===date,'date outside window');
  assert(!seenDates.has(date)&&!seenRuns.has(d.forecast_run_id),'duplicate date/run');
  seenDates.add(date);seenRuns.add(d.forecast_run_id);
  const local=new Date(Date.parse(s.captured_at)+32400000).toISOString();
  assert(local.slice(0,10)===dateAt(date,-1)&&local.slice(11,16)>='19:30'&&local.slice(11,16)<='22:00','not scheduled evening cohort');
  assert(Array.isArray(d.observations),'missing observations array');
  const index=new Map();
  for(const o of d.observations){const key=[o.spot,o.station_id,o.time_jst].join('|');assert(!index.has(key),'duplicate observation');index.set(key,o);}
  const c=compare(s,d.observations);
  rejects.push(...c.rejected.map(r=>({date,...r})));
  for(const r of c.matches){
   const o=index.get([r.spot,r.station,r.time].join('|')),p=s.rows.find(x=>x.s===r.spot),v=p.values.find(x=>x[0]===Number(r.time.slice(11,13)));
   const quality=['provisional','final'].includes(o.quality_class)?o.quality_class:'unspecified';
   const key=JSON.stringify([r.spot,r.station,r.kind,quality,o.latitude,o.longitude,p.marine]);
   let g=groups.get(key);if(!g){g={spot:r.spot,station_id:r.station,representativeness:r.kind,quality_class:quality,station_coordinates:[o.latitude,o.longitude],marine_grid:p.marine,errors:[],dates:new Set(),direction:new Map(),period:new Map(),joint:new Map()};groups.set(key,g);}
   const dir=directionBand(v[3]),period=periodBand(v[2]);
   g.errors.push(r.error_m);g.dates.add(date);seenSpots.add(r.spot);dayCounts[date]=(dayCounts[date]||0)+1;
   for(const [map,b] of [[g.direction,dir],[g.period,period],[g.joint,dir+'|'+period]]){if(!map.has(b))map.set(b,{errors:[],dates:new Set()});const entry=map.get(b);entry.errors.push(r.error_m);entry.dates.add(date);}
  }
 }
 const byBand=m=>[...m.entries()].map(([band,x])=>({band,observed_days:x.dates.size,...metrics(x.errors)})).sort((a,b)=>a.band.localeCompare(b.band));
 return {schema:1,window_start:start,window_end:end,cohort:'scheduled_evening_offline_manifest',manifest_authentication:'not performed by this offline CLI',direction_and_period_basis:'frozen forecast, not observed direction or period',expected_days:28,received_forecast_days:seenDates.size,days_with_matches:Object.keys(dayCounts).length,missing_forecast_dates:Array.from({length:28},(_,i)=>dateAt(start,i)).filter(d=>!seenDates.has(d)),spots_without_matches:spots.filter(s=>!seenSpots.has(s)),coefficient_changes_allowed:false,rejected:rejects,groups:[...groups.values()].map(g=>({spot:g.spot,station_id:g.station_id,representativeness:g.representativeness,quality_class:g.quality_class,station_coordinates:g.station_coordinates,marine_grid:g.marine_grid,observed_days:g.dates.size,expected_hours:112,...metrics(g.errors),by_forecast_direction:byBand(g.direction),by_forecast_period:byBand(g.period),by_forecast_direction_period:byBand(g.joint)}))};
}
module.exports={summarize,directionBand,periodBand};
if(require.main===module){try{const [end,input]=process.argv.slice(2);assert(input,'Usage: node scripts/wave-28day-summary.cjs YYYY-MM-DD MANIFEST.json');console.log(JSON.stringify(summarize(end,JSON.parse(fs.readFileSync(input,'utf8'))),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
