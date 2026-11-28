'use strict';
function holdout(rows){
 const days=new Map();
 for(const r of rows){
  if(!days.has(r.date))days.set(r.date,[]);
  days.get(r.date).push(r);
 }
 const dates=[...days.keys()].sort();
 const base={observed_days:dates.length,matched_hours:rows.length,production_changes_allowed:false};
 if(dates.length!==28||dates.some(d=>days.get(d).length<3))return {...base,status:"insufficient_coverage",candidate_factor:null};
 const trainDates=dates.slice(0,21),testDates=dates.slice(21);
 const train=trainDates.flatMap(d=>days.get(d)),test=testDates.flatMap(d=>days.get(d));
 const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
 const den=sum(train,x=>x.predicted*x.predicted);
 if(den<1)return {...base,status:"insufficient_signal",candidate_factor:null};
 const raw=sum(train,x=>x.predicted*x.observed)/den;
 const factor=Math.min(1.2,Math.max(0.8,raw));
 const score=(rs,k)=>{const errors=rs.map(x=>x.predicted*k-x.observed);return {mae:sum(errors,Math.abs)/errors.length,rmse:Math.sqrt(sum(errors,x=>x*x)/errors.length),max_underprediction:Math.max(0,...errors.map(e=>-e))}};
 const baseline=score(test,1),candidate=score(test,factor);
 const improvedDays=testDates.filter(d=>score(days.get(d),factor).mae<score(days.get(d),1).mae).length;
 const passed=baseline.mae-candidate.mae>=0.05&&candidate.mae<=0.9*baseline.mae&&candidate.rmse<=baseline.rmse&&candidate.max_underprediction<=baseline.max_underprediction+0.05&&improvedDays>=5;
 return {...base,status:passed?"shadow_candidate":"held_no_improvement",candidate_factor:passed?factor:null,training_days:21,holdout_days:7,holdout_baseline:baseline,holdout_candidate:candidate,improved_holdout_days:improvedDays};
}

const fs=require('node:fs'),assert=require('node:assert/strict');
const {summarize}=require('./wave-28day-summary.cjs');
const {compare}=require('./forecast-accuracy-audit.cjs');
function evaluate(end,days){
 // Reuse date, duplicate, cohort and snapshot gates. The local manifest is not authenticated here.
 const audit=summarize(end,days);
 const groups=new Map();
 for(const d of days){
  const s=d.snapshot,date=s.valid_jst,obs=d.observations;
  const result=compare(s,obs);
  const index=new Map(obs.map(o=>[[o.spot,o.station_id,o.time_jst].join('|'),o]));
  for(const m of result.matches){
   const o=index.get([m.spot,m.station,m.time].join('|'));
   const p=s.rows.find(r=>r.s===m.spot),v=p.values.find(r=>r[0]===Number(m.time.slice(11,13)));
   // Separate station/grid/quality/source and proxy class, even when spot matches.
   const quality=['final','provisional'].includes(o.quality_class)?o.quality_class:'unspecified';
   const sourceHost=new URL(o.source_url).hostname;
   const key=JSON.stringify([m.spot,m.station,m.kind,quality,sourceHost,o.latitude,o.longitude,p.marine]);
   if(!groups.has(key))groups.set(key,{spot:m.spot,station:m.station,representativeness:m.kind,quality,source_host:sourceHost,station_coordinates:[o.latitude,o.longitude],marine_grid:p.marine,rows:[]});
   groups.get(key).rows.push({date,predicted:v[1],observed:o.hs_m});
  }
 }
 const reports=[...groups.values()].map(g=>{
  const {rows,...meta}=g;
  // Provisional, unknown quality, and proxy comparisons cannot produce a coefficient proposal.
  if(meta.representativeness!=='same_location'||meta.quality!=='final')return {...meta,status:'diagnostic_only',observed_days:new Set(rows.map(r=>r.date)).size,matched_hours:rows.length,candidate_factor:null,production_changes_allowed:false};
  return {...meta,...holdout(rows),candidate_scope:'offshore_Hs_only'};
 });
 return {schema:1,window_start:audit.window_start,window_end:audit.window_end,received_forecast_days:audit.received_forecast_days,manifest_authentication:'not performed; external verification required',production_changes_allowed:false,model_identity_verified:false,method:'21 consecutive training days, 7 subsequent holdout days, least squares slope clamped 0.8–1.2; at least 3 matched hours/day; require >=0.05m and >=10% MAE improvement, nonworse RMSE and near-nonworse max underprediction, >=5 improved holdout days; experimental thresholds',reports,spots_without_matches:audit.spots_without_matches};
}
module.exports={holdout,evaluate};
if(require.main===module){try{const [end,input]=process.argv.slice(2);assert(input,'Usage: node scripts/wave-calibration-holdout.cjs YYYY-MM-DD MANIFEST.json');console.log(JSON.stringify(evaluate(end,JSON.parse(fs.readFileSync(input,'utf8'))),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
