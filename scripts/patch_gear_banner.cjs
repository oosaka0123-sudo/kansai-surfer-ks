#!/usr/bin/env node
// Run against a freshly downloaded production index; output must be a different file.
const fs = require('node:fs');
const path = require('node:path');
const [source, bannerPath, output] = process.argv.slice(2);
if (!source || !bannerPath || !output || path.resolve(source) === path.resolve(output)) {
  throw new Error('Usage: node patch_gear_banner.cjs CURRENT_INDEX BANNER NEW_INDEX (distinct output)');
}
const html = fs.readFileSync(source, 'utf8');
const banner = fs.readFileSync(bannerPath, 'utf8');
const anchor = '<!-- お問い合わせCTA -->';
if (!html.includes('関西サーフィン波情報') || !html.includes('nami_common.js')) throw new Error('Not a recognized KS homepage');
if ((html.split(anchor).length - 1) !== 1) throw new Error('Homepage anchor changed; review placement before patching');
if (html.includes('KS GEAR BANNER START') || html.includes('href="/gear/') || html.includes("href='/gear/") || html.includes('href="gear/')) throw new Error('Gear link already exists; inspect before changing');
if (!banner.includes('href="/gear/"') || !banner.includes('Amazon公式売上順位ではありません')) throw new Error('Invalid banner');
const patched = html.replace(anchor, banner + '\n\n' + anchor);
if (patched.replace(banner + '\n\n', '') !== html) throw new Error('Unexpected homepage change');
fs.writeFileSync(output, patched, {encoding:'utf8',flag:'wx'});
console.log('Created patched homepage; all original source preserved verbatim.');
