import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateVideoProbe } from './video-validator.js';
import { buildSource } from './build-source.js';
import { runQualityGate } from './quality-gate.js';
import { createInitialState, saveState } from './state.js';

const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const shaText = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-60-qc-'));
const dir = path.join(base, '2099-01-01');
fs.mkdirSync(dir, {recursive:true});

const ranking = [
 '1位 宍喰 42点','モモ〜ハラ／サイド','2位 小松海岸 36点','ヒザ〜モモ／オフ',
 '3位 静波 34点','アタマ・セット アタ…／サイド','4位 国府の浜三角 32点',
 'ハラ〜ムネ・セット…／サイド','5位 ロングビーチ 27点','ムネ・たまのセット…／サイドオフ',
 '6位 生見 23点','カタ〜アタマ…／サイド','7位 小沢見 9点','スネ〜ヒザ／オフ',
 '8位 高浜 8点','スネ〜ヒザ／オフ','9位 磯ノ浦メイン 5点','セット スネたまに…／オフ'
].join('\n');
const input={date:'2099-01-01',ranking};
const source=buildSource(input);
const sPath=path.join(dir,'source.md'),vPath=path.join(dir,'video.mp4'),tPath=path.join(dir,'transcript.txt');
const qaPath=path.join(dir,'qc-evidence.json'),yPath=path.join(dir,'youtube-verification.json');
fs.writeFileSync(path.join(dir,'input.json'),JSON.stringify(input));
fs.writeFileSync(sPath,source);
fs.writeFileSync(path.join(dir,'studio-prompt.md'),'Opening Ending アニメ 長い方 TOP3 波周期');
fs.writeFileSync(path.join(dir,'youtube-metadata.json'),JSON.stringify({
 title:'【2099/01/01 朝】KS test',description:'明日の個別予報は未確認。#明日の予想 #波情報動画',
 run_id:'2099-01-01-01',privacyStatus:'private'
}));
fs.writeFileSync(vPath,'FAKE_MEDIA_FOR_UNIT_TEST_WITH_INJECTED_PROBE_ONLY');
const transcript='1位 宍喰 42点 モモからハラ。2位 小松海岸 36点 ヒザからモモ。3位 静波 34点 アタマ。明日の個別情報は確認できません。';
fs.writeFileSync(tPath,transcript);
const media=(duration:number)=>validateVideoProbe({
 format:{duration:String(duration)},
 streams:[{codec_type:'video',width:1280,height:720},{codec_type:'audio'}]
});
const run=(stage:'upload'|'ready',seconds=60)=>runQualityGate(dir,stage,()=>media(seconds));
const qa={
 video_sha256:sha(vPath),source_sha256:shaText(source),transcript_sha256:sha(tPath),
 reviewer:'human-reviewer-example',review_method:'human_listening',
 reviewed_at:'2099-01-01T08:00:00+09:00',
 rankings_spoken_correct:true,place_names_correct:true,unknown_values_not_invented:true,
 wave_period_absent:true,opening_ending_correct:true,voice_and_timing_approved:true
};
const youtube={
 video_id:'123456789ab',video_sha256:sha(vPath),run_id:'2099-01-01-01',
 privacyStatus:'private',private_verified:true,verified_at:'2099-01-01T08:10:00+09:00'
};
try {
 assert.equal(media(60).ok,true);
 for(const seconds of [54.9,65.1,140.7]){
  assert.equal(media(seconds).ok,false,seconds+' sec must fail');
 }
 for(const seconds of [55,65])assert.equal(media(seconds).ok,true);
 assert(run('upload').errors.some(e=>e.includes('qc-evidence')), 'missing QC file must fail');
 fs.writeFileSync(qaPath,JSON.stringify(qa));
 assert(run('upload',140.7).errors.some(e=>e.includes('55-65 seconds')),'overlong must fail for correct reason');
 assert.equal(run('upload').ok,true,'valid technical+human evidence must pass upload gate');
 // Reviewer-forged filler transcript must not pass just because all JSON flags are true.
 fs.writeFileSync(tPath,'全語を照合済みの検証用トランスクリプト');
 qa.transcript_sha256=sha(tPath);
 fs.writeFileSync(qaPath,JSON.stringify(qa));
 assert(run('upload').errors.some(e=>e.includes('transcript missing TOP3 spot')),'fake transcript must fail');
 fs.writeFileSync(tPath,transcript+' 波周期は10秒');
 qa.transcript_sha256=sha(tPath);
 fs.writeFileSync(qaPath,JSON.stringify(qa));
 assert(run('upload').errors.some(e=>e.includes('forbidden wave period')),'wave period must fail');
 fs.writeFileSync(tPath,transcript);
 qa.transcript_sha256=sha(tPath);
 fs.writeFileSync(qaPath,JSON.stringify(qa));
 assert(run('ready').errors.some(e=>e.includes('youtube-verification')),'missing verification must fail');
 fs.writeFileSync(yPath,JSON.stringify({...youtube,privacyStatus:'public',private_verified:false}));
 assert(run('ready').errors.some(e=>e.includes('private')),'public cannot pass');
 fs.writeFileSync(yPath,JSON.stringify(youtube));
 assert.equal(run('ready').ok,true,'correct 60 seconds+spoken content review+private verification must pass');
 const state=createInitialState('2099-01-01'); state.phase='READY_FOR_REVIEW';
 assert.throws(()=>saveState(path.join(dir,'state.json'),state),/READY_STATE_PROGRESS_OR_VIDEO_ID_MISMATCH|INVALID_READY_STATE/);
 state.phase='DONE';
 assert.throws(()=>saveState(path.join(dir,'state.json'),state),/DONE_REQUIRES/);
 fs.writeFileSync(sPath,source.replace('42点','43点'));
 assert(run('upload').errors.some(e=>e.includes('preserve complete pasted ranking')),'rank tampering must fail');
 assert(!source.includes('波の周期は動画説明に使用しない'));
 console.log('PASS: 55-65 seconds bounds; 140.7s blocked; fake/period transcripts blocked; rank tampering blocked; private+QC required; READY/DONE guarded');
}finally{fs.rmSync(base,{recursive:true,force:true});}
