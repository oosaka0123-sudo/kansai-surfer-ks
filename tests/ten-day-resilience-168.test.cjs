const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const spots=['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto'];
const now=Date.parse('2026-11-26T12:00:00+09:00');
class D extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
for(const s of spots)test(s+' rejects empty successful API responses, retains usable forecast and correct wind arrow',async()=>{
 const h=fs.readFileSync(s+'.html','utf8').replace(/\r\n/g,'\n');const start=h.indexOf(s==='isonoura'?'    var running=false;':'    var running=false,configWaits=0;'),end=h.indexOf('    render(null,null);',start);assert(start>=0&&end>start);
 const src=h.slice(start,end),time=Array.from({length:10},(_,i)=>new Date(now+9*3600000+i*86400000).toISOString().slice(0,10)+'T12:00');
 const m={hourly:{time,wave_height:time.map(()=>1.2)}},w={hourly:{time,wind_speed_10m:time.map(()=>2),wind_direction_10m:time.map(()=>0)}},empty={hourly:{time:[],wave_height:[],wind_speed_10m:[],wind_direction_10m:[]}};
 let offline=false;const renders=[],updated={};const ctx={getSpotConfig:()=>({LAT:1,LNG:1}),latitude:1,longitude:1,getJSON:async url=>url.startsWith('data/')?{spot:s,updated_at:'2026-11-26 11:05:00',marine:m,weather:w}:offline?empty:url.includes('marine-api')?m:w,Date:D,render:(a,b)=>renders.push([a,b]),updated,console:{warn(){}},setTimeout:f=>f()};
 vm.createContext(ctx);vm.runInContext(src,ctx);await ctx.load();assert.equal(renders.at(-1)[0],m);assert.equal(renders.at(-1)[1],w);offline=true;await ctx.load();assert.equal(renders.at(-1)[0],m);assert.equal(renders.at(-1)[1],w);assert(!updated.textContent.includes('10日分取得：'));assert(!updated.textContent.includes('10日間の予報を取得：'));
 const arrows=vm.runInNewContext(h.match(/var arrows=\[.*?\];/)[0]+'\narrows');assert.equal(arrows[0],'↓');assert.equal(arrows[4],'↑');
});