import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function cmdExists(cmd:string){
  try{execFileSync('where',[cmd],{stdio:'ignore'});return true;}catch{return false;}
}

const user=process.env.USERPROFILE ?? '.';
const secretRoot=process.env.KS_SECRET_ROOT ?? path.join(user,'.ks-secrets','youtube');
const profile=process.env.KS_CHROME_PROFILE ?? path.join(user,'Documents','ks-notebook-chrome-profile');
const notebookResult=path.resolve('runs','notebook-connectivity','result.json');

const report={
  node:process.version,
  chrome:cmdExists('chrome.exe') || fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'),
  ffprobe:cmdExists('ffprobe.exe'),
  youtube_client_secret:fs.existsSync(path.join(secretRoot,'client_secret.json')),
  youtube_token:fs.existsSync(path.join(secretRoot,'token.json')),
  notebook_profile:fs.existsSync(profile),
  notebook_last_check:fs.existsSync(notebookResult)?JSON.parse(fs.readFileSync(notebookResult,'utf8')):null
};

console.log(JSON.stringify(report,null,2));
if(!report.chrome || !report.ffprobe) process.exitCode=2;
