import fs from 'node:fs';
import path from 'node:path';

export interface PipelineLock { pid:number; started_at:string; run_id:string; }

function processExists(pid:number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function acquireLock(lockPath:string, runId:string) {
  fs.mkdirSync(path.dirname(lockPath), {recursive:true});
  if (fs.existsSync(lockPath)) {
    try {
      const current=JSON.parse(fs.readFileSync(lockPath,'utf8')) as PipelineLock;
      const ageMs=Date.now()-new Date(current.started_at).getTime();
      const stale=!processExists(current.pid) || ageMs > 2*60*60*1000;
      if (!stale) throw new Error(`Pipeline already running: pid=${current.pid} run=${current.run_id}`);
      fs.rmSync(lockPath,{force:true});
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Pipeline already running')) throw e;
      fs.rmSync(lockPath,{force:true});
    }
  }
  const lock:PipelineLock={pid:process.pid,started_at:new Date().toISOString(),run_id:runId};
  fs.writeFileSync(lockPath,JSON.stringify(lock,null,2),'utf8');
}

export function releaseLock(lockPath:string) {
  if (!fs.existsSync(lockPath)) return;
  try {
    const current=JSON.parse(fs.readFileSync(lockPath,'utf8')) as PipelineLock;
    if (current.pid!==process.pid) return;
  } catch {}
  fs.rmSync(lockPath,{force:true});
}
