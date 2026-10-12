import fs from 'node:fs';
import path from 'node:path';
import { uploadYoutube, writeCapability } from './youtube.js';

const videoPath=process.env.YOUTUBE_TEST_VIDEO ?? path.resolve('dummy.mp4');
if(!fs.existsSync(videoPath)) throw new Error(`Test video not found: ${videoPath}`);

const requested=(process.env.YOUTUBE_TEST_PRIVACY ?? 'unlisted') as 'private'|'unlisted';
const result=await uploadYoutube({
  videoPath,
  title:`KS-API-TEST-${new Date().toISOString()}`,
  description:'KS Notebook pipeline connectivity test',
  privacyStatus:requested
});
writeCapability(path.resolve('youtube-capability.json'),{
  oauth_ok:true,
  upload_ok:true,
  requested_privacy:requested,
  ...result
});
console.log(JSON.stringify(result,null,2));
