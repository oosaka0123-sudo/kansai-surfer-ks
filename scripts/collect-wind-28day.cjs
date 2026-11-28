'use strict';
function selectRuns(runs, date, mode) {
 const start=mode==="forecast"?"19:30":"11:00",end=mode==="forecast"?"22:00":"15:00";
 const candidates=runs.filter(r=>{
  if(r.event!=="schedule"||r.head_branch!=="main"||r.conclusion!=="success"||r.status!=="completed"||!Number.isSafeInteger(r.id)||!Number.isInteger(r.run_attempt)||r.run_attempt<1||!Number.isFinite(Date.parse(r.run_started_at)))return false;
  const t=new Date(Date.parse(r.run_started_at)+32400000).toISOString();
  return t.slice(0,10)===date&&t.slice(11,16)>=start&&t.slice(11,16)<=end;
 });
 return candidates.sort((a,b)=>Date.parse(a.run_started_at)-Date.parse(b.run_started_at)||a.id-b.id);
}
function shiftDate(date,n){return new Date(Date.parse(date+"T00:00:00Z")+n*86400000).toISOString().slice(0,10)}

const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const {summarize}=require('./wind-28day-summary.cjs');
const {compare}=require('./amedas-wind-audit.cjs');
const {validateSnapshot}=require('./forecast-accuracy-audit.cjs');
function collect(repo,end,out) {
 assert(/^[\w.-]+\/[\w.-]+$/.test(repo),'invalid repository');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(end)&&shiftDate(end,0)===end,'invalid date');
 assert(end<=new Date(Date.now()+32400000).toISOString().slice(0,10),'future date');
 const start=shiftDate(end,-27);
 const gh=(args)=>execFileSync('gh',args,{encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
 const list=(workflow)=>JSON.parse(gh(['api','--paginate','--slurp','repos/'+repo+'/actions/workflows/'+workflow+'/runs?event=schedule&branch=main&status=success&created='+shiftDate(start,-1)+'..'+end+'&per_page=100'])).flatMap(p=>p.workflow_runs);
 const forecasts=list('forecast-audit-capture.yml'),mornings=list('forecast-audit-wind.yml');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ks-wind-'));
 const days=[],rejected=[];
 const download=(run,name,dir)=>{fs.mkdirSync(dir);gh(['run','download',String(run.id),'-R',repo,'-n',name,'-D',dir]);};
 const read=(dir,file)=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
 try {
 for(let i=0;i<28;i++){
  const date=shiftDate(start,i),prev=shiftDate(date,-1);
  const ms=selectRuns(mornings,date,'morning'),ps=selectRuns(forecasts,prev,'forecast');
  if(!ms.length||!ps.length){rejected.push({date,reason:!ms.length?'no_successful_morning_run':'no_successful_forecast_run'});continue}
  const m=ms[0],p=ps[0];
  const md=path.join(temp,date+'-morning'),pd=path.join(temp,date+'-forecast');
  try{
   download(m,'ks-wind-audit-schedule-'+m.id+'-'+m.run_attempt,md);
   download(p,'ks-forecast-schedule-'+p.id+'-'+p.run_attempt,pd);
   const snapshot=validateSnapshot(read(pd,'snapshot.json'));
   assert.deepEqual(read(md,'forecast/snapshot.json'),snapshot,'snapshot does not match original artifact');
   const stored=read(md,'comparison.json'),obs=read(md,'wind.json');
   const comparison=compare(snapshot,obs);
   // Existing historical comparisons may predate supplemental rows; compare primary rows exactly.
   assert.deepEqual(stored.rows,comparison.rows,'primary comparison mismatch');
   if(stored.supplemental)assert.deepEqual(stored.supplemental,comparison.supplemental,'supplemental comparison mismatch');
   days.push({event:m.event,forecast_event:p.event,run_id:m.id,run_attempt:m.run_attempt,forecast_run_id:p.id,forecast_run_attempt:p.run_attempt,snapshot,comparison});
  }catch(e){rejected.push({date,reason:'artifact_or_validation_failure',message:String(e.message).slice(0,300)});}
 }
 const result=summarize(end,days);
 result.collection_status=rejected.some(r=>r.reason==='artifact_or_validation_failure')?'validation_errors':days.length===0?'no_valid_data':days.length===28?'complete_window':'partial_window';
 result.collection_rejections=rejected;
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:result.collection_status,received_days:result.received_days,expected_days:28}));
 if(result.collection_status==='validation_errors'||result.collection_status==='no_valid_data')process.exitCode=2;
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
module.exports={selectRuns,shiftDate,collect};
if(require.main===module){try{const [repo,end,out]=process.argv.slice(2);assert(out,'Usage: collect-wind-28day.cjs OWNER/REPO YYYY-MM-DD OUT.json');collect(repo,end,out)}catch(e){console.error(e.message);process.exitCode=1;}}
