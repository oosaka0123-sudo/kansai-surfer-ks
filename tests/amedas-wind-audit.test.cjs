'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{wind,stationInfo,extract,compare,angle,capture}=require('../scripts/amedas-wind-audit.cjs');
const station={kjName:'和歌山',elems:'11111111',lat:[34,13.7],lon:[135,9.8],alt:14};
const date='2026-11-28';
test('normal wind only; 16 is north; calm no direction',()=>{assert.deepEqual(wind({wind:[3,0],windDirection:[16,0]}),{speed_ms:3,direction_deg:0});assert.equal(wind({wind:[0,0],windDirection:[0,0]}).direction_deg,null);assert.equal(wind({wind:[3,1],windDirection:[2,0]}).speed_ms,null);assert.equal(wind({wind:[3,0],windDirection:[null,0]}).direction_deg,null)});
test('station metadata and exact hours; missing is not zero',()=>{assert.equal(stationInfo({'65042':station},'isonoura').station_name,'和歌山');assert.throws(()=>stationInfo({'65042':{...station,kjName:'other'}},'isonoura'));const r=extract(date,{'65042':station},{7:{'65042':{wind:[3,0],windDirection:[1,0]}}});assert.equal(r.rows.length,4);assert.equal(r.rows[0].direction_deg,22.5);assert.equal(r.rows[1].speed_ms,null);assert.equal(r.missing.length,11)});
test('circular direction error',()=>assert.equal(angle(350,10),20));
test('future observation refused before network',async()=>assert.rejects(capture(date,Date.parse(date+'T09:00:00+09:00'),()=>{throw Error('network called')}),/not yet due/));
test('matches only exact date, station, time; separates wind proxy from wave Hs',()=>{const s={schema:1,captured_at:'2026-11-27T10:30:00Z',valid_jst:date,fields:['hour_jst','offshore_model_hs_m','period_s','wave_dir_deg','wind_ms','wind_dir_deg'],rows:[{s:'isonoura',issued:'2026-11-27 19:05:00',marine:[34.2,135.04],weather:[34.2,135.06],values:[7,8,9,10].map(h=>[h,1,7,180,5,350])}]};const o=extract(date,{'65042':station},{7:{'65042':{wind:[3,0],windDirection:[16,0]}},8:{'65042':{wind:[0,0],windDirection:[0,0]}}});const r=compare(s,o);assert.equal(r.rows.length,2);assert.equal(r.rows[0].speed_error_ms,2);assert.equal(r.rows[0].direction_abs_error_deg,10);assert.equal(r.rows[1].direction_abs_error_deg,null);assert.equal(r.missing.length,2);assert.throws(()=>compare(s,{...o,date_jst:'2026-11-29'}));});

test('Hakuto supplemental stations remain separate from fixed primary series',()=>{
 const mk=(name,lat,lon)=>({kjName:name,elems:'11111111',lat,lon,alt:15});
 const table={'69122':mk('鳥取',[35,29.2],[134,14.3]),'69052':mk('湖山',[35,31.8],[134,9.9]),'69041':mk('青谷',[35,31.2],[133,59.8])};
 const maps=Object.fromEntries([7,8,9,10].map(h=>[h,{'69122':{wind:[2,0],windDirection:[4,0]},'69052':{wind:[4,0],windDirection:[11,0]},'69041':{wind:[3,0],windDirection:[11,0]}}]));
 const snap={schema:1,captured_at:'2026-11-27T10:30:00Z',valid_jst:date,fields:['hour_jst','offshore_model_hs_m','period_s','wave_dir_deg','wind_ms','wind_dir_deg'],rows:[{s:'hakuto',issued:'2026-11-27 19:05:00',marine:[35.708,134.125],weather:[35.55,134.125],values:[7,8,9,10].map(h=>[h,1,7,180,8,250])}]};
 const o=extract(date,table,maps),r=compare(snap,o);
 assert.equal(o.rows.length,4);assert.equal(o.supplemental_rows.length,8);
 assert.equal(r.rows.length,4);assert.equal(r.groups.hakuto.speed_mae_ms,6);
 assert.equal(r.supplemental.expected,8);assert.equal(r.supplemental.rows.length,8);
 assert.equal(r.supplemental.groups['hakuto|69052'].speed_mae_ms,4);
 assert.equal(r.supplemental.groups['hakuto|69041'].speed_mae_ms,5);
 assert.equal(r.supplemental.groups['hakuto|69052'].direction_mae_deg,2.5);
 const legacy={...o};delete legacy.supplemental_rows;assert.equal(compare(snap,legacy).supplemental.missing.length,8);
 const tampered={...o,supplemental_rows:o.supplemental_rows.map((x,i)=>i===0?{...x,comparison_role:'primary'}:x)};
 assert.equal(compare(snap,tampered).supplemental.rows.length,7);
});
