#!/usr/bin/env python3
"""Preview a Takahama-only Marine/Weather location split. Never deploy.

Usage:
  python takahama_split_dryrun.py --input /tmp/private/production.php \
    --expected-sha256 <sha> [--output /tmp/private/takahama_candidate.php]

Input/output PHP can contain private deployment data. Do NOT commit, publish,
log, or upload those files. This tool prints only hashes and audit summaries.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import re
import sys

MARINE_LAT = "35.65"
MARINE_LNG = "135.45"
WEATHER_LAT = "35.49133"
WEATHER_LNG = "135.55782"
WEATHER_FETCH = "$weatherJson = fetchUrl($weatherUrl);"

# Deliberately limited to Takahama; other spots and ranking logic are not edited.
WEATHER_OVERRIDE = """if ($key === 'takahama') {
        $ksParts = parse_url($weatherUrl);
        if (!$ksParts || !isset($ksParts['scheme'], $ksParts['host'])) {
            throw new RuntimeException('Invalid Takahama weather URL');
        }
        $ksQuery = [];
        parse_str($ksParts['query'] ?? '', $ksQuery);
        if (!isset($ksQuery['latitude'], $ksQuery['longitude'])) {
            throw new RuntimeException('Takahama weather URL has no coordinate keys');
        }
        $ksQuery['latitude'] = '35.49133';
        $ksQuery['longitude'] = '135.55782';
        $weatherUrl = $ksParts['scheme'] . '://' . $ksParts['host']
            . ($ksParts['path'] ?? '') . '?' . http_build_query($ksQuery);
    }
    """


class UnsafePatch(ValueError):
    """The live source differs from the vetted structure. Do not patch."""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_preview(original: bytes) -> bytes:
    try:
        source = original.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise UnsafePatch("Input is not UTF-8") from exc
    spot = re.search(r"(['\"]takahama['\"]\s*=>\s*\[)(.*?)(\])", source, re.S | re.I)
    if not spot or len(re.findall(r"['\"]takahama['\"]\s*=>\s*\[", source, re.I)) != 1:
        raise UnsafePatch("Exactly one Takahama SPOTS entry is required")
    block = spot.group(2)
    updated = block
    for field, old, new in (("lat", "35.708", MARINE_LAT), ("lng", "135.208", MARINE_LNG)):
        p = r"(['\"]" + field + r"['\"]\s*=>\s*)" + re.escape(old) + r"\b"
        updated, n = re.subn(p, lambda m: m.group(1) + new, updated)
        if n != 1:
            raise UnsafePatch(f"Unexpected {field} value or duplicate within Takahama")
    source2 = source[:spot.start(2)] + updated + source[spot.end(2):]
    if source2.count(WEATHER_FETCH) != 1:
        raise UnsafePatch("Expected exactly one Weather API fetch anchor")
    if 'foreach ($SPOTS as $key => $spot)' not in source2:
        raise UnsafePatch("Cannot establish per-spot generator context")
    pos = source2.find(WEATHER_FETCH)
    marine_fetch = source2.find('$marineJson  = fetchUrl($marineUrl);')
    if not 0 <= source2.find('foreach ($SPOTS as $key => $spot)') < marine_fetch < pos:
        raise UnsafePatch("Weather fetch is outside the known per-spot context")
    source3 = source2.replace(WEATHER_FETCH, WEATHER_OVERRIDE + WEATHER_FETCH, 1)
    assert source3.replace(WEATHER_OVERRIDE, "", 1) == source2
    # Removing the insertion and undoing the Takahama-only fields must recover input.
    recovery = source3.replace(WEATHER_OVERRIDE, "", 1)
    new_spot = re.search(r"(['\"]takahama['\"]\s*=>\s*\[)(.*?)(\])", recovery, re.S | re.I)
    assert new_spot is not None
    restored = new_spot.group(2)
    for field, old, new in (("lat", "35.708", MARINE_LAT), ("lng", "135.208", MARINE_LNG)):
        p = r"(['\"]" + field + r"['\"]\s*=>\s*)" + re.escape(new) + r"\b"
        restored, n = re.subn(p, lambda m: m.group(1) + old, restored)
        assert n == 1
    recovery = recovery[:new_spot.start(2)] + restored + recovery[new_spot.end(2):]
    if recovery != source:
        raise UnsafePatch("Changes outside Takahama or unrecoverable transform")
    return source3.encode("utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--output", type=Path, help="Optional PRIVATE isolated copy; never production path")
    args = parser.parse_args(argv)
    if len(args.expected_sha256) != 64 or not all(c in '0123456789abcdefABCDEF' for c in args.expected_sha256):
        parser.error('expected-sha256 must be a full SHA-256 hex string')
    original = args.input.resolve().read_bytes()
    if sha256(original) != args.expected_sha256.lower():
        raise UnsafePatch('Live PHP has changed; abort (unexpected SHA256)')
    preview = build_preview(original)
    if args.output:
        out = args.output.resolve()
        if out == args.input.resolve():
            raise UnsafePatch('Refusing to overwrite source')
        if out.exists():
            raise UnsafePatch('Output already exists; refusing to overwrite')
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(preview)
        print('PRIVATE_ISOLATED_PREVIEW_WRITTEN=YES')
    else:
        print('PRIVATE_ISOLATED_PREVIEW_WRITTEN=NO')
    print('ORIGINAL_SHA256=' + sha256(original))
    print('PREVIEW_SHA256=' + sha256(preview))
    print('MARINE_INPUT_TAKAHAMA=' + MARINE_LAT + ',' + MARINE_LNG)
    print('WEATHER_INPUT_TAKAHAMA=' + WEATHER_LAT + ',' + WEATHER_LNG)
    print('SPOT_KEYS_OTHER_THAN_TAKAHAMA_UNMODIFIED=YES')
    print('PRODUCTION_WRITES=0')
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, UnsafePatch) as exc:
        print('ABORTED: ' + str(exc), file=sys.stderr)
        raise SystemExit(2) from exc
