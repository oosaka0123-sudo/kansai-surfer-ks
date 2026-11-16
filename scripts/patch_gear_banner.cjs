#!/usr/bin/env node
// Reposition ONLY existing production gear banner before the first YouTube-wave section.
const fs=require('node:fs'),path=require('node:path');
const [source,bannerPath,output]=process.argv.slice(2);
if(!source||!bannerPath||!output||path.resolve(source)===path.resolve(output))throw Error('Usage: node patch_gear_banner.cjs CURRENT_INDEX BANNER NEW_INDEX');
const html=fs.readFileSync(source,'utf8');
const banner=fs.readFileSync(bannerPath,'utf8').trimEnd();
const start='<!-- KS GEAR BANNER START -->',end='<!-- KS GEAR BANNER END -->';
if(!html.includes('関西サーフィン波情報')||!html.includes('nami_common.js'))throw Error('Unrecognized production homepage');
for(const marker of [start,end])if(html.split(marker).length!==2)throw Error('Missing or duplicate banner '+marker);
if(!banner.startsWith(start)||!banner.endsWith(end)||!banner.includes('href="/gear/"')||!banner.includes('Amazon公式売上順位ではありません')||!banner.includes('height:102px'))throw Error('New banner is invalid');
const from=html.indexOf(start),until=html.indexOf(end,from)+end.length;
if(from<0||until<end.length||html.slice(until,until+2)!=='\n\n')throw Error('Unexpected old banner boundaries');
const without=html.slice(0,from)+html.slice(until+2);
const anchors=[...without.matchAll(/<!--[^>]*YouTube[^>]*-->/g)];
if(anchors.length!==1)throw Error('Cannot uniquely locate first YouTube wave information section: '+anchors.length);
const at=anchors[0].index;
if(at<without.indexOf('<h1')||at>without.indexOf('<!-- ============ TODAY'))throw Error('YouTube anchor is not at upper homepage');
const updated=without.slice(0,at)+banner+'\n\n'+without.slice(at);
if(updated.replace(banner+'\n\n','')!==without)throw Error('Non-banner homepage bytes changed');
if(updated.indexOf(start)>=updated.indexOf(anchors[0][0]))throw Error('Not before YouTube');
fs.writeFileSync(output,updated,{encoding:'utf8',flag:'wx'});
console.log('KS banner relocated to upper homepage, ahead of YouTube; all other bytes preserved.');