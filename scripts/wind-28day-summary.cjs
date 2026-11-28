'use strict';
function summarize(end, days) {
 const ids={isonoura:"65042",kounohama:"53257",ikumi:"71291",komatsu:"71106",irago:"51346",shizunami:"50551",hamadutu:"61001",takahama:"57317",hakuto:"69122"};
 const aux=["69052","69041"];
 const fail=m=>{throw Error(m)};
 const dateOK=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 if(!dateOK(end)||!Array.isArray(days))fail("invalid end date or input");
 const dateAt=(d,n)=>new Date(Date.parse(d+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
 const start=dateAt(end,-27), groups=new Map(), seenDays=new Set(), seenRuns=new Set();
 for(const [s,id] of Object.entries(ids))groups.set(s+"|"+id,{spot:s,station_id:id,role:"primary_proxy",speed:[],direction:[],dates:new Set()});
 for(const id of aux)groups.set("hakuto|"+id,{spot:"hakuto",station_id:id,role:"supplemental_proxy",speed:[],direction:[],dates:new Set()});
 const accepted=[];
 for(const d of days) {
  if(!d||d.event!=="schedule"||d.forecast_event!=="schedule"||!Number.isSafeInteger(d.run_id)||d.run_id<=0||!Number.isSafeInteger(d.forecast_run_id)||d.forecast_run_id<=0||!Number.isInteger(d.run_attempt)||d.run_attempt<1||!Number.isInteger(d.forecast_run_attempt)||d.forecast_run_attempt<1)fail("scheduled artifact provenance required");
  const c=d.comparison,s=d.snapshot;
  if(!c||!s||!dateOK(c.date_jst)||s.valid_jst!==c.date_jst||s.schema!==1)fail("invalid date/schema");
  const date=c.date_jst;
  if(date<start||date>end)fail("date outside 28-day window");
  if(seenDays.has(date)||seenRuns.has(d.run_id)||seenRuns.has(d.forecast_run_id)||d.run_id===d.forecast_run_id)fail("duplicate date or run");
  seenDays.add(date);seenRuns.add(d.run_id);seenRuns.add(d.forecast_run_id);
  if(typeof s.captured_at!=="string"||!Number.isFinite(Date.parse(s.captured_at)))fail("invalid capture time");
  const capture=new Date(Date.parse(s.captured_at)+32400000).toISOString();
  if(capture.slice(0,10)!==dateAt(date,-1)||capture.slice(11,16)<"19:30"||capture.slice(11,16)>"22:00")fail("not an evening cohort");
  if(c.expected!==36||!Array.isArray(c.rows)||!Array.isArray(s.rows)||!Array.isArray(c.supplemental?.rows??[]))fail("invalid comparison");
  const unique=new Set();
  for(const [role,rows] of [["primary_proxy",c.rows],["supplemental_proxy",c.supplemental?.rows??[]]])for(const r of rows){
   const g=groups.get(r.spot+"|"+r.station_id),hour=Number(r.time_jst?.slice(11,13));
   if(!g||g.role!==role||r.representativeness!=="land_station_proxy"||!Number.isInteger(hour)||hour<7||hour>10||r.time_jst!==date+"T"+String(hour).padStart(2,"0")+":00")fail("invalid station or observation time");
   if(role==="supplemental_proxy"&&r.comparison_role!=="supplemental_proxy")fail("invalid supplemental role");
   const key=r.spot+"|"+r.station_id+"|"+r.time_jst;
   if(unique.has(key))fail("duplicate observation");
   unique.add(key);
   const matching=s.rows.filter(p=>p.s===r.spot);
   const values=matching.length===1&&Array.isArray(matching[0].values)?matching[0].values.filter(v=>v[0]===hour):[];
   const v=values.length===1?values[0]:null;
   if(!v||!Number.isFinite(v[4])||v[4]<0||v[4]>100||!Number.isFinite(r.speed_error_ms)||v[4]-r.speed_error_ms<0||v[4]-r.speed_error_ms>100)fail("invalid wind error or frozen forecast");
   if(r.direction_abs_error_deg!==null&&(!Number.isFinite(r.direction_abs_error_deg)||r.direction_abs_error_deg<0||r.direction_abs_error_deg>180||v[4]<=0.2||v[4]-r.speed_error_ms<=0.2||!Number.isFinite(v[5])||v[5]<0||v[5]>360))fail("invalid direction error");
   g.speed.push(r.speed_error_ms);if(r.direction_abs_error_deg!==null)g.direction.push(r.direction_abs_error_deg);g.dates.add(date);
  }
  accepted.push({date,run_id:d.run_id,run_attempt:d.run_attempt,forecast_run_id:d.forecast_run_id,forecast_run_attempt:d.forecast_run_attempt});
 }
 const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
 return {schema:1,window_start:start,window_end:end,cohort:"scheduled_evening",expected_days:28,received_days:seenDays.size,missing_dates:Array.from({length:28},(_,i)=>dateAt(start,i)).filter(d=>!seenDays.has(d)),artifacts:accepted.sort((a,b)=>a.date.localeCompare(b.date)),coefficient_changes_allowed:false,groups:[...groups.values()].map(g=>({spot:g.spot,station_id:g.station_id,role:g.role,expected_hours:112,matched_hours:g.speed.length,missing_hours:112-g.speed.length,observed_days:g.dates.size,speed_bias_ms:mean(g.speed),speed_mae_ms:mean(g.speed.map(Math.abs)),speed_rmse_ms:g.speed.length?Math.sqrt(mean(g.speed.map(v=>v*v))):null,direction_n:g.direction.length,direction_mae_deg:mean(g.direction)}))};
}
module.exports={summarize};
if(require.main===module){try{const [end,input]=process.argv.slice(2);if(!input)throw Error('Usage: node scripts/wind-28day-summary.cjs YYYY-MM-DD INPUT.json');console.log(JSON.stringify(summarize(end,JSON.parse(require('node:fs').readFileSync(input,'utf8'))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
