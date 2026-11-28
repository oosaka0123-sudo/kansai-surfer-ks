const fs=require('node:fs'),a=require('node:assert/strict'),cp=require('node:child_process');
const coords={ukibuchi:'33.02999,133.02935',irino:'33.01989,133.01787',futami:'32.96866,133.0005',hirano:'32.96026,132.99673',oki:'32.82348,132.95328'};
for(const s of require('../shimanto/spot-candidates.json').spots){
 const p=s.page,h=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n'),old=cp.execFileSync('git',['show','089fcf1e7954e33787123243260b2a165c9a9b07:'+p],{encoding:'utf8'}).replace(/\r\n/g,'\n');
 const rx=/<section class="section" id="shimanto-location-map"[\s\S]*?<\/section>/g,q=encodeURIComponent(coords[s.id]);
 const m=h.match(rx),b=old.match(rx);a.equal(m?.length,1);a.equal(b?.length,1);
 const expected=b[0].replace(/(https:\/\/maps\.google\.com\/maps\?q=)[^&]+&amp;t=k&amp;z=\d+&amp;output=embed/,'$1'+q+'&amp;t=k&amp;z=16&amp;output=embed').replace(/(https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=)[^"]+/,'$1'+q).replace('ナビと同じアクセス先','海岸の参考位置（車のナビは下のボタン）');
 a.equal(m[0],expected);a.equal(h.replace(rx,''),old.replace(rx,''));a.ok(m[0].includes('q='+q+'&amp;t=k&amp;z=16'));a.ok(m[0].includes('query='+q+'"'));
 console.log(p,'beach-centered satellite map, driving destination unchanged');
}
