import fs from 'node:fs';
import path from 'node:path';
import { startKsChrome } from './chrome.js';

const out=path.resolve('runs','notebook-connectivity');
fs.mkdirSync(out,{recursive:true});
const session=await startKsChrome();
try{
  const page=session.context.pages()[0] ?? await session.context.newPage();
  await page.goto('https://notebooklm.google.com/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(5000);
  await page.screenshot({path:path.join(out,'notebook-home.png'),fullPage:true});
  const title=await page.title();
  const url=page.url();
  const body=(await page.locator('body').innerText().catch(()=>'' )).slice(0,8000);
  const markers={
    create:/create|new notebook|新しいノートブック|ノートブックを作成/i.test(body),
    signIn:/sign in|ログイン/i.test(body),
    tryNotebook:/try notebook|notebooklm を試す|始める/i.test(body)
  };
  const authRequired=markers.signIn && !markers.create;
  fs.writeFileSync(path.join(out,'body.txt'),body,'utf8');
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({title,url,authRequired,markers,checked_at:new Date().toISOString()},null,2));
  console.log(JSON.stringify({title,url,authRequired,markers,bodySample:body.slice(0,1000)},null,2));
} finally {
  await session.close();
}
