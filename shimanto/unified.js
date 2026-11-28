(async function(){
'use strict';const id=document.body.dataset.shimantoId,$=s=>document.getElementById(s);const n=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const get=async u=>{const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
const jst=i=>new Date(Date.now()+9*3600000+i*86400000).toISOString().slice(0,10);const now=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,13)+':00';
const dirs=['北','北東','東','南東','南','南西','西','北西'],direction=v=>n(v)===null?'—':dirs[Math.round(v/45)%8];
const icon=v=>n(v)===null?'—':v===0||v===1?'☀️':v===2?'⛅':v===3?'☁️':[45,48].includes(v)?'🌫️':[51,53,55,56,57,61,63,65,66,67,80,81,82].includes(v)?'🌧️':[71,73,75,77,85,86].includes(v)?'🌨️':[95,96,99].includes(v)?'⛈️':'—';
const fmt=v=>n(v)===null?'—':v.toFixed(1);
const set=(id,value)=>{const e=$(id);if(e)e.textContent=value;};
const menu=$('hamburger'),panel=$('mobileMenu');if(menu&&panel){menu.setAttribute('aria-expanded','false');menu.addEventListener('click',()=>{const a=panel.classList.toggle('open');menu.classList.toggle('active',a);menu.setAttribute('aria-expanded',String(a));});document.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.classList.remove('open');menu.classList.remove('active');menu.setAttribute('aria-expanded','false');}});}
const frame=$('shimanto-hourly');window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type==='ks-shimanto-frame-height'&&Number.isFinite(e.data.height)&&e.data.height>=300&&e.data.height<=2200)frame.style.height=Math.ceil(e.data.height)+'px';});
const config=await get('shimanto/spot-candidates.json').catch(()=>null),spot=config?.spots.find(x=>x.id===id);if(!spot){set('lastUpdate','取得不可');return;}
const coastNormal={ukibuchi:135,irino:135,futami:112.5,hirano:112.5,oki:135};
function getSpotConfig(){const a=coastNormal[id];if(!Number.isFinite(a))return null;return {OFFSHORE_START:a+135,OFFSHORE_END:(a+225)%360,SWELL_BEST_MIN:a-45,SWELL_BEST_MAX:a+45,WIND_TOLERANCE:1};}
    function isOffshore(deg) {
        const cfg = getSpotConfig(); if (!cfg || deg == null || isNaN(deg)) return false;
        const start = cfg.OFFSHORE_START, end = cfg.OFFSHORE_END;
        if (start > end) return deg >= start || deg <= end;
        return deg >= start && deg <= end;
      }

    function isOnshore(deg) {
        const cfg = getSpotConfig(); if (!cfg || deg == null || isNaN(deg)) return false;
        const start = cfg.OFFSHORE_START, end = cfg.OFFSHORE_END;
        let offshoreCenter = start > end ? ((start + end + 360) / 2) % 360 : (start + end) / 2;
        const onshoreCenter = (offshoreCenter + 180) % 360;
        let diff = Math.abs(deg - onshoreCenter); if (diff > 180) diff = 360 - diff;
        return diff <= 60;
      }

    function swellDirScore(dir) {
        const cfg = getSpotConfig(); if (!cfg || dir == null) return 0.7;
        const min = cfg.SWELL_BEST_MIN, max = cfg.SWELL_BEST_MAX;
        if (dir >= min && dir <= max) return 1.0;
        if (dir >= min - 30 && dir <= max + 30) return 0.7;
        return 0.4;
      }

    function calcScore(h, p, ws, wd, sd) {
        const cfg = getSpotConfig();
        if (h == null || h < 0.2) return 0.5;
        if (h < 0.3) return Math.min(1.5, h * 4);
        let sizeScore;
        if (h < 0.4) sizeScore = 1.5;
        else if (h < 0.6) sizeScore = 2.5;
        else if (h < 1.0) sizeScore = 4.0;
        else if (h < 1.5) sizeScore = 5.0;
        else if (h < 2.0) sizeScore = 4.5;
        else if (h < 2.5) sizeScore = 3.5;
        else sizeScore = 2.5;
        let periodScore = 1.0;
        if (p != null) {
          if (p < 5) periodScore = 0.3;
          else if (p < 7) periodScore = 0.8;
          else if (p < 9) periodScore = 1.3;
          else if (p < 11) periodScore = 1.7;
          else periodScore = 2.0;
        }
        let windMult; const ws_ = ws != null ? ws : 5;
        const windTol = (cfg && cfg.WIND_TOLERANCE) ? cfg.WIND_TOLERANCE : 1.0;
        const onshoreBoost = (cfg && cfg.ONSHORE_BOOST) ? 1.0 : 0;
        if (ws_ < 1.5) windMult = 1.0;
        else if (isOffshore(wd)) {
          if (ws_ < 4 * windTol) windMult = 1.0;
          else if (ws_ < 7 * windTol) windMult = 0.95;
          else if (ws_ < 10 * windTol) windMult = 0.85;
          else windMult = 0.7;
        } else if (isOnshore(wd)) {
          if (ws_ < 3 * windTol) windMult = 0.85 + 0.1 * onshoreBoost;
          else if (ws_ < 5 * windTol) windMult = 0.65 + 0.15 * onshoreBoost;
          else if (ws_ < 8 * windTol) windMult = 0.5 + 0.1 * onshoreBoost;
          else windMult = 0.35 + 0.1 * onshoreBoost;
        } else {
          if (ws_ < 3 * windTol) windMult = 0.95;
          else if (ws_ < 6 * windTol) windMult = 0.85;
          else if (ws_ < 9 * windTol) windMult = 0.7;
          else windMult = 0.55;
        }
        let periodBonus = 0;
        if (cfg && cfg.ONSHORE_BOOST && p != null && p >= 5 && p < 8) periodBonus = 0.5;
        return Math.min(10, Math.max(0, (sizeScore + periodScore + periodBonus) * windMult * swellDirScore(sd)));
      }

    function scoreToStars(score) {
        let stars = 1; if (score >= 2.5) stars = 2; if (score >= 4.0) stars = 3; if (score >= 5.5) stars = 4; if (score >= 7.0) stars = 5;
        return '★'.repeat(stars) + '☆'.repeat(5 - stars);
      }

    function getVerdict(score, waveH) {
        if (waveH == null) return { emoji: '❓', text: 'データ取得中', action: 'action-meh' };
        if (waveH < 0.25) return { emoji: '😴', text: '諦めよ', action: 'action-no' };
        if (score >= 7.0) return { emoji: '🔥', text: '完全GO', action: 'action-go' };
        if (score >= 5.5) return { emoji: '✨', text: '行くべし', action: 'action-go' };
        if (score >= 4.0) return { emoji: '👍', text: 'アリ', action: 'action-ok' };
        if (score >= 2.5) return { emoji: '🤔', text: '微妙', action: 'action-meh' };
        return { emoji: '😴', text: '諦めよ', action: 'action-no' };
      }

