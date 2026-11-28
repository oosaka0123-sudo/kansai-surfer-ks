'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const menu=fs.readFileSync(path.join(root,'shimanto/menu-fragment.html'),'utf8').trim();
const home=fs.readFileSync(path.join(root,'shimanto/home-fragment.html'),'utf8').trim();
const spots=require('../shimanto/spot-candidates.json').spots;
function patch(original){
 assert.ok(!original.includes('data-ks-shimanto'),'already patched');
 const menuAnchor='<div class="mm-section">その他</div>';
 const footer='<footer>';
 for(const anchor of [menuAnchor,footer])assert.equal(original.split(anchor).length,2,'unique anchor required');
 const mm=original.indexOf('<div class="mobile-menu" id="mobileMenu">');
 assert.ok(mm>=0&&original.indexOf(menuAnchor)>mm&&original.indexOf(menuAnchor)<original.indexOf('</div>\n\n',original.indexOf(menuAnchor)),'menu context');
 assert.equal(original.split('const SPOTS = [').length,2,'ranking array anchor');
 const block='<div data-ks-shimanto="menu" style="display:contents">'+menu+'</div>\n  ';
 const region='<div data-ks-shimanto="home" style="max-width:1080px;margin:0 auto;padding:12px 20px 24px;color:inherit">'+home+'</div>\n';
 const output=original.replace(menuAnchor,block+menuAnchor).replace(footer,region+footer);
 assert.equal(output.replace(block,'').replace(region,''),original,'original must be preserved exactly');
 for(const s of spots){assert.equal(block.split('href="'+s.page+'"').length,2);assert.equal(region.split('href="'+s.page+'"').length,2);}
 assert.ok(!/評価点|順位|ランキング|score/i.test(region));
 assert.equal(output.match(/<script\b[\s\S]*?<\/script>/gi).join(''),original.match(/<script\b[\s\S]*?<\/script>/gi).join(''),'scripts unchanged');
 return output;
}
module.exports={patch,hash};
if(require.main===module){const [input,output,expected]=process.argv.slice(2);if(!input||!output||!expected)throw Error('usage: patch-home-shimanto <input> <output> <expected-original-sha256>');const bytes=fs.readFileSync(input),original=bytes.toString('utf8');assert.equal(hash(bytes),expected);assert.equal(Buffer.compare(bytes,Buffer.from(original)),0,'UTF8');const result=patch(original);fs.writeFileSync(output,result);console.log(JSON.stringify({originalSha:hash(bytes),candidateSha:hash(result),originalBytes:bytes.length,candidateBytes:Buffer.byteLength(result)}));}