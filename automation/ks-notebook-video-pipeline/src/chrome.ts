import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext } from 'playwright';

export interface ChromeSession { context:BrowserContext; close:()=>Promise<void>; }

export async function startKsChrome():Promise<ChromeSession> {
  const profile=process.env.KS_CHROME_PROFILE
    ?? path.join(process.env.USERPROFILE ?? '.', 'Documents', 'ks-notebook-chrome-profile');
  fs.mkdirSync(profile,{recursive:true});

  const context=await chromium.launchPersistentContext(profile,{
    channel:'chrome',
    headless:false,
    viewport:null,
    acceptDownloads:true,
    args:[
      '--start-maximized',
      '--disable-features=Translate',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });
  return { context, close:()=>context.close() };
}
