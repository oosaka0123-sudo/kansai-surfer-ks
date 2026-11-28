'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{summarize}=require('../scripts/wind-28day-summary.cjs');
function tests(summarize,check) {
 const date="2026-11-28", d={event:"schedule",forecast_event:"schedule",run_id:10,run_attempt:1,forecast_run_id:9,forecast_run_attempt:1,snapshot:{schema:1,valid_jst:date,captured_at:"2026-11-27T10:30:00Z",rows:[{s:"hakuto",values:[[7,1,7,180,5,90],[8,1,7,180,4,90]]}]},comparison:{date_jst:date,expected:36,rows:[{spot:"hakuto",station_id:"69122",representativeness:"land_station_proxy",time_jst:date+"T07:00",speed_error_ms:2,direction_abs_error_deg:30},{spot:"hakuto",station_id:"69122",representativeness:"land_station_proxy",time_jst:date+"T08:00",speed_error_ms:-1,direction_abs_error_deg:null}],supplemental:{rows:[{spot:"hakuto",station_id:"69052",comparison_role:"supplemental_proxy",representativeness:"land_station_proxy",time_jst:date+"T07:00",speed_error_ms:1,direction_abs_error_deg:15}]}}};
 const copy=()=>JSON.parse(JSON.stringify(d));
 const rejects=(f)=>{let rejected=false;try{f()}catch{rejected=true}check(rejected)};
 let x=summarize(date,[d]);let h=x.groups.find(g=>g.station_id==="69122");let a=x.groups.find(g=>g.station_id==="69052");
 check(x.received_days===1&&x.missing_dates.length===27&&x.groups.length===11);
 check(h.speed_bias_ms===0.5&&h.speed_mae_ms===1.5&&h.speed_rmse_ms===Math.sqrt(2.5)&&h.missing_hours===110&&h.direction_n===1&&h.direction_mae_deg===30);
 check(a.speed_mae_ms===1&&a.matched_hours===1&&a.role==="supplemental_proxy");
 check(summarize(date,[]).groups.every(g=>g.speed_mae_ms===null&&g.missing_hours===112));
 rejects(()=>summarize(date,[d,d]));
 let z=copy();z.event="workflow_dispatch";rejects(()=>summarize(date,[z]));
 z=copy();z.snapshot.captured_at="2026-11-27T07:22:00Z";rejects(()=>summarize(date,[z]));
 z=copy();z.comparison.rows.push(z.comparison.rows[0]);rejects(()=>summarize(date,[z]));
 z=copy();z.comparison.rows[0].speed_error_ms=null;rejects(()=>summarize(date,[z]));
 z=copy();z.comparison.rows[0].station_id="69052";rejects(()=>summarize(date,[z]));
 z=copy();z.comparison.rows[0].direction_abs_error_deg=181;rejects(()=>summarize(date,[z]));
 rejects(()=>summarize("2026-02-30",[]));
 check(x.coefficient_changes_allowed===false);
}
test('28-day audit: cohort, station separation, coverage, missing values and rejection gates',()=>tests(summarize,v=>assert.ok(v)));
