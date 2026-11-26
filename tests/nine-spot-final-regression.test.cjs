const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
for(const s of ['kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto'])test(s+' rejects wrong-spot cached forecast',async()=>{
 const html=read(s+'.html'),start=html.indexOf('    var running=false,configWaits=0;'),end=html.indexOf('    render(null,null);\n    // DOMContentLoaded',start);
 assert(start>=0&&end>start);const src=html.slice(start,end);
 for(const valid of [false,true]){const renders=[],m={hourly:{time:['2026-11-26T12:00'],wave_height:[1.2]}},w={hourly:{time:['2026-11-26T12:00'],wind_speed_10m:[2],wind_direction_10m:[0]}},ctx={getSpotConfig:()=>({LAT:1,LNG:1}),getJSON:async url=>{if(!url.startsWith('data/'))throw Error('offline');return {spot:valid?s:'foreign',updated_at:'2026-11-26 12:00:00',marine:m,weather:w}},Date:class extends Date{static now(){return Date.parse('2026-11-26T12:01:00+09:00')}},render:(a,b)=>renders.push([a,b]),updated:{},console:{warn(){}},setTimeout:f=>f()};
 await vm.runInNewContext(src+'\nload()',ctx);assert.equal(renders.some(x=>x[0]===m),valid);if(!valid)assert(renders.every(x=>x[0]===null&&x[1]===null));}
});
test('Isonoura iframe sends stable measured content height and can shrink',()=>{
 const h=read('isonoura-hourly/index.html');const src=h.match(/<script>\s*(\(function\(\)\{[\s\S]*?\}\)\(\);)\s*<\/script>/)[1];
 let height=800,view=970,send;const messages=[];const window={location:{origin:'https://example.invalid'},parent:{postMessage:m=>{messages.push(m.height);view=m.height}},ResizeObserver:true};
 vm.runInNewContext(src,{window,document:{querySelector:()=>({getBoundingClientRect:()=>({height})}),documentElement:{get scrollHeight(){return view}}},addEventListener:(_,f)=>send=f,ResizeObserver:class{observe(){}}});
 for(let n=0;n<130;n++)send();assert(messages.every(x=>x===805));height=600;send();assert.equal(messages.at(-1),605);
});
test('Isonoura refresh reloads only its hourly iframe',()=>{
 const h=read('isonoura.html'),script=[...h.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes("url.searchParams.set('_refresh'"));assert(script);let click;const frame={src:'https://example.invalid/isonoura-hourly/index.html?v=20261126-4'},refresh={addEventListener:(_,f)=>click=f};vm.runInNewContext(script,{URL,location:{href:'https://example.invalid/isonoura.html'},document:{getElementById:id=>id==='refreshBtn'?refresh:frame},Date:{now:()=>123}});click();click();const u=new URL(frame.src);assert.equal(u.searchParams.get('v'),'20261126-4');assert.deepEqual(u.searchParams.getAll('_refresh'),['123']);
});

test('Isonoura iframe and standalone link use latest resize version',()=>{const h=read('isonoura.html');assert(h.includes('src='+String.fromCharCode(34)+'isonoura-hourly/index.html?v=20261126-4'+String.fromCharCode(34)));assert(h.includes('href='+String.fromCharCode(34)+'isonoura-hourly/index.html?v=20261126-4'+String.fromCharCode(34)));});
