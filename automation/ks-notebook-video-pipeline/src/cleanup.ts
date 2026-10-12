import fs from 'node:fs';
import path from 'node:path';

const runsRoot=path.resolve('runs');
const keepDays=Number(process.env.KS_KEEP_DAYS ?? 14);
const cutoff=Date.now()-keepDays*24*60*60*1000;

if(!fs.existsSync(runsRoot)) process.exit(0);
for(const entry of fs.readdirSync(runsRoot,{withFileTypes:true})){
  if(!entry.isDirectory()) continue;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;
  const ts=new Date(entry.name+'T00:00:00+09:00').getTime();
  if(!Number.isFinite(ts) || ts>=cutoff) continue;
  const dir=path.join(runsRoot,entry.name);
  const required=['source.md','state.json','video.mp4'];
  const complete=required.every(f=>fs.existsSync(path.join(dir,f)));
  if(!complete){
    console.log(`SKIP incomplete local archive: ${entry.name}`);
    continue;
  }
  console.log(`ELIGIBLE_FOR_NOTEBOOK_CLEANUP ${entry.name}`);
}
