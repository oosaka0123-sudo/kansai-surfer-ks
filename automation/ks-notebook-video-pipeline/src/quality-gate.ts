import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateVideo, type VideoValidation } from './video-validator.js';

export type GateStage = 'upload' | 'ready';
export type GateResult = {
  ok: boolean;
  stage: GateStage;
  run_dir: string;
  checks: { ranking_count: number; duration_seconds: number | null; audio_review_claim_recorded: boolean; private_youtube_verified: boolean };
  errors: string[];
};

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const sha256 = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const textSha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const exists = (p: string) => fs.existsSync(p);
const normalizedLines = (s: string) => s.replace(/\r\n/g, '\n');
const normalizeSpeech = (s: string) => s.normalize('NFKC').replace(/[\s、。,.・/／:：!?！？~〜ー\-]/g, '').toLowerCase();

function jsonFile(p: string, errors: string[]): any | null {
  if (!exists(p)) { errors.push('missing ' + path.basename(p)); return null; }
  try { return JSON.parse(read(p)); }
  catch { errors.push('invalid JSON: ' + path.basename(p)); return null; }
}

function verifyTranscript(transcript: string, ranking: RegExpMatchArray[], input: any, errors: string[]) {
  const txt = normalizeSpeech(transcript);
  const reads: Record<string,string[]> = {
    '宍喰':['ししくい','シシクイ'], '小松海岸':['こまつかいがん'],
    '静波':['しずなみ'], '国府の浜':['こうのはま'], '生見':['いくみ'],
    '小沢見':['こぞみ'], '磯ノ浦':['いそのうら']
  };
  let lastIndex = -1;
  for (const [i, rank] of ranking.slice(0, 3).entries()) {
    const spot = rank[2], score = rank[3];
    const candidates = [spot, ...(reads[spot] ?? [])].map(normalizeSpeech);
    const hits = candidates.map(x => txt.indexOf(x, lastIndex + 1)).filter(x => x >= 0);
    const start = hits.length ? Math.min(...hits) : -1;
    if (start < 0) { errors.push('transcript missing TOP3 spot at rank ' + (i + 1) + ': ' + spot); continue; }
    if (start <= lastIndex) errors.push('transcript TOP3 order incorrect');
    const scoreWindow = txt.slice(start, start + 70);
    const spelled: Record<string,string> = {'42':'四十二','36':'三十六','34':'三十四'};
    if (!scoreWindow.includes(score + '点') && !scoreWindow.includes(spelled[score] + '点')) {
      errors.push('transcript missing spoken score near ' + spot + ': ' + score);
    }
    lastIndex = start;
  }
  if (/周期|サイクルタイム|波ピリオド/i.test(transcript)) errors.push('forbidden wave period phrase in transcript');
  if (/https?:\/\/|www\.|NotebookLM|ウェザーニュース|Yahoo.?天気|BCM|波伝説/i.test(transcript)) {
    errors.push('forbidden source name or URL in transcript');
  }
  const missingTomorrow = !input?.tomorrow_forecast || /未提供|未確認/.test(String(input.tomorrow_forecast));
  if (missingTomorrow && /明日.{0,45}(?:[1-9][0-9]?点|ヒザ|モモ|コシ|ハラ|ムネ|アタマ|強いオン|強いオフ)/.test(transcript)) {
    errors.push('unverified tomorrow forecast claim in transcript');
  }
}

