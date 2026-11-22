#!/usr/bin/env python3
"""Fail-closed, one-spot-at-a-time production homepage coordinate patch."""
import hashlib
import pathlib
import re
import sys

BASELINE_SHA256 = "a70a012d6ccf971fee02b4b3b00a3353392002c13163946f7dc7f443220e380f"
CHANGES = [
    ("irago", b"    lat: 34.573, lng: 137.022,", b"    lat: 34.613290, lng: 137.213273,"),
    ("hamadutu", b"    lat: 35.644, lng: 135.086,", b"    lat: 35.665200, lng: 134.966082,"),
    ("hakuto", b"    lat: 35.512, lng: 134.168,", b"    lat: 35.527370, lng: 134.116740,"),
]


def sha(x):
    return hashlib.sha256(x).hexdigest()


def main():
    if len(sys.argv) != 5:
        raise SystemExit("usage: ks_home_coord_patch.py BASELINE LIVE OUT SPOT")
    baseline_path, live_path, output_path, spot = sys.argv[1:]
    allowed = [x[0] for x in CHANGES]
    if spot not in allowed:
        raise SystemExit("unknown spot: " + spot)
    if pathlib.Path(output_path).exists():
        raise SystemExit("output already exists")
    baseline = pathlib.Path(baseline_path).read_bytes()
    actual = pathlib.Path(live_path).read_bytes()
    if sha(baseline) != BASELINE_SHA256:
        raise SystemExit("baseline SHA256 mismatch")
    expected = baseline
    for name, old, new in CHANGES:
        marker = ("key: '" + name + "'").encode()
        pos = expected.find(marker)
        if pos < 0 or expected.count(marker) != 1:
            raise SystemExit("missing/duplicate spot key " + name)
        if expected.count(old) != 1:
            raise SystemExit("missing/duplicate old coordinate " + name)
        coord_at = expected.index(old)
        if not (pos < coord_at < pos + 180):
            raise SystemExit("coordinate not in expected spot block " + name)
        if name == spot:
            if actual != expected:
                raise SystemExit("LIVE_HTML_CHANGED: refuse to overwrite unrelated changes, expected_sha=" + sha(expected) + " actual_sha=" + sha(actual))
            result = expected.replace(old, new, 1)
            if result.replace(new, old, 1) != expected:
                raise SystemExit("nonreversible change")
            if result.count(new) != 1:
                raise SystemExit("new coordinate ambiguous")
            pathlib.Path(output_path).write_bytes(result)
            print("GUARD_OK spot=" + name + " before_sha=" + sha(expected) + " after_sha=" + sha(result))
            return
        expected = expected.replace(old, new, 1)
    raise SystemExit("unreachable")


if __name__ == "__main__":
    main()
