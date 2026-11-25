'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node patch-home-isonoura.cjs <input.html> <output.html>');
const original = fs.readFileSync(input, 'utf8');
let html = original;
function once(before, after, label) {
  const first = html.indexOf(before);
  if (first < 0 || html.indexOf(before, first + before.length) >= 0) {
    throw new Error(label + ': expected exactly one original block');
  }
  html = html.slice(0, first) + after + html.slice(first + before.length);
}
if (html.includes('data-ks-isonoura-home-beach-wave')) throw new Error('Already patched; refuse duplicate.');
const spotIndex = html.indexOf('const SPOTS = [');
if (spotIndex < 0 || html.indexOf('const SPOTS = [', spotIndex + 1) >= 0) throw new Error('SPOTS not unique');
const scriptStart = html.lastIndexOf('<script>', spotIndex);
if (scriptStart < 0 || html.lastIndexOf('</script>', spotIndex) > scriptStart) throw new Error('Top spot script context invalid');
const helperTag = '<script src="isonoura-beach-wave.js?v=20261125-1" data-ks-isonoura-home-beach-wave></script>\n';
html = html.slice(0, scriptStart) + helperTag + html.slice(scriptStart);
const before = [
'    const waveH = safeNum(marine.hourly.wave_height[mIdx]);',
'    const waveP = safeNum(marine.hourly.wave_period[mIdx]);',
'    const swellD = safeNum(marine.hourly.swell_wave_direction?.[mIdx]);',
'    const w = weather.current || {};'
].join('\n');
const after = [
'    let waveH = safeNum(marine.hourly.wave_height[mIdx]);',
'    let waveP = safeNum(marine.hourly.wave_period[mIdx]);',
'    let swellD = safeNum(marine.hourly.swell_wave_direction?.[mIdx]);',
'    // 磯ノ浦は個別ページと同じ沿岸到達うねり + 地点補正(0.7)を適用する。',
'    // 補正ヘルパーが使えない場合は沖合の値を誤表示せず取得失敗扱い。',
'    if (spot.key === "isonoura") {',
'      const estimator = window.ksIsonouraBeachWave?.estimate;',
'      if (typeof estimator !== "function") return { spot, error: true };',
'      const beach = estimator(marine.hourly, mIdx);',
'      if (!beach || !Number.isFinite(beach.height)) return { spot, error: true };',
'      waveH = beach.height;',
'      waveP = Number.isFinite(beach.period) ? beach.period : null;',
'      swellD = Number.isFinite(beach.direction) ? beach.direction : null;',
'    }',
'    const w = weather.current || {};'
].join('\n');
once(before, after, 'Enriched beach estimate');
once('<div class="sm-stat-l">波</div>',
  '<div class="sm-stat-l">$' + '{r.spot.key === "isonoura" ? "波（ビーチ推定）" : "波"}</div>',
  'Mini card wave label');
once('<div class="bs-stat-label">波の高さ</div>',
  '<div class="bs-stat-label">$' + '{r.spot.key === "isonoura" ? "波（ビーチ推定）" : "波の高さ"}</div>',
  'Best spot wave label');
if (!html.includes('data-ks-isonoura-home-beach-wave') || !html.includes("const estimator = window.ksIsonouraBeachWave?.estimate")) throw new Error('Output check failed');
fs.writeFileSync(output, html, 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
console.log(JSON.stringify({originalBytes:Buffer.byteLength(original),patchedBytes:Buffer.byteLength(html),originalSha:hash(original),patchedSha:hash(html)}));
