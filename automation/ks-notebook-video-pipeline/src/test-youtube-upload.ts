import path from 'node:path';
import { runQualityGate } from './quality-gate.js';
import { uploadYoutube } from './youtube.js';

// This is NOT a dummy-video connectivity uploader: every upload must be a genuine validated run.
// A separate explicit opt-in is required to produce any YouTube side effects.
const runDir = process.env.KS_QC_RUN_DIR;
if (!runDir) throw new Error('KS_QC_RUN_DIR is required. Dummy uploads are disabled.');
const fullRunDir = path.resolve(runDir);
const gate = runQualityGate(fullRunDir, 'upload');
console.log(JSON.stringify(gate, null, 2));
if (!gate.ok) {
  process.exitCode = 2;
} else if (process.env.KS_ALLOW_PRIVATE_UPLOAD !== 'yes') {
  console.log('DRY_RUN: QC passed; upload not attempted. Set KS_ALLOW_PRIVATE_UPLOAD=yes to explicitly authorize a private upload.');
} else {
  console.log(JSON.stringify(await uploadYoutube({runDir: fullRunDir}), null, 2));
}
