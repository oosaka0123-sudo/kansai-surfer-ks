const fs=require('node:fs'),a=require('node:assert/strict'),cp=require('node:child_process');
const old=p=>cp.execFileSync('git',['show','ea11494:'+p],{encoding:'utf8',maxBuffer:2000000}).replace(/\r\n/g,'\n');
for(const s of require('../shimanto/spot-candidates.json').spots){
const h=fs.readFileSync(s.page,'utf8').replace(/\r\n/g,'\n'), b=old(s.page);
const ns=[...h.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/g)].map(m=>m[0].match(/<span class="no">(\d+)<\/span>/)?.[1]);
a.deepEqual(ns,['01','02','03','04','05','06','07'],s.page);
a.ok(!h.includes('shimanto-reports'));a.ok(!h.includes('\u73fe\u5730\u6ce2\u30ec\u30dd\u30fc\u30c8'));
const nav=/<a class="shimanto-nav-btn"[\s\S]*?<\/a><p style="margin:7px 0 0;[\s\S]*?<\/p>/g;
a.deepEqual(h.match(nav),b.match(nav));a.equal(h.match(nav)?.length,1);
a.ok(/class="section ks-windy-section"[\s\S]*?<\/section>\n<section class="section" id="shimanto-location-map"/.test(h));
a.ok(h.includes('unified.js?v=20261128-5'));a.ok(h.includes('\u66ab\u5b9a\u53c2\u8003\u8a55\u4fa1'));
a.equal(h.match(/maps\.google\.com\/maps\?q=[^"]+/)?.[0],b.match(/maps\.google\.com\/maps\?q=[^"]+/)?.[0]?.replace('&amp;z=15&amp;output=embed','&amp;t=k&amp;z=18&amp;output=embed'));
a.ok(h.includes('height:clamp(400px,85vw,600px)')); 
}
const j=fs.readFileSync('shimanto/unified.js','utf8').replace(/\r\n/g,'\n');a.equal(j,old('shimanto/unified.js').replace(/^const reports=\$\('shimanto-reports'\);[^\n]*\n/m,''));a.ok(!j.includes('line_posts.json'));
for(const p of ['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto'])a.equal(fs.readFileSync(p+'.html','utf8').replace(/\r\n/g,'\n'),old(p+'.html'));
console.log('5 pages: 01-07, no report, preserved map and nav, verdict, protected 9 pages');

