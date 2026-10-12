import path from 'node:path';
import { createInitialState, loadState, saveState } from './state.js';
import { acquireLock, releaseLock } from './lock.js';

const date=process.env.KS_RUN_DATE ?? new Date().toISOString().slice(0,10);
const runDir=path.resolve('runs',date);
const statePath=path.join(runDir,'state.json');
const lockPath=path.resolve('pipeline.lock');

const state=loadState(statePath) ?? createInitialState(date);
acquireLock(lockPath,state.run_id);
try{
  saveState(statePath,state);
  console.log(`KS pipeline initialized: ${state.run_id} / phase=${state.phase}`);
  console.log(`runDir=${runDir}`);
} finally {
  releaseLock(lockPath);
}
