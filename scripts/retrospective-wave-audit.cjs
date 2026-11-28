'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {validateSnapshot}=require('./forecast-accuracy-audit.cjs');
const {summarize}=require('./wave-28day-summary.cjs');
const {evaluate}=require('./wave-calibration-holdout.cjs');
const day=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const iso=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&day(d,0)===d;
function build(end,records,observations){
 assert(iso(end)&&Array.isArray(records)&&Array.isArray(observations),'invalid inputs');
 const start=day(end,-27),groups=new Map(),seen=new Set(),obs=new Map();
 for(const item of records){
  const r=item.record,s=validateSnapshot(r.snapshot);
  assert(r.schema===1&&r.forecast_event==='schedule'&&Number.isSafeInteger(r.forecast_run_id)&&r.forecast_run_id>0&&Number.isInteger(r.forecast_run_attempt)&&r.forecast_run_attempt>0,'invalid archive provenance');
  const d=s.valid_jst,k=r.forecast_run_id+'-'+r.forecast_run_attempt;
  assert(item.path==='forecasts/'+d+'/'+k+'.json','archive path mismatch');
  assert(iso(d)&&d>=start&&d<=end&&!seen.has(k),'duplicate/out-of-window archive');
  seen.add(k);
  const t=new Date(Date.parse(s.captured_at)+32400000).toISOString();
  assert(t.slice(0,10)===day(d,-1)&&t.slice(11,16)>='19:30'&&t.slice(11,16)<='22:00','not evening capture');
  assert(s.rows.length===9&&Array.isArray(s.missing)&&!s.missing.length&&s.rows.every(x=>x.values.every(v=>v.slice(1).every(Number.isFinite))),'incomplete archive');
  if(!groups.has(d))groups.set(d,[]);groups.get(d).push(r);
 }
 const observedKeys=new Set();
 for(const o of observations){
  assert(o&&typeof o.time_jst==='string'&&/^\d{4}-\d{2}-\d{2}T(07|08|09|10):00$/.test(o.time_jst),'invalid observation time; do not round timestamps');
  const d=o.time_jst.slice(0,10);assert(iso(d)&&d>=start&&d<=end,'observation out of window');
  const key=[o.spot,o.station_id,o.time_jst].join('|');assert(!observedKeys.has(key),'duplicate observation');observedKeys.add(key);
  if(!obs.has(d))obs.set(d,[]);obs.get(d).push(o);
 }
 const manifest=[],missing=[],unpaired=[],alternate=[];
 for(let i=0;i<28;i++){
  const d=day(start,i),g=groups.get(d);
  if(!g){missing.push(d);if(obs.has(d))unpaired.push({date:d,observations:obs.get(d).length});continue}
  // Predeclare earliest actual capture, not best error. Keep distinct from run-start based wind selection.
  g.sort((a,b)=>Date.parse(a.snapshot.captured_at)-Date.parse(b.snapshot.captured_at)||a.forecast_run_id-b.forecast_run_id||a.forecast_run_attempt-b.forecast_run_attempt);
  const r=g[0];if(g.length>1)alternate.push({date:d,excluded:g.slice(1).map(x=>({run_id:x.forecast_run_id,attempt:x.forecast_run_attempt}))});
  manifest.push({forecast_event:r.forecast_event,forecast_run_id:r.forecast_run_id,forecast_run_attempt:r.forecast_run_attempt,snapshot:r.snapshot,observations:obs.get(d)||[]});
 }
 return {manifest,coverage:{schema:1,window_start:start,window_end:end,archive_selection:'earliest actual capture per date; not chosen by error',missing_forecast_dates:missing,unpaired_observations:unpaired,alternate_forecasts:alternate,archive_authentication:'local copy, verify against trusted Git archive commit',coefficient_changes_allowed:false}};
}
function readArchive(root,end){
 const result=[];
 for(let i=27;i>=0;i--){
  const d=day(end,-i),dir=path.join(root,'forecasts',d);
  if(!fs.existsSync(dir))continue;
  for(const f of fs.readdirSync(dir).sort()){
   assert(/^\d+-\d+\.json$/.test(f),'unexpected archive file');
   const full=path.join(dir,f);assert(fs.lstatSync(full).isFile(),'not regular archive file');
   result.push({path:'forecasts/'+d+'/'+f,record:JSON.parse(fs.readFileSync(full,'utf8'))});
  }
 }
 return result;
}
function run(end,root,obsFile,output){
 assert(iso(end)&&root&&obsFile&&output,'Usage: node scripts/retrospective-wave-audit.cjs YYYY-MM-DD ARCHIVE_DIR OBSERVATIONS.json OUTPUT.json');
 const b=build(end,readArchive(root,end),JSON.parse(fs.readFileSync(obsFile,'utf8')));
 const report={coverage:b.coverage,analysis:summarize(end,b.manifest),holdout:evaluate(end,b.manifest)};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 if(!report.analysis.days_with_matches)process.exitCode=2;
}
module.exports={build,readArchive};
if(require.main===module){try{run(...process.argv.slice(2))}catch(e){console.error(e.message);process.exitCode=1}}
