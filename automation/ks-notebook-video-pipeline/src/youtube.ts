import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { google } from 'googleapis';
import { getYoutubeAuth } from './youtube-auth.js';
import { runQualityGate } from './quality-gate.js';

const hash = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const readJson = (p: string) => JSON.parse(fs.readFileSync(p,'utf8'));

// Explicitly private-only upload. Every run must have passed duration + CONTENT quality checks.
export async function uploadYoutube(params: {runDir: string}) {
  const runDir = path.resolve(params.runDir);
  const gate = runQualityGate(runDir, 'upload');
  if (!gate.ok) throw new Error('UPLOAD_BLOCKED_BY_QC: ' + gate.errors.join('; '));
  const metadata = readJson(path.join(runDir, 'youtube-metadata.json'));
  const videoPath = path.join(runDir, 'video.mp4');
  const receiptPath = path.join(runDir, 'youtube-upload-result.json');
  const attemptPath = path.join(runDir, 'youtube-upload-attempt.json');
  if (metadata.privacyStatus !== 'private') throw new Error('PRIVATE_ONLY');

  const trustedHash = hash(videoPath);
  const expectedChannel = process.env.KS_YOUTUBE_CHANNEL_ID ?? 'UCr3isu_iYJLLWLuZjKGLE7w';
  const auth = await getYoutubeAuth(false);
  const youtube = google.youtube({version: 'v3', auth});
  const channels = await youtube.channels.list({part: ['snippet'], mine: true});
  if (channels.data.items?.length !== 1 || channels.data.items[0].id !== expectedChannel) {
    throw new Error('YOUTUBE_CHANNEL_MISMATCH_OR_AMBIGUOUS_TOKEN');
  }

  const existing = fs.existsSync(receiptPath) ? readJson(receiptPath) : null;
  if (existing && (existing.video_sha256 !== trustedHash || existing.run_id !== metadata.run_id)) {
    throw new Error('EXISTING_UPLOAD_RECEIPT_MISMATCH');
  }
  if (!existing && fs.existsSync(attemptPath)) {
    throw new Error('UNCERTAIN_PREVIOUS_UPLOAD: manual reconcile by YouTube Studio; do not upload again');
  }

  // No second upload is ever attempted after a known YouTube ID has been returned.
  let id: string;
  if (existing?.video_id) {
    id = existing.video_id;
  } else {
    // Atomic pre-insert attempt record prevents parallel processes and ambiguous network retries.
    const fd = fs.openSync(attemptPath, 'wx');
    try {
      fs.writeFileSync(fd, JSON.stringify({
        run_id: metadata.run_id, video_sha256: trustedHash, attempted_at: new Date().toISOString()
      }, null, 2) + '\n');
    } finally { fs.closeSync(fd); }

    // Snapshot binds the bytes sent to YouTube to the bytes checked by QC.
    const snapshot = path.join(runDir, '.upload-snapshot-' + trustedHash + '.mp4');
    try {
      if (hash(videoPath) !== trustedHash) throw new Error('VIDEO_CHANGED_AFTER_QC');
      fs.copyFileSync(videoPath, snapshot, fs.constants.COPYFILE_EXCL);
      if (hash(snapshot) !== trustedHash) throw new Error('UPLOAD_SNAPSHOT_CHECKSUM_MISMATCH');
      const res = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {title: metadata.title, description: metadata.description},
          status: {privacyStatus: 'private'}
        },
        media: {body: fs.createReadStream(snapshot)}
      });
      id = res.data.id ?? '';
      const receipt = {
        video_id: id || null, video_sha256: trustedHash, run_id: metadata.run_id,
        upload_response_privacy: res.data.status?.privacyStatus ?? null,
        received_at: new Date().toISOString()
      };
      fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
      if (!id) throw new Error('YOUTUBE_UPLOAD_UNCERTAIN: receipt has no video ID; do not retry blindly');
    } finally {
      // Keep only validated source + receipt; no duplicate submissions if an exception occurs.
      if (fs.existsSync(snapshot)) fs.rmSync(snapshot, {force: true});
    }
  }

  let privateVerified = false;
  let observedPrivacy: string = 'unverified';
  // YouTube processing/indexing may lag behind the successful insert response.
  for (let attempt = 0; attempt < 5; attempt++) {
    const after = await youtube.videos.list({part: ['status', 'snippet'], id: [id]});
    const current = after.data.items?.find(v => v.id === id);
    observedPrivacy = current?.status?.privacyStatus ?? 'unverified';
    privateVerified = observedPrivacy === 'private' && current?.snippet?.channelId === expectedChannel;
    if (privateVerified) break;
    await wait(Math.min(2000 * (attempt + 1), 10000));
  }

  const verification = {
    video_id: id, video_sha256: trustedHash, run_id: metadata.run_id,
    privacyStatus: observedPrivacy, private_verified: privateVerified,
    verified_at: new Date().toISOString()
  };
  fs.writeFileSync(path.join(runDir, 'youtube-verification.json'), JSON.stringify(verification, null, 2) + '\n', 'utf8');
  if (!privateVerified) throw new Error('YOUTUBE_PRIVACY_OR_CHANNEL_NOT_VERIFIED: reuse receipt to reconcile, do not duplicate upload');
  return {id, privacyStatus: 'private' as const, url: 'https://youtu.be/' + id};
}

export function writeCapability(file: string, result: unknown) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify({tested_at: new Date().toISOString(), ...result as object}, null, 2), 'utf8');
}
