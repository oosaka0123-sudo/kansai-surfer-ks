'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{selectRuns,shiftDate}=require('../scripts/collect-wind-28day.cjs');
const s={"event":"schedule","head_branch":"main","status":"completed","conclusion":"success","id":7,"run_attempt":1,"run_started_at":"2026-11-28T10:30:00Z"};

test('only successful main scheduled runs within the actual JST windows',()=>{
 assert.equal(selectRuns([s],'2026-11-28','forecast').length,1);
 for(const bad of [{event:'workflow_dispatch'},{head_branch:'other'},{conclusion:'failure'},{run_started_at:'2026-11-28T13:01:00Z'}])assert.equal(selectRuns([{...s,...bad}],'2026-11-28','forecast').length,0);
 assert.equal(selectRuns([{...s,id:8,run_started_at:'2026-11-28T11:07:00Z'},s],'2026-11-28','forecast')[0].id,7);
 assert.equal(selectRuns([{...s,run_started_at:'2026-11-28T02:13:00Z'}],'2026-11-28','morning').length,1);
 assert.equal(shiftDate('2026-12-01',-27),'2026-11-04');
});
