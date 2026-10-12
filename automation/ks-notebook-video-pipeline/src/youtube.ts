import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { getYoutubeAuth } from './youtube-auth.js';

export async function uploadYoutube(params:{
  videoPath:string;
  title:string;
  description:string;
  privacyStatus:'private'|'unlisted';
}) {
  const auth=await getYoutubeAuth(false);
  const youtube=google.youtube({version:'v3',auth});
  const res=await youtube.videos.insert({
    part:['snippet','status'],
    requestBody:{
      snippet:{title:params.title,description:params.description},
      status:{privacyStatus:params.privacyStatus}
    },
    media:{body:fs.createReadStream(params.videoPath)}
  });
  return {
    id:res.data.id ?? null,
    privacyStatus:res.data.status?.privacyStatus ?? null,
    url:res.data.id ? `https://youtu.be/${res.data.id}` : null
  };
}

export function writeCapability(file:string, result:unknown){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({tested_at:new Date().toISOString(),...result as object},null,2),'utf8');
}
