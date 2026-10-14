#!/usr/bin/env python3
from __future__ import annotations
import collections
import re
import sys
from pathlib import Path

if len(sys.argv) != 5:
    raise SystemExit("usage: patch-line-hero-v2.py INPUT_HTML CSS HEADER_HTML OUTPUT_HTML")

input_path, css_path, header_path, output_path = map(Path, sys.argv[1:])
before = input_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8").strip()
header = header_path.read_text(encoding="utf-8").strip()

header_rx = re.compile(r'<header\b[^>]*class=["\'][^"\']*\btop-bar\b[^"\']*["\'][^>]*>.*?</header>', re.I | re.S)
style_rx = re.compile(r'\s*<style\s+id=["\']ks-line-hero-v2["\'][^>]*>.*?</style>\s*', re.I | re.S)
script_rx = re.compile(r'\s*<script\s+id=["\']ks-line-hero-share["\'][^>]*>.*?</script>\s*', re.I | re.S)
hero_rx = re.compile(r'<section\b[^>]*class=["\'][^"\']*\bhero-video-ks\b[^"\']*["\'][^>]*>.*?</section>', re.I | re.S)
href_rx = re.compile(r'\bhref=["\']([^"\']+)["\']', re.I)

if len(list(header_rx.finditer(before))) != 1:
    raise SystemExit("expected exactly one top-bar header")
hero_before = hero_rx.search(before)
if not hero_before:
    raise SystemExit("hero section missing")

base = style_rx.sub("\n", before)
base = script_rx.sub("\n", base)
patched, count = header_rx.subn(header, base, count=1)
if count != 1:
    raise SystemExit("header replacement failed")

style = f'\n<style id="ks-line-hero-v2">\n{css}\n</style>\n'
if "</head>" not in patched:
    raise SystemExit("head closing tag missing")
patched = patched.replace("</head>", style + "</head>", 1)

script = r'''
<script id="ks-line-hero-share">
(() => {
  const hero = document.querySelector('.hero-video-ks');
  if (!hero || document.getElementById('ksHeroShare')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hero-share';
  button.id = 'ksHeroShare';
  button.setAttribute('aria-label', 'このページを共有');
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 10.7l6.8-3.4M8.6 13.3l6.8 3.4"></path></svg><span class="hero-share-label">共有</span>';
  hero.appendChild(button);

  button.addEventListener('click', async () => {
    const label = button.querySelector('.hero-share-label');
    const data = {
      title: document.title,
      text: '関西サーファーLINE',
      url: location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(location.href);
      } else {
        const input = document.createElement('input');
        input.value = location.href;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }

      if (label) {
        label.textContent = 'コピー済み';
        window.setTimeout(() => { label.textContent = '共有'; }, 1500);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  });
})();
</script>
'''
if "</body>" not in patched:
    raise SystemExit("body closing tag missing")
patched = patched.replace("</body>", script + "\n</body>", 1)

# Guard: outside the header and our isolated style/script blocks, the page must be byte-identical.
def normalize(text: str) -> str:
    text = style_rx.sub("\n", text)
    text = script_rx.sub("\n", text)
    text, n = header_rx.subn("<KS_HEADER/>", text, count=1)
    if n != 1:
        raise SystemExit("normalization header failure")
    return text

if normalize(before) != normalize(patched):
    raise SystemExit("content outside allowed header/style scope changed")

# Preserve every existing link target exactly.
if collections.Counter(href_rx.findall(before)) != collections.Counter(href_rx.findall(patched)):
    raise SystemExit("href targets changed")

# Preserve the hero HTML and LINE community content; only CSS may reposition it.
hero_after = hero_rx.search(patched)
if not hero_after or hero_before.group(0) != hero_after.group(0):
    raise SystemExit("hero markup changed")

for required in [
    "海でつながる。",
    "関西サーファーLINE",
    "hero.mp4",
    "member_counts.php",
    "https://www.instagram.com/kansaisurfer.ks/",
    "https://facebook.com/kansaisurfer",
    "ksHeroShare",
    "navigator.share",
]:
    if required not in patched:
        raise SystemExit(f"required content missing: {required}")

output_path.write_text(patched, encoding="utf-8")
print("LINE_HERO_V2_PATCH_OK")
print(f"BYTES_BEFORE={len(before.encode('utf-8'))}")
print(f"BYTES_AFTER={len(patched.encode('utf-8'))}")
