
// ===========================================================
// 波報 NAMI REPORT - Common JS repaired v1007
// 下層ページAPI / 仲間の波レポート / 明日予想 / ハンバーガー
// ===========================================================
(function(){
  'use strict';

  const DIRS_JP_COMMON = ['北','北北東','北東','東北東','東','東南東','南東','南南東','南','南南西','南西','西南西','西','西北西','北西','北北西'];
  const JP_DAYS_COMMON = ['日','月','火','水','木','金','土'];
  let commonLastFetchTime = 0;

  function getSpotConfig(){
    try { if (typeof SPOT_CONFIG !== 'undefined') return SPOT_CONFIG; } catch(e) {}
    return null;
  }
  function byId(id){ return document.getElementById(id); }
  function setHTML(id, html){ const el = byId(id); if (el) el.innerHTML = html; }
  function setText(id, text){ const el = byId(id); if (el) el.textContent = text; }
  function degToDirJp(deg) { if (deg == null || isNaN(deg)) return '--'; return DIRS_JP_COMMON[Math.round(deg / 22.5) % 16]; }
  function windArrowRotation(deg) { if (deg == null || isNaN(deg)) return 0; return (deg + 180) % 360; }
  function safeNum(v, fb = null) { return (v == null || isNaN(v)) ? fb : Number(v); }
  function formatTime(d) { return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }); }
  function findCurrentHourIdx(times) {
    const now = new Date(); let idx = 0;
    for (let i = 0; i < times.length; i++) { if (new Date(times[i]) <= now) idx = i; else break; }
    return idx;
  }
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
  function waveJpLabel(h) {
    if (h == null) return '--';
    if (h < 0.3) return 'フラット'; if (h < 0.8) return '膝サイズ'; if (h < 1.1) return '腰サイズ'; if (h < 1.4) return '腹サイズ'; if (h < 1.7) return '胸サイズ'; if (h < 2.1) return '肩サイズ'; return '頭サイズ';
  }

  function getSpotKeyFromConfig(){
    const cfg = getSpotConfig();
    if (cfg && cfg.KEY) return cfg.KEY;
    const name = (location.pathname.split('/').pop() || '').replace(/\.html?$/,'');
    const map = {
      isonoura: 'isonoura', kounohama: 'kounohama', ikumi: 'ikumi', komatsu: 'komatsu',
      irago: 'irago', shizunami: 'shizunami', hamadutu: 'hamadutu', takahama: 'takahama', hakuto: 'hakuto'
    };
    return map[name] || null;
  }

  async function fetchData() {
    const cfg = getSpotConfig(); if (!cfg) return;
    const spotKey = getSpotKeyFromConfig(); if (!spotKey) return;
    const updateEl = byId('updateInfo'); if (updateEl) updateEl.classList.add('syncing');
    setHTML('lastUpdate', '<i class="fa-solid fa-spinner fa-spin"></i>');
    commonLastFetchTime = Date.now();
    try {
      const res = await fetch(`data/spot_${spotKey}.json?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('JSON HTTP ' + res.status);
      const data = await res.json();
      if (!data || !data.marine || !data.weather) throw new Error('invalid spot json');
      renderEverything(data.marine, data.weather);
      if (data.updated_at) setText('lastUpdate', formatTime(new Date(data.updated_at.replace(' ', 'T'))));
      else setText('lastUpdate', formatTime(new Date()));
    } catch (err) {
      console.error('Fetch error:', err);
      setText('lastUpdate', '前回データなし'); setHTML('verdictText', '⚠️ データ取得失敗');
    } finally { if (updateEl) setTimeout(() => updateEl.classList.remove('syncing'), 600); }
  }

  function renderEverything(marine, weather) {
    if (!marine || !weather || !marine.hourly || !weather.hourly) throw new Error('invalid API data');
    const cfg = getSpotConfig(); const mIdx = findCurrentHourIdx(marine.hourly.time);
    let waveH = safeNum(marine.hourly.wave_height[mIdx]);
    const waveP = safeNum(marine.hourly.wave_period[mIdx]);
    const swellH = safeNum(marine.hourly.swell_wave_height?.[mIdx]);
    const swellD = safeNum(marine.hourly.swell_wave_direction?.[mIdx]);
    const WAVE_FACTOR = cfg && cfg.WAVE_FACTOR ? cfg.WAVE_FACTOR : 1.0;
    if (waveH != null) waveH = waveH * WAVE_FACTOR;
    const correctedHourlyWave = (marine.hourly.wave_height || []).map(v => v != null ? v * WAVE_FACTOR : v);
    marine._correctedWaveHeight = correctedHourlyWave;
    const w = weather.current || {};
    const windSpeed = safeNum(w.wind_speed_10m); const windDir = safeNum(w.wind_direction_10m);
    setHTML('waveVal', waveH != null ? `${waveH.toFixed(1)}<span class="unit">m</span>` : '--');
    setHTML('periodVal', waveP != null ? `${waveP.toFixed(0)}<span class="unit">秒</span>` : '--');
    if (windDir != null && windSpeed != null) {
      const rot = windArrowRotation(windDir);
      setHTML('windVal', `<i class="fa-solid fa-location-arrow wind-arrow" style="transform: rotate(${rot - 45}deg);"></i>${degToDirJp(windDir)}<span class="unit"> ${windSpeed.toFixed(1)}m/s</span>`);
    } else setText('windVal', '--');
    if (swellH != null && swellD != null) setHTML('swellVal', `${degToDirJp(swellD)}<span class="unit"> ${swellH.toFixed(1)}m</span>`); else setText('swellVal', '--');
    const score = calcScore(waveH, waveP, windSpeed, windDir, swellD);
    const verdict = getVerdict(score, waveH); const stars = scoreToStars(score);
    setText('scoreNum', score.toFixed(1)); setHTML('verdictText', `<span class="emoji">${verdict.emoji}</span>${verdict.text}`); setText('verdictStars', stars);
    let bestScore = 0, bestIdx = mIdx; const corrWave = marine._correctedWaveHeight || marine.hourly.wave_height;
    for (let i = mIdx; i < Math.min(mIdx + 24, marine.hourly.time.length); i++) {
      const s = calcScore(safeNum(corrWave[i]), safeNum(marine.hourly.wave_period[i]), safeNum(weather.hourly.wind_speed_10m[i]), safeNum(weather.hourly.wind_direction_10m[i]), safeNum(marine.hourly.swell_wave_direction?.[i]));
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    }
    const bestTime = new Date(marine.hourly.time[bestIdx]); setText('bestTime', `${bestTime.getHours()}時 (${bestScore.toFixed(1)}点)`);
    renderHourly(marine, weather, mIdx, bestIdx); renderWeekly(marine, weather); renderTodayTip(waveH, waveP, windSpeed, windDir, bestTime, bestScore);
  }

  function renderHourly(marine, weather, mIdx, bestIdx) {
    const svg = byId('hourlySvg'); const rowsEl = byId('hourlyRows'); if (!svg || !rowsEl) return;
    svg.setAttribute('viewBox', '0 0 1200 280');
    svg.style.height = '280px';
    const times = marine.hourly.time, waveH = marine._correctedWaveHeight || marine.hourly.wave_height, waveP = marine.hourly.wave_period, windS = weather.hourly.wind_speed_10m, windD = weather.hourly.wind_direction_10m, swellD = marine.hourly.swell_wave_direction || [], weatherCode = weather.hourly.weather_code || [];
    function wmoIcon(code){ if(code==null)return''; if(code===0)return'☀️'; if(code<=3)return'⛅'; if(code<=48)return'🌫️'; if(code<=57)return'🌦️'; if(code<=67)return'🌧️'; if(code<=77)return'❄️'; if(code<=82)return'🌧️'; if(code<=86)return'❄️'; if(code>=95)return'⛈️'; return'☁️'; }
    const indices=[]; for(let i=0;i<12;i++){ const idx=mIdx+i*2; if(idx<times.length) indices.push(idx); }
    const validHeights = indices.map(i => safeNum(waveH[i], 0)); const maxH = Math.max(...validHeights, 0.5) * 1.2;
    const validWinds = indices.map(i => safeNum(windS[i], 0)); const maxW = Math.max(...validWinds, 1) * 1.3;
    const points = indices.map((idx, i)=>({x:(i/Math.max(1,indices.length-1))*1200, y:160-(safeNum(waveH[idx],0)/maxH)*130}));
    const pathD = points.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' '); const areaD = pathD + ` L1200,170 L0,170 Z`;
    let svgContent = `<defs><linearGradient id="hGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e55234" stop-opacity="0.3"/><stop offset="100%" stop-color="#2d6470" stop-opacity="0.03"/></linearGradient></defs><line x1="0" y1="50" x2="1200" y2="50" stroke="rgba(242,234,217,0.06)"/><line x1="0" y1="100" x2="1200" y2="100" stroke="rgba(242,234,217,0.08)"/><line x1="0" y1="150" x2="1200" y2="150" stroke="rgba(242,234,217,0.06)"/>`;
    // Wind speed bars
    const barTop = 190, barBot = 270;
    svgContent += `<line x1="0" y1="175" x2="1200" y2="175" stroke="rgba(242,234,217,0.1)"/>`;
    indices.forEach((idx, i) => {
      const ws = safeNum(windS[idx], 0);
      const x = (i / Math.max(1, indices.length - 1)) * 1200;
      const barH = (ws / maxW) * (barBot - barTop);
      const barY = barBot - barH;
      const barW = 1200 / indices.length * 0.55;
      const bx = x - barW / 2;
      const alpha = 0.7;
      svgContent += `<rect x="${bx.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="2" fill="rgba(45,100,112,${alpha})"/>`;
    });
    svgContent += `<path d="${areaD}" fill="url(#hGrad)"/><path d="${pathD}" fill="none" stroke="#e55234" stroke-width="2"/>`;
    points.forEach(p => { svgContent += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#e55234"/>`; });
    if(points.length) svgContent += `<line x1="${points[0].x}" y1="0" x2="${points[0].x}" y2="280" stroke="#f2ead9" stroke-dasharray="3,4" opacity="0.7"/><circle cx="${points[0].x}" cy="${points[0].y}" r="5" fill="#f2ead9" stroke="#0b1d2a" stroke-width="2"/>`;
    svgContent += `<rect x="0" y="6" width="10" height="10" rx="2" fill="#e55234"/><text x="15" y="15" font-size="11" fill="#88b1b6" font-family="Noto Sans JP,sans-serif">波高 (m)</text>`;
    svgContent += `<rect x="90" y="6" width="10" height="10" rx="2" fill="rgba(45,100,112,0.7)"/><text x="105" y="15" font-size="11" fill="#88b1b6" font-family="Noto Sans JP,sans-serif">風 (m/s)</text>`;
    svg.innerHTML = svgContent;
    let html = '<div class="hrow-label"><i class="fa-regular fa-clock"></i>時刻</div>';
    indices.forEach((idx,i)=>{ const t=new Date(times[idx]); const hr=String(t.getHours()).padStart(2,'0'); const cls=i===0?'now':(idx===bestIdx||(idx+1===bestIdx))?'best':''; html += `<div class="hrow-cell ${cls}">${hr}時</div>`; });
    html += '<div class="hrow-label"><i class="fa-solid fa-cloud-sun"></i>天気</div>'; indices.forEach((idx,i)=>{html += `<div class="hrow-cell ${i===0?'now':''}" style="font-size:1.3rem;">${wmoIcon(weatherCode[idx])}</div>`;});
    html += '<div class="hrow-label"><i class="fa-solid fa-water"></i>波の高さ</div>'; indices.forEach((idx,i)=>{ const v=safeNum(waveH[idx]); html += `<div class="hrow-cell ${i===0?'now':''}">${v!=null?v.toFixed(1):'--'}<span class="sub">m</span></div>`; });
    html += '<div class="hrow-label"><i class="fa-solid fa-stopwatch"></i>周期</div>'; indices.forEach((idx,i)=>{ const v=safeNum(waveP[idx]); html += `<div class="hrow-cell ${i===0?'now':''}">${v!=null?v.toFixed(0):'--'}<span class="sub">秒</span></div>`; });
    html += '<div class="hrow-label"><i class="fa-solid fa-wind"></i>風</div>'; indices.forEach((idx,i)=>{ const d=safeNum(windD[idx]), s=safeNum(windS[idx]); if(d==null||s==null) html += `<div class="hrow-cell ${i===0?'now':''}">--</div>`; else { const rot=windArrowRotation(d); html += `<div class="hrow-cell ${i===0?'now':''}"><i class="fa-solid fa-location-arrow arr" style="transform:rotate(${rot-45}deg);"></i><span class="sub">${degToDirJp(d)} ${s.toFixed(0)}</span></div>`; }});
    html += '<div class="hrow-label"><i class="fa-solid fa-star"></i>評価</div>'; indices.forEach((idx,i)=>{ const sc=calcScore(safeNum(waveH[idx]),safeNum(waveP[idx]),safeNum(windS[idx]),safeNum(windD[idx]),safeNum(swellD[idx])); const cls=i===0?'now':(idx===bestIdx||idx+1===bestIdx)?'best':''; let stars=1; if(sc>=2.5)stars=2; if(sc>=4.0)stars=3; html += `<div class="hrow-cell ${cls}" style="font-family:'Fraunces',serif;color:var(--coral);letter-spacing:1px;">${'★'.repeat(stars)}<span style="color:rgba(136,177,182,0.4);">${'☆'.repeat(3-stars)}</span></div>`; });
    rowsEl.innerHTML = html;
  }
  function wmoIcon(code){ if(code==null)return''; if(code===0)return'☀️'; if(code<=3)return'⛅'; if(code<=48)return'🌫️'; if(code<=57)return'🌦️'; if(code<=67)return'🌧️'; if(code<=77)return'❄️'; if(code<=82)return'🌧️'; if(code<=86)return'❄️'; if(code>=95)return'⛈️'; return'☁️'; }
  function renderWeekly(marine, weather) {
    const tbody = byId('weeklyBody'); if(!tbody) return; const dm=marine.daily||{}, dw=weather.daily||{};
    if(!dm.time||!dw.time){ tbody.innerHTML='<tr><td colspan="6" style="text-align:center;">データ取得エラー</td></tr>'; return; }
    const cfg = getSpotConfig();
    let html='';
    const hideLabel = cfg && cfg.HIDE_WAVE_LABEL;
    for(let i=0;i<dm.time.length;i++){
      const date=new Date(dm.time[i]); const dayJp=JP_DAYS_COMMON[date.getDay()]; const ds=`${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`;
      const waveMax=safeNum(dm.wave_height_max?.[i]); const periodMax=safeNum(dm.wave_period_max?.[i]); const waveDirDom=safeNum(dm.wave_direction_dominant?.[i]); const tempMax=safeNum(dw.temperature_2m_max?.[i]); const tempMin=safeNum(dw.temperature_2m_min?.[i]); const windMax=safeNum(dw.wind_speed_10m_max?.[i]); const windDir=safeNum(dw.wind_direction_10m_dominant?.[i]); const wxCode=dw.weather_code?.[i]??null;
      const score=calcScore(waveMax, periodMax, windMax!=null?windMax*0.6:null, windDir, waveDirDom); const verdict=getVerdict(score,waveMax); const stars=scoreToStars(score); const windRot=windDir!=null?windArrowRotation(windDir):0;
      html += `<tr><td class="day">${dayJp} <span class="num">${ds}</span></td><td style="font-size:1.3rem;">${wmoIcon(wxCode)}</td><td>${waveMax!=null?waveMax.toFixed(1)+' m':'--'}${!hideLabel&&waveMax!=null?' <span style="color:var(--teal-pale);font-size:0.75rem;">（'+waveJpLabel(waveMax)+'）</span>':''}</td><td>${periodMax!=null?periodMax.toFixed(0)+' 秒':'--'}</td><td>${windDir!=null&&windMax!=null?`<i class="fa-solid fa-location-arrow wind-arrow" style="transform:rotate(${windRot-45}deg);font-size:0.75rem;"></i> ${degToDirJp(windDir)} ${windMax.toFixed(0)}m/s`:'--'}</td><td>${tempMin!=null&&tempMax!=null?`${tempMin.toFixed(0)}–${tempMax.toFixed(0)}°`:'--'}</td><td class="action-cell ${verdict.action}">${verdict.emoji} ${verdict.text}<span class="stars-mini">${stars}</span></td></tr>`;
    }
    tbody.innerHTML=html;
  }
  function renderTodayTip(waveH, waveP, windSpeed, windDir, bestTime, bestScore) {
    const tipEl=byId('todayTip'); if(!tipEl) return; const cfg=getSpotConfig();
    try{
      const offshore=isOffshore(windDir), onshore=isOnshore(windDir), ws_=windSpeed!=null?windSpeed:0;
      const fmt=s=>!s?'':s.replace('{wave}',waveH!=null?waveH.toFixed(1):'--').replace('{p}',waveP!=null?waveP.toFixed(0):'--').replace('{ws}',windSpeed!=null?windSpeed.toFixed(1):'--').replace('{dir}',degToDirJp(windDir)).replace('{label}',waveJpLabel(waveH)).replace('{condText}',ws_<2?'無風で面ツル':offshore?'オフショアで面良好':'やや海面あり');
      let tip='';
      if(waveH==null||windDir==null) tip='<strong>データ取得中</strong>。少し時間をおいて更新ボタンを押してください。';
      else if(waveH<0.3) tip=fmt(cfg?.TIP_FLAT)||`<strong>うねり弱め</strong>（${waveH.toFixed(1)}m）。今日は静かな海。`;
      else if(ws_>7&&onshore) tip=fmt(cfg?.TIP_BLOWN)||`<strong>${degToDirJp(windDir)}のオンショア${ws_.toFixed(1)}m/s</strong>。海面ガタガタ。`;
      else if((ws_<2||offshore)&&waveH>=0.5&&waveP!=null&&waveP>=8) tip=fmt(cfg?.TIP_PERFECT)||`<strong>良いコンディション</strong>。今が狙い目。`;
      else if(waveH>=1.5) tip=fmt(cfg?.TIP_BIG)||`<strong>サイズアップ中</strong>（${waveH.toFixed(1)}m／${waveJpLabel(waveH)}）。`;
      else tip=fmt(cfg?.TIP_NORMAL)||`${waveJpLabel(waveH)}サイズ。普通のコンディション。`;
      if(bestTime&&bestScore>=4){ const nowHr=new Date().getHours(), bestHr=bestTime.getHours(); if(Math.abs(bestHr-nowHr)>=2) tip += `<br><br>⏰ <strong>今日のベスト時間は${bestHr}時</strong>（${bestScore.toFixed(1)}点）。`; }
      tipEl.innerHTML=tip; const tipEl2=byId('todayTip2'); if(tipEl2) tipEl2.innerHTML=tip;
    }catch(err){ console.error('renderTodayTip error:',err); tipEl.innerHTML='<strong>表示エラー</strong>: ブラウザコンソールを確認してください。'; }
  }

  const REPORT_SHEET_ID = '1L1M8xtRrEcSBgSMi8Ur7hGhaY-XkBpkn-JbzMub7p8c';
  const REPORT_PUB_ID = '2PACX-1vTRtB4nrSpxJlCstzit_zsA-gF6DwPMEw6nB5HRVUmQCihtAMOw-LRNwQPD9Bwf15HPv9p33zCHECAM';
  const REPORT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfAmm8fnBijHPirsskA6VV43-6c4cjEby2yRT4TGlm0RBNOVQ/viewform?usp=dialog';
  const MAX_REPORTS = 5;

  function parseCSV(csv){
    const rows=[]; let row=[], cur='', inQuote=false;
    for(let i=0;i<csv.length;i++){
      const ch=csv[i], next=csv[i+1];
      if(ch==='"'){
        if(inQuote && next==='"'){ cur+='"'; i++; }
        else inQuote=!inQuote;
      } else if(ch===',' && !inQuote){ row.push(cur); cur=''; }
      else if((ch==='\n' || ch==='\r') && !inQuote){
        if(ch==='\r' && next==='\n') i++;
        row.push(cur); if(row.some(c=>String(c).trim()!=='')) rows.push(row); row=[]; cur='';
      } else cur += ch;
    }
    if(cur!=='' || row.length){ row.push(cur); if(row.some(c=>String(c).trim()!=='')) rows.push(row); }
    return rows;
  }
  async function fetchCsvCandidates(candidates){
    let lastErr=null;
    for(const url of candidates){
      try{ const res=await fetch(url,{cache:'no-store'}); if(!res.ok) throw new Error('HTTP '+res.status); const text=await res.text(); if(text && !/^\s*<!doctype html/i.test(text)) return text; }
      catch(e){ lastErr=e; console.warn('CSV fetch failed:', url, e); }
    }
    throw lastErr || new Error('CSV fetch failed');
  }
  function esc(s){ return String(s ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
  function formatReportTime(timestamp){
    let timeStr=timestamp||'';
    try{
      const d=new Date(timestamp); if(!isNaN(d)){ timeStr=(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
    }catch(e){}
    return timeStr;
  }
  async function fetchReportRows() {
    const candidates = [
      // 現在の波レポート投稿フォーム回答タブ（新規投稿が入っているタブ）
      `https://docs.google.com/spreadsheets/d/${REPORT_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Form Responses 4')}&_=${Date.now()}`,
      // 旧タブ fallback（過去データ用）
      `https://docs.google.com/spreadsheets/d/${REPORT_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Form Responses 1')}&_=${Date.now()}`,
      // 以前の手動リネームタブ fallback
      `https://docs.google.com/spreadsheets/d/${REPORT_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Form_Responses')}&_=${Date.now()}`,
      // 旧 gid fallback
      `https://docs.google.com/spreadsheets/d/${REPORT_SHEET_ID}/gviz/tq?tqx=out:csv&gid=800417609&_=${Date.now()}`,
      // 公開CSV版 fallback
      `https://docs.google.com/spreadsheets/d/e/${REPORT_PUB_ID}/pub?gid=800417609&single=true&output=csv&_=${Date.now()}`,
      `https://docs.google.com/spreadsheets/d/e/${REPORT_PUB_ID}/pub?gid=0&single=true&output=csv&_=${Date.now()}`
    ];

    let lastError = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (!text || /^\s*<!doctype html/i.test(text)) throw new Error('HTML returned');
        const rows = parseCSV(text);
        const header = (rows[0] || []).join('|');
        // Google側のエラーメッセージや空CSVを「成功扱い」しない
        if (rows.length > 1 && /Timestamp|タイムスタンプ|ポイント名/.test(header)) {
          console.log('Wave reports CSV loaded:', url);
          return rows;
        }
        lastError = new Error('Invalid CSV or no rows: ' + url);
        console.warn(lastError.message, rows.slice(0, 2));
      } catch (e) {
        lastError = e;
        console.warn('Wave reports CSV candidate failed:', url, e);
      }
    }
    throw lastError || new Error('Wave reports CSV fetch failed');
  }

  function loadWaveReports(spotName) {
    const container = byId('waveReports'); if(!container) return;
    fetchReportRows().then(rows => {
      const dataLines=rows.slice(1).reverse(); const filtered=[];
      for(const cols of dataLines){
        const sheetSpot = String(cols[1] || '').trim();
        if(sheetSpot === spotName){ filtered.push(cols); if(filtered.length>=MAX_REPORTS) break; }
      }
      if(filtered.length===0){
        console.warn('No wave reports matched spot:', spotName, rows.slice(0, 5));
        container.innerHTML='<div style="text-align:center;padding:40px;color:var(--teal-pale);border:1px solid var(--line);"><i class="fa-solid fa-comment-slash" style="font-size:2rem;margin-bottom:12px;display:block;"></i>まだ投稿がありません。最初のレポートを投稿してみよう！</div>'; return;
      }
      function badge(txt,type){ const bg=type==='wave'?'rgba(45,100,112,0.25)':type==='wind'?'rgba(229,82,52,0.15)':'rgba(107,193,120,0.15)'; const cl=type==='wave'?'var(--teal-pale)':type==='wind'?'var(--coral)':'var(--ok)'; return '<span style="display:inline-block;padding:3px 10px;font-size:0.78rem;background:'+bg+';color:'+cl+';border:1px solid '+cl+';margin-right:6px;margin-bottom:4px;">'+esc(txt)+'</span>'; }
      const cards=filtered.map(cols=>{
        const timestamp=cols[0]||'', user=cols[2]||'匿名', wave=cols[3]||'', wind=cols[4]||'', rating=cols[5]||'', comment=cols[6]||'';
        if(!comment && !wave) return '';
        const timeStr=formatReportTime(timestamp);
        return '<div style="background:var(--ink);border:1px solid var(--line);padding:20px 22px;transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'var(--coral)\'" onmouseout="this.style.borderColor=\'var(--line)\'">'+
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-wrap:wrap;gap:8px;">'+
          '<div style="font-family:Shippori Mincho B1,serif;font-weight:700;font-size:1.05rem;">🏄 '+esc(user)+'</div>'+
          '<div style="font-family:JetBrains Mono,monospace;font-size:0.68rem;color:var(--teal-pale);">'+esc(timeStr)+'</div></div>'+
          '<div style="margin-bottom:10px;">'+(wave?badge('🌊 '+wave,'wave'):'')+(wind?badge('💨 '+wind,'wind'):'')+(rating?badge('⭐ '+rating,'star'):'')+'</div>'+
          (comment?'<div style="font-size:0.95rem;line-height:1.8;color:var(--cream-soft);padding-top:10px;border-top:1px dashed var(--line);">'+esc(comment)+'</div>':'')+'</div>';
      }).filter(Boolean);
      container.innerHTML=cards.length?cards.join(''):'<div style="text-align:center;padding:40px;color:var(--teal-pale);">表示できる投稿がありません</div>';
    }).catch(err=>{ console.error('Wave report fetch error:', err); container.innerHTML='<div style="text-align:center;padding:40px;color:var(--teal-pale);">通信エラーが発生しました</div>'; });
  }

  function loadTomorrowForecast() {
    const container=byId('tomorrowForecast'); if(!container) return;
    const encodedSheet=encodeURIComponent('明日予想');
    const custom = window.TOMORROW_FORECAST_CSV_URL;
    const urls=[]; if(custom) urls.push(custom);
    urls.push(`https://docs.google.com/spreadsheets/d/${REPORT_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}&_=${Date.now()}`);
    urls.push(`https://docs.google.com/spreadsheets/d/e/${REPORT_PUB_ID}/pub?gid=1253938492&single=true&output=csv&_=${Date.now()}`);
    fetchCsvCandidates(urls).then(csv=>{
      const rows=parseCSV(csv); if(rows.length<=1){ container.innerHTML='<div style="text-align:center;padding:30px;color:var(--teal-pale);">予想データなし</div>'; return; }
      const onItems=[];
      for(const cols of rows.slice(1)){
        if((cols[7]||'').trim()==='ON') onItems.push({order:parseInt(cols[0])||99, spot:cols[1]||'', wave:cols[2]||'', wind:cols[3]||'', rating:cols[4]||'', comment:cols[5]||'', datetime:cols[6]||''});
      }
      onItems.sort((a,b)=>a.order-b.order);
      if(!onItems.length){ container.innerHTML='<div style="text-align:center;padding:30px;color:var(--teal-pale);">現在、明日の予想はありません</div>'; return; }
      const ratingEmoji={'最高':'🔥','良い':'✨','まあまあ':'👍','イマイチ':'🤔','ダメ':'😴'};
      container.innerHTML = onItems.map(item=>{ const emoji=ratingEmoji[item.rating]||'🌊'; return '<div style="display:flex;align-items:flex-start;gap:14px;padding:16px 18px;background:rgba(11,29,42,0.5);border:1px solid var(--line);transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'var(--coral)\'" onmouseout="this.style.borderColor=\'var(--line)\'">'+
        '<div style="font-size:1.6rem;flex-shrink:0;">'+emoji+'</div><div style="flex:1;">'+
        '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px;"><span style="font-family:Shippori Mincho B1,serif;font-weight:700;font-size:1.05rem;">'+esc(item.spot)+'</span>'+(item.datetime?'<span style="font-family:JetBrains Mono,monospace;font-size:0.68rem;color:var(--teal-pale);">'+esc(item.datetime)+'</span>':'')+'</div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">'+(item.wave?'<span style="padding:2px 8px;font-size:0.72rem;background:rgba(45,100,112,0.2);color:var(--teal-pale);border:1px solid var(--teal-pale);">🌊 '+esc(item.wave)+'</span>':'')+(item.wind?'<span style="padding:2px 8px;font-size:0.72rem;background:rgba(229,82,52,0.1);color:var(--coral);border:1px solid var(--coral);">💨 '+esc(item.wind)+'</span>':'')+'<span style="padding:2px 8px;font-size:0.72rem;background:rgba(107,193,120,0.1);color:var(--ok);border:1px solid var(--ok);">⭐ '+esc(item.rating)+'</span></div>'+
        (item.comment?'<div style="font-size:0.85rem;color:var(--cream-soft);line-height:1.7;">'+esc(item.comment)+'</div>':'')+'</div></div>'; }).join('');
    }).catch(err=>{ console.error('Tomorrow forecast fetch error:',err); container.innerHTML='<div style="text-align:center;padding:30px;color:var(--teal-pale);">予想データの読み込みに失敗</div>'; });
  }

  function setupCommonUI(){
    const refreshBtn=byId('refreshBtn'); if(refreshBtn && !refreshBtn.dataset.namiBound){ refreshBtn.dataset.namiBound='1'; refreshBtn.addEventListener('click', fetchData); }
    if(!window.__namiHamburgerBound){
      const hamburger=byId('hamburger'), mobileMenu=byId('mobileMenu');
      if(hamburger && mobileMenu){ hamburger.addEventListener('click',()=>{ hamburger.classList.toggle('active'); mobileMenu.classList.toggle('open'); }); window.__namiHamburgerBound=true; }
    }
    function updateClock(){ const now=new Date(); const h=String(now.getHours()).padStart(2,'0'); const m=String(now.getMinutes()).padStart(2,'0'); const el=byId('clockTag'); if(el) el.innerHTML=`<span class="dot"></span>LIVE ${h}:${m} JST`; }
    updateClock(); setInterval(updateClock, 30000);
  }
  setupCommonUI();
  window.NAMI_REPORT_FORM_URL = REPORT_FORM_URL;
  window.loadWaveReports = loadWaveReports;
  window.loadTomorrowForecast = loadTomorrowForecast;
  window.fetchWaveSpotData = fetchData;

  if(getSpotConfig()){
    fetchData();
    const cfg=getSpotConfig(); setInterval(fetchData, cfg.REFRESH_INTERVAL_MS || 60*60*1000);
    window.addEventListener('pageshow', function(event){ if(event.persisted || Date.now()-commonLastFetchTime>30*1000) fetchData(); });
    document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible' && Date.now()-commonLastFetchTime>60*1000) fetchData(); });
    window.addEventListener('focus', function(){ if(Date.now()-commonLastFetchTime>60*1000) fetchData(); });
  }

  // Google Analytics 4
  (function() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-YVG6H5HXMJ';
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', 'G-YVG6H5HXMJ');
  })();

})();
