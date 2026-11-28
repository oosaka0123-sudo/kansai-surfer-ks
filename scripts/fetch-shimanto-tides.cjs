'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const stations={L6:'高知下田',TS:'土佐清水',L7:'甲浦'};
const url=(s,y)=>'https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/'+y+'/'+s+'.txt';
function parse(raw,s,y){
 const lines=raw.trimEnd().split(/\r?\n/), count=(Date.UTC(y+1,0,1)-Date.UTC(y,0,1))/86400000;
 assert.equal(lines.length,count);
 const num=t=>{assert.match(t.trim(),/^-?\d+$/);return Number(t)};
 const days=lines.map((line,i)=>{
  assert.equal(line.length,136);assert.equal(line.slice(78,80),s);
  const date=new Date(Date.UTC(y,0,i+1)).toISOString().slice(0,10);
  assert.equal(num(line.slice(72,74)),y%100);assert.equal(num(line.slice(74,76)),Number(date.slice(5,7)));assert.equal(num(line.slice(76,78)),Number(date.slice(8,10)));
  const hourly_cm=Array.from({length:24},(_,j)=>num(line.slice(j*3,j*3+3)));assert.ok(hourly_cm.every(v=>v!==999&&Math.abs(v)<500));
  const events=offset=>Array.from({length:4},(_,j)=>{const at=offset+j*7,t=num(line.slice(at,at+2))*100+num(line.slice(at+2,at+4)),h=num(line.slice(at+4,at+7));if(t===9999){assert.equal(h,999);return null;}assert.ok(t>=0&&Math.floor(t/100)<24&&t%100<60&&Math.abs(h)<500);return {time:String(Math.floor(t/100)).padStart(2,'0')+':'+String(t%100).padStart(2,'0'),height_cm:h}}).filter(Boolean);
  return {date,hourly_cm,high:events(80),low:events(108)};
 });return {station:stations[s],station_id:s,datum:'気象庁潮位表基準面',unit:'cm',timezone:'Asia/Tokyo',source:'気象庁の推算潮位（実測ではありません）',source_url:url(s,y),observation:false,year:y,days};
}
async function get(s,y){const r=await fetch(url(s,y),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);return parse(await r.text(),s,y)}
async function main(){const baseline=await get('L7',2026);assert.deepEqual(baseline.days,require('../ikumi-hourly/data/L7-2026.json').days);console.log('L7 existing fixture cross-check passed (365 days)');const all=await Promise.all(['L6','TS'].flatMap(s=>[2026,2027].map(y=>get(s,y))));fs.mkdirSync('shimanto/tide',{recursive:true});for(const t of all){fs.writeFileSync('shimanto/tide/'+t.station_id+'-'+t.year+'.json',JSON.stringify(t)+'\n');console.log(t.station_id,t.year,t.days.length,t.days.length*24)}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});module.exports={parse};