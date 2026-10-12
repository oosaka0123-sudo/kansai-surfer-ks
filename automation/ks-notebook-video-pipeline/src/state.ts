import fs from 'node:fs';
import path from 'node:path';

export type Phase =
  | 'INPUT'
  | 'NOTEBOOK'
  | 'GENERATION'
  | 'DOWNLOAD'
  | 'VALIDATION'
  | 'YOUTUBE_UPLOAD'
  | 'READY_FOR_REVIEW'
  | 'DONE'
  | 'AUTH_REQUIRED'
  | 'NEEDS_HUMAN'
  | 'FAILED';

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
    run_id: `${date}-01`,
    date,
    phase: 'INPUT',
    notebook_url: null,
    youtube_video_id: null,
    progress: {
      source_created: false,
      notebook_created: false,
      generation_requested: false,
      video_downloaded: false,
      video_validated: false,
      youtube_uploaded: false
    },
    attempts: { chrome_start: 0, generation: 0, youtube_upload: 0 },
    errors: []
  };
}

export function saveState(filePath: string, state: PipelineState) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

export function loadState(filePath: string): PipelineState | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PipelineState;
}
