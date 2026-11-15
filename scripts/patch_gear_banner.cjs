#!/usr/bin/env node
// Move the existing homepage gear banner before the LINE CTA, without modifying other content.
const fs = require('node:fs');
const path = require('node:path');
const [source, bannerPath, output] = process.argv.slice(2);
if (!source || !bannerPath || !output || path.resolve(source) === path.resolve(output)) {
  throw new Error('Usage: node patch_gear_banner.cjs CURRENT_INDEX BANNER NEW_INDEX (distinct output)');
}
const html = fs.readFileSync(source, 'utf8');
const banner = fs.readFileSync(bannerPath, 'utf8').trimEnd();
const startMarker = '<!-- KS GEAR BANNER START -->';
const endMarker = '<!-- KS GEAR BANNER END -->';
const anchor = '<!-- LINEバナー -->';
if (!html.includes('関西サーフィン波情報') || !html.includes('nami_common.js')) {
  throw new Error('Not recognized KS homepage');
}
for (const marker of [startMarker, endMarker, anchor]) {
  if (html.split(marker).length !== 2) throw new Error('Expected unique marker: ' + marker);
}
if (!banner.startsWith(startMarker) || !banner.endsWith(endMarker) ||
    !banner.includes('href="/gear/"') || !banner.includes('Amazon公式売上順位ではありません') ||
    !banner.includes('height:150px')) throw new Error('New banner invalid');
const start = html.indexOf(startMarker);
const markerEnd = html.indexOf(endMarker, start) + endMarker.length;
const oldAnchor = html.indexOf(anchor);
if (oldAnchor < 0 || start < oldAnchor || html.slice(markerEnd, markerEnd + 2) !== '\n\n') {
  throw new Error('Unexpected existing banner location/format. Refuse to change production.');
}
const withoutOld = html.slice(0, start) + html.slice(markerEnd + 2);
if (withoutOld.includes(startMarker) || withoutOld.includes(endMarker)) throw new Error('Old banner removal failed');
const index = withoutOld.indexOf(anchor);
if (index <= withoutOld.indexOf('<!-- ============ ALL SPOTS')) throw new Error('New location precedes wave information');
const patched = withoutOld.slice(0, index) + banner + '\n\n' + withoutOld.slice(index);
if (patched.replace(banner + '\n\n', '') !== withoutOld) throw new Error('Unexpected homepage mutation');
if (patched.indexOf(startMarker) > patched.indexOf(anchor)) throw new Error('Banner not before LINE');
fs.writeFileSync(output, patched, { encoding: 'utf8', flag: 'wx' });
console.log('Moved and resized existing banner; all original non-banner homepage bytes preserved.');
