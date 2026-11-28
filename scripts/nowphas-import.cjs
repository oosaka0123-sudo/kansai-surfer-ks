'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const SPOTS=['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto'];
const source='https://nowphas.mlit.go.jp/pastdata/';
const int=s=>/^\s*\d+\s*$/.test(s)?Number(s):NaN;
const num=s=>/^\s*\d+(\.\d+)?\s*$/.test(s)?Number(s):NaN;
function parse(text,expectedCode,date){
 assert(/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'invalid date');
 assert(/^\d{3}$/.test(expectedCode),'three-digit official station code required');
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim()&&!/^<\/?pre>$/i.test(l.trim()));
 const header=lines.shift()?.match(/^\s*(\d{3})\s+(.+)$/);
 assert(header&&header[1]===expectedCode,'station header mismatch');
 const rows=[],missing=[],seen=new Set();
 for(const line of lines){
  assert(line.trimEnd().length===78||line.length===78,'unexpected record width');
  const y=int(line.slice(0,4)),m=int(line.slice(4,6)),d=int(line.slice(6,8)),h=int(line.slice(8,10)),minute=int(line.slice(10,12));
  assert(y>=1900&&y<=2100&&m>=1&&m<=12&&d>=1&&d<=31&&h>=0&&h<=23&&[0,20,40].includes(minute),'invalid continuous observation timestamp');
  const day=[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
  assert(new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day,'invalid calendar day');
  if(day!==date||minute!==0||h<7||h>10)continue;
  const time=day+'T'+String(h).padStart(2,'0')+':00';
  assert(!seen.has(time),'duplicate target observation');seen.add(time);
  const flag=int(line.slice(12,18)),hs=num(line.slice(36,42)),period=num(line.slice(42,48));
  if(flag!==0||!Number.isFinite(hs)||hs<0||hs>40||!Number.isFinite(period)||period<=0||period>40){missing.push({time,reason:'non-normal or invalid Hs/period',flag});continue}
  rows.push({time_jst:time,hs_m:hs,period_s:period});
 }
 for(const h of [7,8,9,10]){const time=date+'T'+String(h).padStart(2,'0')+':00';if(!seen.has(time))missing.push({time,reason:'absent'});}
 return {station_code:expectedCode,header:header[2].trim(),date,rows,missing};
}
const nameKey=s=>typeof s==='string'?s.normalize('NFC').trim().replace(/\s+/g,' '):'';
function officialUrl(value,hosts){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.includes(u.hostname)}catch{return false}}
function normalize(result,meta){
 assert(SPOTS.includes(meta.spot)&&meta.station_code===result.station_code,'unapproved spot or code');
 assert(nameKey(meta.station_name)&&nameKey(result.header)===nameKey(meta.station_name),'station name mismatch');
 assert(meta.verified_for_date===result.date&&meta.location_note?.trim()&&officialUrl(meta.verified_metadata_url,['nowphas.mlit.go.jp','www.mlit.go.jp','www.pari.go.jp','pari.go.jp']),'station verification required');
 assert(meta.data_class==='provisional'||meta.data_class==='final','data quality class required');
 assert(officialUrl(meta.source_url,['nowphas.mlit.go.jp']),'official source required');
 assert(Number.isFinite(meta.latitude)&&meta.latitude>=20&&meta.latitude<=50&&Number.isFinite(meta.longitude)&&meta.longitude>=120&&meta.longitude<=150,'invalid station coordinates');
 return result.rows.map(r=>({spot:meta.spot,station_id:'nowphas_'+result.station_code,time_jst:r.time_jst,kind:'observed_significant_wave_height',unit:'m',hs_m:r.hs_m,period_s:r.period_s,latitude:meta.latitude,longitude:meta.longitude,source_url:meta.source_url,representativeness:'proxy',location_note:meta.location_note,quality_class:meta.data_class,metadata_url:meta.verified_metadata_url,attribution:'全国港湾海洋波浪情報網（ナウファス）を加工して作成'}));
}
if(require.main===module){try{const [mode,input,code,date,metaPath,output]=process.argv.slice(2);assert(mode==='inspect'||mode==='import','inspect FILE CODE DATE | import FILE CODE DATE META.json OUT.json');const result=parse(new TextDecoder('shift_jis',{fatal:true}).decode(fs.readFileSync(input)),code,date);if(mode==='inspect')console.log(JSON.stringify(result,null,2));else{assert(output,'output required');const rows=normalize(result,JSON.parse(fs.readFileSync(metaPath,'utf8')));fs.writeFileSync(output,JSON.stringify(rows,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({rows:rows.length,missing:result.missing,source}));if(result.missing.length)process.exitCode=2;}}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={parse,normalize};
