'use strict';
function archiveRecord(run,snapshot,validate){
 const assert=(v,msg)=>{if(!v)throw Error(msg)};
 const integer=n=>Number.isSafeInteger(n)&&n>0;
 assert(run.event==="schedule"&&run.head_branch==="main"&&run.status==="completed"&&run.conclusion==="success"&&run.path===".github/workflows/forecast-audit-capture.yml"&&integer(run.id)&&integer(run.run_attempt),"not a successful scheduled KS capture");
 validate(snapshot);
 const start=Date.parse(run.run_started_at),cap=Date.parse(snapshot.captured_at),local=new Date(cap+32400000).toISOString();
 assert(Number.isFinite(start)&&Number.isFinite(cap)&&cap>=start&&cap-start<=15*60000&&local.slice(11,16)>="19:30"&&local.slice(11,16)<="22:00","capture outside run/window");
 const spots=["isonoura","kounohama","ikumi","komatsu","irago","shizunami","hamadutu","takahama","hakuto"];
 const ranges=[[0,40],[0.001,40],[0,360],[0,100],[0,360]];
 const grid=g=>Array.isArray(g)&&g.length===2&&typeof g[0]==="number"&&typeof g[1]==="number"&&Math.abs(g[0])<=90&&Math.abs(g[1])<=180;
 assert(snapshot.rows.length===9&&Array.isArray(snapshot.missing)&&snapshot.missing.length===0,"incomplete forecast");
 const rows=spots.map(s=>{const r=snapshot.rows.find(x=>x.s===s);assert(r&&grid(r.marine)&&grid(r.weather)&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.issued),"invalid forecast row");
  assert(r.values.every(v=>v.length===6&&v.slice(1).every((x,i)=>typeof x==="number"&&Number.isFinite(x)&&x>=ranges[i][0]&&x<=ranges[i][1])),"invalid forecast values");
  return {s,issued:r.issued,marine:r.marine,weather:r.weather,values:r.values};});
 const record={schema:1,forecast_event:"schedule",forecast_run_id:run.id,forecast_run_attempt:run.run_attempt,snapshot:{schema:1,captured_at:new Date(cap).toISOString(),valid_jst:snapshot.valid_jst,fields:snapshot.fields,rows,missing:[]}};
 return {path:"forecasts/"+snapshot.valid_jst+"/"+run.id+"-"+run.run_attempt+".json",record};
}
function health(date,forecasts,mornings,archives){
 const prev=new Date(Date.parse(date+"T00:00:00Z")-86400000).toISOString().slice(0,10);
 const pick=(runs,d,from,to,path)=>runs.filter(r=>r.event==="schedule"&&r.head_branch==="main"&&r.path===path&&r.status==="completed"&&r.conclusion==="success"&&Number.isSafeInteger(r.id)&&Number.isInteger(r.run_attempt)&&Number.isFinite(Date.parse(r.run_started_at))).filter(r=>{const t=new Date(Date.parse(r.run_started_at)+32400000).toISOString();return t.slice(0,10)===d&&t.slice(11,16)>=from&&t.slice(11,16)<=to}).sort((a,b)=>Date.parse(a.run_started_at)-Date.parse(b.run_started_at)||a.id-b.id);
 const p=pick(forecasts,prev,"19:30","22:00",".github/workflows/forecast-audit-capture.yml")[0],m=pick(mornings,date,"11:00","15:00",".github/workflows/forecast-audit-wind.yml")[0];
 const key=p?"forecasts/"+date+"/"+p.id+"-"+p.run_attempt+".json":null;
 const status={forecast:p?"success":"missing_or_failed",morning:m?"success":"missing_or_failed",archive:p?(archives.includes(key)?"present":"missing"):"not_applicable"};
 return {schema:1,date_jst:date,forecast_run_id:p?.id??null,morning_run_id:m?.id??null,archive_path:key,status,healthy:Object.values(status).every(x=>x==="success"||x==="present")};
}

const fs=require('node:fs'),assert=require('node:assert/strict');
const {validateSnapshot}=require('./forecast-accuracy-audit.cjs');
const branch='ks-forecast-archive';
async function cli(){
 const [mode,repo,arg,input]=process.argv.slice(2);
 assert(repo==='oosaka0123-sudo/kansai-surfer-ks','unexpected repository');
 const token=process.env.GH_TOKEN;assert(token,'GitHub token required');
 const api=async(suffix,options={})=>{
  const r=await fetch('https://api.github.com/repos/'+repo+'/'+suffix,{...options,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
  if(r.status===404&&options.allow404)return null;
  assert(r.ok,'GitHub API '+r.status+' '+suffix.split('?')[0]);return r.json();
 };
 const readPath=p=>'contents/'+p+'?ref='+branch;
 if(mode==='archive'){
  assert(/^\d+$/.test(arg)&&input,'run ID and snapshot required');
  const run=await api('actions/runs/'+arg);
  const {path,record}=archiveRecord(run,JSON.parse(fs.readFileSync(input,'utf8')),validateSnapshot);
  const payload=JSON.stringify(record,null,2)+'\n';
  const old=await api(readPath(path),{allow404:true});
  if(old){assert(old.encoding==='base64'&&Buffer.from(old.content,'base64').toString('utf8')===payload,'existing archive differs; never overwrite');console.log('Already archived: '+path);return}
  await api('contents/'+path,{method:'PUT',body:JSON.stringify({branch,message:'Archive KS scheduled forecast '+run.id+' attempt '+run.run_attempt,content:Buffer.from(payload).toString('base64')})});
  const saved=await api(readPath(path));assert(saved.encoding==='base64'&&Buffer.from(saved.content,'base64').toString('utf8')===payload,'archive verification failed');
  console.log('Archived '+path);
 }else if(mode==='health'){
  assert(/^\d{4}-\d{2}-\d{2}$/.test(arg)&&new Date(arg+'T00:00:00Z').toISOString().slice(0,10)===arg&&input,'date and output required');
  const prev=new Date(Date.parse(arg+'T00:00:00Z')-86400000).toISOString().slice(0,10);
  const list=async w=>{let all=[];for(let page=1;page<=10;page++){const r=await api('actions/workflows/'+w+'/runs?event=schedule&branch=main&created='+prev+'..'+arg+'&per_page=100&page='+page);all.push(...r.workflow_runs);if(r.workflow_runs.length<100)return all;}throw Error('unexpected run pagination')};
  const [p,m]=await Promise.all([list('forecast-audit-capture.yml'),list('forecast-audit-wind.yml')]);
  const first=health(arg,p,m,[]);const archives=[];
  if(first.archive_path){const a=await api(readPath(first.archive_path),{allow404:true});if(a){const rec=JSON.parse(Buffer.from(a.content,'base64').toString('utf8'));const run=p.find(r=>r.id===first.forecast_run_id);const rebuilt=archiveRecord(run,rec.snapshot,validateSnapshot);assert(rebuilt.path===first.archive_path&&JSON.stringify(rebuilt.record)===JSON.stringify(rec),'archive identity mismatch');archives.push(first.archive_path)}}
  const report=health(arg,p,m,archives);fs.writeFileSync(input,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));if(!report.healthy)process.exitCode=2;
 }else throw Error('archive REPO RUN_ID SNAPSHOT | health REPO DATE OUTPUT');
}
module.exports={archiveRecord,health};
if(require.main===module)cli().catch(e=>{console.error(e.message);process.exitCode=1});