function dailyJudgment(keys,a,b,mi,wi,at){if(!getSpotConfig())return null;const scores=[],waves=[];for(const k of keys){const i=mi.get(k),j=wi.get(k),h=at(a,'wave_height',i),p=at(a,'wave_period',i),sd=at(a,'wave_direction',i),ws=at(b,'wind_speed_10m',j),wd=at(b,'wind_direction_10m',j);if([h,p,sd,ws,wd].some(v=>v===null)||h<0||p<=0||ws<0||sd<0||sd>360||wd<0||wd>360)continue;scores.push(calcScore(h,p,ws,wd,sd));waves.push(h);}if(scores.length<7)return null;const median=v=>{v.sort((x,y)=>x-y);const k=Math.floor(v.length/2);return v.length%2?v[k]:(v[k-1]+v[k])/2;};const h=median(waves),score=Math.min(median(scores),h<0.25?2.49:10);return {result:getVerdict(score,h),stars:scoreToStars(score)};}

const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el};
function track(text,pct,kind){const wrap=make('div',null,'ks10-track');const bar=make('div',null,'ks10-fill ks10-'+kind);bar.style.setProperty('--ks10-fill',Math.max(0,Math.min(100,pct))+'%');wrap.append(bar,make('span',text,'ks10-val'));return wrap;}
let generation=0;async function refresh(){const g=++generation;const p='latitude='+spot.beachReference.lat+'&longitude='+spot.beachReference.lon+'&timezone=Asia%2FTokyo&forecast_days=10';const [m,w]=await Promise.allSettled([get('https://marine-api.open-meteo.com/v1/marine?'+p+'&hourly=wave_height,wave_period,wave_direction'),get('https://api.open-meteo.com/v1/forecast?'+p+'&wind_speed_unit=ms&hourly=wind_speed_10m,wind_direction_10m,weather_code')]);if(g!==generation)return;const a=m.status==='fulfilled'&&m.value.timezone==='Asia/Tokyo'?m.value.hourly:null,b=w.status==='fulfilled'&&w.value.timezone==='Asia/Tokyo'?w.value.hourly:null;const mi=new Map((a?.time||[]).map((v,i)=>[v,i])),wi=new Map((b?.time||[]).map((v,i)=>[v,i]));const at=(o,f,i)=>n(o?.[f]?.[i]);const k=now(),i=mi.get(k),j=wi.get(k);set('waveVal',fmt(at(a,'wave_height',i))+' m');set('periodVal',fmt(at(a,'wave_period',i))+' 秒');set('windVal',fmt(at(b,'wind_speed_10m',j))+' m/s '+direction(at(b,'wind_direction_10m',j)));set('swellVal',direction(at(a,'wave_direction',i)));set('lastUpdate',a||b?new Date().toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'}):'取得不可');const body=$('ks10-body');const rows=await Promise.all(Array.from({length:10},async(_,d)=>{const date=jst(d),keys=Array.from({length:13},(_,i)=>date+'T'+String(i+5).padStart(2,'0')+':00');const waves=keys.map(k=>at(a,'wave_height',mi.get(k))).filter(v=>v!==null),winds=keys.map(k=>at(b,'wind_speed_10m',wi.get(k))).filter(v=>v!==null),dirs=keys.map(k=>at(b,'wind_direction_10m',wi.get(k))).filter(v=>v!==null);const counts=new Map();for(const v of dirs){const q=direction(v);counts.set(q,(counts.get(q)||0)+1);}const wd=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';const lo=waves.length?Math.min(...waves):null,hi=waves.length?Math.max(...waves):null,avg=winds.length?winds.reduce((x,y)=>x+y,0)/winds.length:null;const verdict=dailyJudgment(keys,a,b,mi,wi,at);const row=make('tr');const append=(el)=>{const c=make('td');c.append(el);row.append(c);};append(make('span',date.slice(5).replace('-','/'),'ks10-date'));append(make('span',icon(at(b,'weather_code',wi.get(date+'T09:00'))),'ks10-weather'));append(track(lo===null?'—':fmt(lo)+'〜'+fmt(hi),hi===null?0:hi/3*100,'wave'));append(track(fmt(avg),avg===null?0:avg/12*100,'wind'));append(make('span',wd,'ks10-dir'));if(verdict){const label=make('span',null,'ks10-judgment ks10-'+verdict.result.action);label.append(make('span',verdict.result.emoji+' '+verdict.result.text,'ks10-judgment-main'),make('span',verdict.stars,'ks10-judgment-stars'));append(label);}else append(make('span','—'));return row;}));if(g!==generation)return;body.replaceChildren(...rows);set('ks10-updated',a||b?'取得時刻：'+new Date().toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+' JST':'取得不可');}
$('refreshBtn').addEventListener('click',()=>{frame.src=frame.src.split('&_refresh=')[0]+'&_refresh='+Date.now();refresh();});refresh();setInterval(refresh,900000);
})();