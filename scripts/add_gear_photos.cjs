const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const items = [
  {id:1,photo:14540606, label:'ワックスをサーフボードに塗る手元',credit:'Lucas Andrade',note:'ワックスの使用シーン'},
  {id:2,photo:7425766, label:'海から戻り車で干されるウェットスーツ',credit:'Kindel Media',note:'洗浄・乾燥の参考シーン'},
  {id:3,photo:12125314, label:'海辺のネオプレン製スーツ',credit:'Nick Gosset',note:'補修対象の素材の参考写真。接着剤自体は写っていません'},
  {id:4,photo:27016968,label:'サーフボードのフィンを取り付ける人',credit:'isabel ph',note:'フィンの取り付けシーン。工具・ネジの製品写真ではありません'},
  {id:5,photo:5792833, label:'サーフボードのワックスを手入れする人',credit:'Laker',note:'ワックスメンテナンスの参考シーン。スクレーパー本体の製品写真ではありません'},
  {id:6,photo:4330127, label:'スタンドに収納された複数のサーフボード',credit:'ArtHouse Studio',note:'ボード保管スタンドの参考シーン'},
  {id:7,photo:8115960, label:'バケットハットを着用して波に乗るサーファー',credit:'Oleg Prachuk',note:'帽子の使用シーン'},
  {id:8,photo:630960,  label:'ポンチョを着用する女性',credit:'Simon Robben',note:'一般的なポンチョの参考写真。着替え用サーフポンチョそのものではありません'},
  {id:9,photo:19596863,label:'海辺で足首にリーシュコードを取り付ける人',credit:'Jonathan Borba',note:'リーシュの使用シーン'},
  {id:10,photo:15391904,label:'砂浜に置かれたバッグ',credit:'Kássia Melo',note:'バッグ利用の参考写真。防水・濡れ物収納機能を示す製品写真ではありません'}
];
const imagesDir=path.join(root,'gear','images');
fs.mkdirSync(imagesDir,{recursive:true});
let html=fs.readFileSync(path.join(root,'gear','index.html'),'utf8');
if (html.includes('class="gear-photo"')) throw Error('Already populated');
for (const it of items) {
 const name=String(it.id).padStart(2,'0')+'.jpg';
 const remote='https://images.pexels.com/photos/'+it.photo+'/pexels-photo-'+it.photo+'.jpeg?auto=compress&cs=tinysrgb&w=760';
 cp.execFileSync('curl.exe',['--fail','--location','--silent','--show-error','--retry','3',remote,'-o',path.join(imagesDir,name)],{timeout:25000});
 const buf=fs.readFileSync(path.join(imagesDir,name));
 if(buf.length<6000 || buf[0]!==255||buf[1]!==216)throw Error('Invalid image '+it.id+' '+buf.length);
 console.log('PHOTO '+it.id+' '+buf.length);
 const figure='<figure class="gear-photo"><img src="images/'+name+'" width="760" height="570" loading="lazy" decoding="async" alt="'+it.label+'"><figcaption>参考写真</figcaption></figure>';
 const anchor='<article class="gear-item" id="gear-'+it.id+'">';
 if(!html.includes(anchor))throw Error('Missing gear '+it.id);
 html=html.replace(anchor,anchor+'\n'+figure);
}
if ((html.match(/class="gear-photo"/g)||[]).length!==10) throw Error('Expected 10 photos');
html=html.replace('リンク先は商品名・用途のキーワードによる検索結果です。','掲載写真はカテゴリの使用場面などを示す参考写真であり、Amazonリンク先の商品画像・販売商品の保証ではありません。リンク先は商品名・用途のキーワードによる検索結果です。');
fs.writeFileSync(path.join(root,'gear','index.html'),html,'utf8');
const css=path.join(root,'gear','gear.css');
fs.appendFileSync(css,'\n/* Gear category photographs (Pexels-licensed editorial illustrations) */\n.gear-item{grid-template-columns:92px minmax(185px,255px) minmax(0,1fr) 174px;gap:23px;align-items:center}\n.gear-photo{margin:0;position:relative;min-width:0;aspect-ratio:4/3;overflow:hidden;background:#1c2f3d;border:1px solid rgba(255,255,255,.12)}\n.gear-photo img{width:100%;height:100%;display:block;object-fit:cover;object-position:center}\n.gear-photo figcaption{position:absolute;bottom:0;right:0;background:rgba(0,15,23,.8);padding:3px 9px;font-size:10px;letter-spacing:.03em;color:#fff}\n@media(max-width:1100px){.gear-item{grid-template-columns:66px minmax(160px,220px) minmax(0,1fr);gap:16px}.amazon-link{grid-column:3;width:max-content;max-width:100%}}\n@media(max-width:700px){.gear-item{grid-template-columns:48px minmax(0,1fr);gap:14px}.gear-photo{grid-column:2;grid-row:1;aspect-ratio:4/3}.item-number{grid-column:1;grid-row:1}.item-body{grid-column:2;grid-row:2}.amazon-link{grid-column:2;grid-row:3;width:100%}}\n','utf8');
const doc=[
'# KS Gear photo sources / license record','',
'Images are representative editorial photographs, **not** images of the products sold by the Amazon search links.',
'Each original image was obtained from its publicly listed Pexels Free Stock Photo page on 2026-11-11 and resized by the official images.pexels.com CDN at 760px.',
'Pexels License: https://www.pexels.com/license/ (commercial website use permitted; no endorsement implied).','',
'| # | Credit | Photo URL | What the image really shows |',
'|---|---|---|---|',
...items.map(i=>'| '+i.id+' | '+i.credit+' | https://www.pexels.com/photo/'+i.photo+'/ | '+i.note+' |'),
'','No Amazon images were copied. If replacing an editorial image with product-specific imagery later, verify its rights separately.'
].join('\n');
fs.writeFileSync(path.join(root,'docs','GEAR_PHOTO_LICENSES.md'),doc,'utf8');
console.log('ALL TEN PHOTO FILES ADDED');
