import path from 'node:path';
import { createInitialState, saveState, loadState } from './state.js';

const p = path.resolve('runs', 'test', 'state.json');
const s = createInitialState('2099-01-01');
saveState(p, s);
const loaded = loadState(p);
if (!loaded || loaded.run_id !== s.run_id) throw new Error('state roundtrip failed');
console.log('state roundtrip ok');
