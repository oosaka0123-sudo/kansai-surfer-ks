import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { exec } from 'node:child_process';
import { google } from 'googleapis';

type ClientSecretFile={
  installed?:{client_id:string;client_secret:string;redirect_uris?:string[]};
  web?:{client_id:string;client_secret:string;redirect_uris?:string[]};
};

const secretRoot=process.env.KS_SECRET_ROOT
  ?? path.join(process.env.USERPROFILE ?? '.', '.ks-secrets', 'youtube');
const clientPath=process.env.YOUTUBE_CLIENT_SECRET_FILE
  ?? path.join(secretRoot,'client_secret.json');
const tokenPath=process.env.YOUTUBE_TOKEN_FILE
  ?? path.join(secretRoot,'token.json');

export function getSecretPaths(){ return {secretRoot,clientPath,tokenPath}; }

function loadClient(){
  if(!fs.existsSync(clientPath)) throw new Error(`AUTH_REQUIRED: place OAuth desktop client JSON at ${clientPath}`);
  const raw=JSON.parse(fs.readFileSync(clientPath,'utf8')) as ClientSecretFile;
  const c=raw.installed ?? raw.web;
  if(!c) throw new Error('Invalid OAuth client JSON: expected installed or web');
  return c;
}

export async function getYoutubeAuth(interactive=false){
  const c=loadClient();
  const redirect='http://127.0.0.1:53682/oauth2callback';
  const auth=new google.auth.OAuth2(c.client_id,c.client_secret,redirect);

  if(fs.existsSync(tokenPath)){
    auth.setCredentials(JSON.parse(fs.readFileSync(tokenPath,'utf8')));
    return auth;
  }
  if(!interactive) throw new Error(`AUTH_REQUIRED: token missing at ${tokenPath}; run npm run youtube:auth`);

  fs.mkdirSync(secretRoot,{recursive:true});
  const url=auth.generateAuthUrl({
    access_type:'offline',
    prompt:'consent',
    scope:['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube']
  });

  const code=await new Promise<string>((resolve,reject)=>{
    const server=http.createServer(async(req,res)=>{
      try{
        const u=new URL(req.url ?? '/',redirect);
        if(u.pathname!=='/oauth2callback') {res.statusCode=404;res.end('Not found');return;}
        const code=u.searchParams.get('code');
        if(!code) throw new Error('Missing authorization code');
        res.end('KS YouTube authorization complete. You may close this window.');
        server.close();
        resolve(code);
      }catch(e){server.close();reject(e);}
    });
    server.listen(53682,'127.0.0.1',()=>{
      console.log('Opening Google OAuth consent in browser...');
      exec(`start "" "${url}"`);
    });
    server.on('error',reject);
  });

  const {tokens}=await auth.getToken(code);
  auth.setCredentials(tokens);
  fs.writeFileSync(tokenPath,JSON.stringify(tokens,null,2),'utf8');
  console.log(`Saved token: ${tokenPath}`);
  return auth;
}

if(import.meta.url===`file:///${process.argv[1]?.replace(/\\/g,'/')}`){
  await getYoutubeAuth(true);
}
