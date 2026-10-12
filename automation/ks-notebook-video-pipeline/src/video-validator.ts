import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

export type VideoValidation={
  ok:boolean;
  duration:number;
  width:number;
  height:number;
  hasVideo:boolean;
  hasAudio:boolean;
  errors:string[];
};

export function validateVideo(file:string):VideoValidation{
  const errors:string[]=[];
  if(!fs.existsSync(file)) return {ok:false,duration:0,width:0,height:0,hasVideo:false,hasAudio:false,errors:['file missing']};
  let probe:any;
  try{
    const out=execFileSync('ffprobe',[
      '-v','error','-show_streams','-show_format','-of','json',file
    ],{encoding:'utf8'});
    probe=JSON.parse(out);
  }catch(e){
    return {ok:false,duration:0,width:0,height:0,hasVideo:false,hasAudio:false,errors:['ffprobe failed']};
  }
  const streams=probe.streams ?? [];
  const video=streams.find((s:any)=>s.codec_type==='video');
  const audio=streams.find((s:any)=>s.codec_type==='audio');
  const duration=Number(probe.format?.duration ?? video?.duration ?? 0);
  const width=Number(video?.width ?? 0);
  const height=Number(video?.height ?? 0);
  if(!video) errors.push('video stream missing');
  if(!audio) errors.push('audio stream missing');
  if(duration<30) errors.push('duration under 30 seconds');
  if(width<1280 || height<720) errors.push('resolution below 720p');
  return {ok:errors.length===0,duration,width,height,hasVideo:!!video,hasAudio:!!audio,errors};
}

if(process.argv[1]?.replace(/\\/g,'/').endsWith('/video-validator.ts')){
  const file=process.argv[2];
  if(!file) throw new Error('Usage: tsx src/video-validator.ts <video.mp4>');
  const result=validateVideo(file);
  console.log(JSON.stringify(result,null,2));
  if(!result.ok) process.exitCode=2;
}
