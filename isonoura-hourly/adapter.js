/* Isonoura-only bridge to the exact Kanto Surfer KS compact UI at dfce290.
   Do not import Kugenuma coordinates, D8 tides or its ranking/score logic. */
(async function () {
  "use strict";
  const root = document.querySelector("[data-forecast]");
  const state = root?.querySelector("[data-state]");
  if (!root) return;
  const modelURL = "../data/spot_isonoura.json?hourly_view=" + Date.now();
  const forecastCoords = Object.freeze({latitude: 34.18, longitude: 135.05});
  const nullNum = v => typeof v === "number" && Number.isFinite(v) ? v : null;
  const timeKey = value => typeof value === "string" ? value.slice(0,16) : "";
  const dateJst = (delta = 0) => {
    const j = new Date(Date.now() + 9 * 3600000 + delta*86400000);
    return j.toISOString().slice(0,10);
  };
  const weatherLabel = code => {
    if (code === null) return "";
    if (code <= 1) return "晴";
    if (code === 2) return "晴れ時々曇り";
    if (code === 3) return "曇り";
    if (code <= 48) return "霧";
    if (code <= 57) return "小雨";
    if (code <= 67) return "雨";
    if (code <= 77) return "雪";
    if (code <= 82) return "雨";
    if (code <= 86) return "雪";
    if (code >= 95) return "雷雨";
    return "";
  };
  const dirs16 = ["北","北北東","北東","東北東","東","東南東","南東","南南東","南","南南西","南西","西南西","西","西北西","北西","北北西"];
  const direction = degrees => degrees === null ? null : dirs16[Math.round(((degrees % 360)+360)%360/22.5)%16];
  const findIndex = obj => new Map(Array.isArray(obj?.hourly?.time) ? obj.hourly.time.map((time,i)=>[timeKey(time),i]) : []);
  const take = (obj, prop, idx) => idx !== undefined && Array.isArray(obj?.hourly?.[prop]) ? nullNum(obj.hourly[prop][idx]) : null;
  const fromSource = (source, precipitation) => {
    if (!source?.marine?.hourly?.time || !source?.weather?.hourly?.time) throw new Error("KS forecast JSON missing marine/weather hourly");
    const marine = source.marine, weather = source.weather;
    const wIndex = findIndex(weather), pIndex = findIndex(precipitation);
    const hourly = marine.hourly.time.map((time,mi) => {
      const key=timeKey(time), wi=wIndex.get(key),pi=pIndex.get(key);
      const dir=take(weather,"wind_direction_10m",wi), code=take(weather,"weather_code",wi);
      const beach=window.ksIsonouraBeachWave.estimate(marine.hourly,mi);
      // Open-Meteo times are explicitly JST; do not interpret them as UTC.
      return {
        time:key+":00+09:00",
        wave_height_m:beach.height,
        period_s:beach.period,
        wind_speed_ms:take(weather,"wind_speed_10m",wi),
        wind_direction_label:direction(dir),
        weather_label:weatherLabel(code),
        temperature_c:take(weather,"temperature_2m",wi),
        precipitation_1h_mm:take(precipitation,"precipitation",pi),
        precipitation_probability_pct:take(precipitation,"precipitation_probability",pi)
      };
    });
    return {
      status:"model_only",
      spot:{name:"磯ノ浦",id:"isonoura"},
      wave_metric_label:"ビーチ波高・推定",
      model_notice:"Open-Meteoの波向・うねりからビーチ波高を推定しています。波高の目盛りは今日・明日・明後日で共通です。",
      updated_at:source.updated_at || null,
      hourly,
      tide:{station:"和歌山",station_id:"WY",datum:"気象庁潮位表基準面",unit:"cm",days:[]}
    };
  };
  async function fetchJSON(url,ms=12000) {
    const abort=new AbortController(), id=setTimeout(()=>abort.abort(),ms);
    try {
      const res=await fetch(url,{cache:"no-store",signal:abort.signal});
      if (!res.ok) throw new Error(url+" : HTTP "+res.status);
      return await res.json();
    } finally {clearTimeout(id);}
  }
  async function rainData() {
    const params = new URLSearchParams({
      latitude:String(forecastCoords.latitude),longitude:String(forecastCoords.longitude),
      hourly:"precipitation,precipitation_probability",
      timezone:"Asia/Tokyo",forecast_days:"4"
    });
    const json = await fetchJSON("https://api.open-meteo.com/v1/forecast?"+params.toString());
    const raw = json?.hourly;
    if(!Array.isArray(raw?.time))throw new Error("Rain data missing time axis");
    // Accept values only when source matches intended model location (nearest grid may differ).
    const lat=nullNum(json.latitude),lng=nullNum(json.longitude);
    if(lat===null||lng===null||Math.abs(lat-forecastCoords.latitude)>0.2||Math.abs(lng-forecastCoords.longitude)>0.2)
      throw new Error("Rain model returned unexpected geographic region");
    return json;
  }
  async function loadWakayama() {
    const years=[...new Set([0,1,2].map(offset=>dateJst(offset).slice(0,4)))];
    const results=await Promise.all(years.map(async year=>{
      if(!["2026","2027"].includes(year))return [];
      const raw=await fetchJSON("./data/WY-"+year+".json",12000);
      if(raw.station_id!=="WY"||raw.unit!=="cm"||raw.datum!=="気象庁潮位表基準面"||raw.observation!==false||!Array.isArray(raw.days))throw new Error("Tide station provenance mismatch");
      return raw.days;
    }));
    return results.flat();
  }
  try {
    if(state)state.textContent="予報読み込み中";
    const [modelResult,rainResult,tideResult]=await Promise.allSettled([
      fetchJSON(modelURL),
      rainData(),
      loadWakayama()
    ]);
    if(modelResult.status!=="fulfilled")throw modelResult.reason;
    const payload=fromSource(modelResult.value,rainResult.status==="fulfilled"?rainResult.value:null);
    if(tideResult.status==="fulfilled")payload.tide.days=tideResult.value;
    else console.warn("JMA Wakayama tide unavailable; showing missing markers",tideResult.reason);
    if(rainResult.status!=="fulfilled")console.warn("Rain model unavailable; missing values remain blank",rainResult.reason);
    window.KANTO_FORECAST_DATA=payload;
    const script=document.createElement("script");
    script.src="./app.js?v=20261125-1";
    script.onerror=()=>{if(state)state.textContent="グラフ読み込みに失敗しました";};
    document.body.appendChild(script);
  } catch(error) {
    console.warn("Isonoura hourly source unavailable",error);
    if(state)state.textContent="時間別データを取得できません";
    const empty=document.querySelector("[data-chart-empty]");
    if(empty){empty.hidden=false;empty.textContent="予報データ取得不可（数値は補完しません）";}
  }
})();
