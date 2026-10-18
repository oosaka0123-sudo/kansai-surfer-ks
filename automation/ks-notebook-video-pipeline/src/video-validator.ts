import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

export const VIDEO_MIN_SECONDS = 55;
export const VIDEO_MAX_SECONDS = 65;

export type VideoValidation = {
  ok: boolean;
  duration: number;
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
  errors: string[];
};

function failed(reason: string): VideoValidation {
  return { ok: false, duration: 0, width: 0, height: 0, hasVideo: false, hasAudio: false, errors: [reason] };
}

// A technical media check ONLY: it does not validate spoken content or subtitle accuracy.
export function validateVideoProbe(probe: any): VideoValidation {
  const errors: string[] = [];
  const streams = probe?.streams ?? [];
  const video = streams.find((stream: any) => stream.codec_type === 'video');
  const audio = streams.find((stream: any) => stream.codec_type === 'audio');
  const duration = Number(probe?.format?.duration ?? video?.duration ?? 0);
  const width = Number(video?.width ?? 0);
  const height = Number(video?.height ?? 0);
  if (!video) errors.push('video stream missing');
  if (!audio) errors.push('audio stream missing');
  if (!Number.isFinite(duration) || duration < VIDEO_MIN_SECONDS || duration > VIDEO_MAX_SECONDS) {
    errors.push('60-second format required: duration must be 55-65 seconds');
  }
  if (width < 1280 || height < 720) errors.push('resolution below 1280x720');
  if (width > 0 && height > 0 && Math.abs(width / height - 16 / 9) > 0.04) {
    errors.push('aspect ratio must be 16:9 for NotebookLM long explainer');
  }
  return {ok: errors.length === 0, duration, width, height, hasVideo: !!video, hasAudio: !!audio, errors};
}

export function validateVideo(file: string): VideoValidation {
  if (!fs.existsSync(file)) return failed('file missing');
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {encoding: 'utf8', timeout: 30000});
    return validateVideoProbe(JSON.parse(out));
  } catch {
    return failed('ffprobe failed');
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/video-validator.ts')) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: tsx src/video-validator.ts <video.mp4>');
  const result = validateVideo(file);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 2;
}