// Fails closed. A media probe alone NEVER certifies spoken scores, pronunciation or missing forecasts.
export function runQualityGate(
  runDir: string,
  stage: GateStage,
  inspectMedia: (filename: string) => VideoValidation = validateVideo
): GateResult {
  const errors: string[] = [];
  const input = jsonFile(path.join(runDir, 'input.json'), errors);
  const meta = jsonFile(path.join(runDir, 'youtube-metadata.json'), errors);
  const sourcePath = path.join(runDir, 'source.md');
  const studioPath = path.join(runDir, 'studio-prompt.md');
  const videoPath = path.join(runDir, 'video.mp4');
  let ranking: RegExpMatchArray[] = [];
  let source = '';
  const checks = { ranking_count: 0, duration_seconds: null as number | null, audio_review_claim_recorded: false, private_youtube_verified: false };

  if (!exists(sourcePath)) errors.push('missing source.md');
  else source = read(sourcePath);
  if (!exists(studioPath)) errors.push('missing studio-prompt.md');
  else {
    const studio = read(studioPath);
    for (const required of ['Opening', 'Ending', 'アニメ', '長い方', 'TOP3', '波周期']) {
      if (!studio.includes(required)) errors.push('studio-prompt.md missing fixed rule: ' + required);
    }
  }
  if (input) {
    const date: unknown = input.date;
    const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date + 'T00:00:00+09:00') : new Date(NaN);
    if (isNaN(parsed.getTime()) ||
        parsed.toLocaleDateString('sv-SE', {timeZone: 'Asia/Tokyo'}) !== date ||
        path.basename(runDir) !== date) errors.push('date mismatch or invalid date');
    if (typeof input.ranking !== 'string' || !input.ranking.trim()) errors.push('ranking text missing');
    else {
      const original = input.ranking.trim();
      if (!normalizedLines(source).includes(normalizedLines(original))) {
        errors.push('source.md does not preserve complete pasted ranking verbatim');
      }
      const lines = normalizedLines(original);
      ranking = [...lines.matchAll(/^(\d+)位[ \t]+([^\r\n]+?)[ \t]+(\d+)点[ \t]*$/gm)];
      const rankHeadings = [...lines.matchAll(/^\d+位\b|^\d+位(?=\s)/gm)].length;
      if (ranking.length < 1 || ranking.length > 20) errors.push('rank count out of expected range');
      if (rankHeadings !== ranking.length) errors.push('ranking lines not parsed (unknown rank or score format)');
      ranking.forEach((m, index) => { if (Number(m[1]) !== index + 1) errors.push('rank order/duplicate error at ' + (index + 1)); });
      checks.ranking_count = ranking.length;
    }
    if (!input.tomorrow_forecast || /未提供|未確認/.test(String(input.tomorrow_forecast))) {
      if (!/未確認|未提供|確認できません/.test(String(meta?.description ?? ''))) {
        errors.push('missing-forecast notice absent from YouTube description');
      }
    }
    if (source.includes('波の周期は動画説明に使用しない') || source.includes('このファイルは当日の事実データのみを収録する')) {
      errors.push('source.md contains production instructions instead of factual input only');
    }
  }

  if (meta) {
    if (meta.privacyStatus !== 'private') errors.push('YouTube must remain private before human approval');
    if (typeof meta.title !== 'string' || !meta.title.trim() || meta.title.length > 100) errors.push('invalid YouTube title');
    if (typeof meta.description !== 'string' || !meta.description.trim()) errors.push('missing YouTube description');
    if (typeof meta.run_id !== 'string' || !meta.run_id) errors.push('missing run_id');
    if (input?.date && !meta.title?.includes(input.date.slice(0,4)) && !meta.title?.includes(input.date.slice(5).replace('-','/'))) {
      errors.push('title missing date identifier');
    }
  }

  if (!exists(videoPath)) errors.push('missing video.mp4');
  else {
    const media = inspectMedia(videoPath);
    checks.duration_seconds = media.duration;
    if (!media.ok) errors.push(...media.errors.map(e => 'media: ' + e));
  }

  // A real review must produce the transcript and attest to THIS video; automated TRUE flags alone are not reliable.
  const qa = jsonFile(path.join(runDir, 'qc-evidence.json'), errors);
  if (qa && exists(videoPath) && exists(sourcePath)) {
    if (qa.video_sha256 !== sha256(videoPath)) errors.push('QC evidence video checksum mismatch');
    if (qa.source_sha256 !== textSha256(source)) errors.push('QC evidence source checksum mismatch');
    if (qa.review_method !== 'human_listening') errors.push('QC method must be human_listening');
    if (typeof qa.reviewer !== 'string' || qa.reviewer.trim().length < 3) errors.push('QC reviewer not identified');
    if (typeof qa.reviewed_at !== 'string' || isNaN(Date.parse(qa.reviewed_at))) errors.push('QC review timestamp invalid');
    const transcriptPath = path.join(runDir, 'transcript.txt');
    if (!exists(transcriptPath) || !read(transcriptPath).trim()) errors.push('spoken transcript required for independent audit');
    else {
      if (qa.transcript_sha256 !== sha256(transcriptPath)) errors.push('QC transcript checksum mismatch');
      verifyTranscript(read(transcriptPath), ranking, input, errors);
    }
    for (const key of ['rankings_spoken_correct', 'place_names_correct', 'unknown_values_not_invented', 'wave_period_absent', 'opening_ending_correct', 'voice_and_timing_approved']) {
      if (qa[key] !== true) errors.push('QC audio audit not passed: ' + key);
    }
    checks.audio_review_claim_recorded = !errors.some(e => /QC |transcript|forbidden|unverified tomorrow/.test(e));
  }

  if (stage === 'ready') {
    const youtube = jsonFile(path.join(runDir, 'youtube-verification.json'), errors);
    if (youtube) {
      if (youtube.privacyStatus !== 'private' || youtube.private_verified !== true) errors.push('YouTube private setting not verified');
      if (!/^[\w-]{11}$/.test(String(youtube.video_id ?? ''))) errors.push('YouTube video ID invalid');
      if (!exists(videoPath) || youtube.video_sha256 !== sha256(videoPath)) errors.push('uploaded video checksum missing or mismatch');
      if (youtube.run_id !== meta?.run_id) errors.push('YouTube run_id mismatch');
      if (!youtube.verified_at || isNaN(Date.parse(youtube.verified_at))) errors.push('YouTube privacy check timestamp missing');
      checks.private_youtube_verified = !errors.some(e => e.startsWith('YouTube') || e.startsWith('uploaded'));
    }
  }

  const result: GateResult = {ok: errors.length === 0, stage, run_dir: runDir, checks, errors};
  if (exists(runDir)) fs.writeFileSync(path.join(runDir, 'quality-gate-result.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/quality-gate.ts')) {
  const stage = process.argv[2] as GateStage;
  const runDir = process.argv[3] && path.resolve(process.argv[3]);
  if (!runDir || !['upload', 'ready'].includes(stage)) throw new Error('Usage: tsx src/quality-gate.ts upload|ready <runs/YYYY-MM-DD>');
  const result = runQualityGate(runDir, stage);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 2;
}
