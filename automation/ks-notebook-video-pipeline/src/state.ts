import fs from 'node:fs';
import path from 'node:path';
import { runQualityGate } from './quality-gate.js';

export type Phase =
  | 'INPUT' | 'NOTEBOOK' | 'GENERATION' | 'DOWNLOAD' | 'VALIDATION'
  | 'YOUTUBE_UPLOAD' | 'READY_FOR_REVIEW' | 'DONE'
  | 'AUTH_REQUIRED' | 'NEEDS_HUMAN' | 'BLOCKED_PRECONDITIONS' | 'FAILED';

export interface PipelineState {
  run_id: string;
  date: string;
  phase: Phase;
  notebook_url: string | null;
  youtube_video_id: string | null;
  progress: {
    source_created: boolean;
    notebook_created: boolean;
    generation_requested: boolean;
    video_downloaded: boolean;
    video_validated: boolean;
    youtube_uploaded: boolean;
  };
  attempts: {
    chrome_start: number;
    generation: number;
    youtube_upload: number;
  };
  errors: Array<{ at: string; phase: Phase; message: string }>;
}

export function createInitialState(date: string): PipelineState {
  return {
    run_id: `${date}-01`, date, phase: 'INPUT', notebook_url: null, youtube_video_id: null,
    progress: {
      source_created: false, notebook_created: false, generation_requested: false,
      video_downloaded: false, video_validated: false, youtube_uploaded: false
    },
    attempts: {chrome_start: 0, generation: 0, youtube_upload: 0}, errors: []
  };
}

// Do not claim READY just because the MP4 opens in a player.
// Publication (DONE) is human-only and not implemented in this automatic pipeline.
export function saveState(filePath: string, state: PipelineState) {
  const dir = path.dirname(filePath);
  if (state.phase === 'DONE') {
    throw new Error('DONE_REQUIRES_SEPARATE_HUMAN_APPROVAL_AND_PUBLIC_YOUTUBE_VERIFICATION');
  }
  if (state.phase === 'READY_FOR_REVIEW') {
    if (path.basename(filePath) !== 'state.json' || path.basename(dir) !== state.date) {
      throw new Error('READY_STATE_PATH_MISMATCH');
    }
    const gate = runQualityGate(dir, 'ready');
    if (!gate.ok) throw new Error('INVALID_READY_STATE: ' + gate.errors.join('; '));
    const youtube = JSON.parse(fs.readFileSync(path.join(dir, 'youtube-verification.json'), 'utf8'));
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'youtube-metadata.json'), 'utf8'));
    if (state.youtube_video_id !== youtube.video_id || state.run_id !== youtube.run_id ||
        state.run_id !== meta.run_id || !state.progress.video_validated ||
        !state.progress.youtube_uploaded || !state.progress.video_downloaded) {
      throw new Error('READY_STATE_PROGRESS_OR_VIDEO_ID_MISMATCH');
    }
  }
  fs.mkdirSync(dir, {recursive: true});
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

export function loadState(filePath: string): PipelineState | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PipelineState;
}
