#!/usr/bin/env node
// Copy the CURRENT production KS site shell into the gear page for a scoped release.
const fs = require('node:fs');
const [homePath,gearPath,outPath] = process.argv.slice(2);
if (!homePath || !gearPath || !outPath) throw Error('Usage: node script live-home gear-input gear-output');
const home = fs.readFileSync(homePath,'utf8');
const gear = fs.readFileSync(gearPath,'utf8');
function requiredMatch(html,re,name){
  const a=html.match(re);
  if(!a || a.length!==2) throw Error('Cannot parse '+name);
  return a[1];
}
const header = requiredMatch(home,/(<header class="top-bar">[\s\S]*?<\/header>)/,'live header');
function getMenu(html){
  const start=html.indexOf('<div class="mobile-menu" id="mobileMenu">');
  if(start<0)throw Error('Mobile menu not found');
  let depth=0;
  const re=/<\/?div\b[^>]*>/gi;
  re.lastIndex=start;
  let m;
  while((m=re.exec(html))){
    if(m[0].startsWith('</'))depth--;else depth++;
    if(depth===0)return {start,end:re.lastIndex,html:html.slice(start,re.lastIndex)};
  }
  throw Error('Unclosed mobile menu');
}
const menu = getMenu(home).html;
const footer = requiredMatch(home,/(<footer(?:\s[^>]*)?>[\s\S]*?<\/footer>)/,'live footer');
const expected=['id="hamburger"','id="clockTag"','class="footer-links"','id="mobileMenu"'];
for(const token of expected) if(!(header+menu+footer).includes(token))throw Error('Missing live shell token: '+token);
const absolutize = s=>s.replace(/\b(href|src)=(["'])(?!https?:\/\/|\/\/|#|\/|data:|mailto:|tel:)([^"']+)\2/g,(_,a,q,url)=>a+'='+q+'/'+url+q)
  .replace(/location\.href=(["'])(?!\/|https?:\/\/)([^"']+)\1/g,(_,q,url)=>'location.href='+q+'/'+url+q);
let out=gear;
const headerStart=out.search(/<header class="(?:header|top-bar)">/);
if(headerStart<0)throw Error('No gear header');
const headerEnd=out.indexOf('</header>',headerStart)+9;
if(headerEnd<9)throw Error('Unclosed gear header');
let replaceEnd=headerEnd;
if(out.includes('<div class="mobile-menu" id="mobileMenu">',headerEnd)){
  const existingMenu=getMenu(out);
  if(existingMenu.start>headerEnd && existingMenu.start-headerEnd<150)replaceEnd=existingMenu.end;
}
out=out.slice(0,headerStart)+absolutize(header+'\n'+menu)+out.slice(replaceEnd);
const footBoundary=/<footer(?:\s[^>]*)?>[\s\S]*?<\/footer>/;
if(!footBoundary.test(out))throw Error('No gear footer');
out=out.replace(footBoundary,absolutize(footer));
if(!out.includes('/nami_common.css'))throw Error('KS shared stylesheet missing from gear HTML');
if(!out.includes('gear.css'))throw Error('Gear CSS missing');
const liveFonts=requiredMatch(home,/<link href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)" rel="stylesheet">/,'live web fonts');
if(!out.includes('href="'+liveFonts+'"'))throw Error('Gear web fonts differ from live KS shell');
if(!out.includes('id="hamburger"'))throw Error('Hamburger missing');
if((out.match(/class="amazon-link"/g)||[]).length!==10)throw Error('Amazon category count changed');
if((out.match(/<header\b/g)||[]).length!==1 || (out.match(/<footer\b/g)||[]).length!==1)throw Error('Header/footer count not 1');
if(!out.includes('LIVE '))throw Error('Clock script missing');
fs.writeFileSync(outPath,out,'utf8');
console.log('LIVE_KS_SHELL_COPIED '+out.length);
