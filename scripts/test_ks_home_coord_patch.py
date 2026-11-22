"""Offline stage-by-stage checks for the isolated homepage coordinate patch."""
import pathlib
import subprocess
import sys
import tempfile

repo = pathlib.Path(__file__).resolve().parent.parent
script = repo / "scripts/ks_home_coord_patch.py"
base = subprocess.check_output(["git", "show", "a1c910f:index.html"], cwd=repo)
stages = [
    ("irago", b"lat: 34.573, lng: 137.022", b"lat: 34.613290, lng: 137.213273"),
    ("hamadutu", b"lat: 35.644, lng: 135.086", b"lat: 35.665200, lng: 134.966082"),
    ("hakuto", b"lat: 35.512, lng: 134.168", b"lat: 35.527370, lng: 134.116740"),
]
with tempfile.TemporaryDirectory() as temp:
    d = pathlib.Path(temp)
    (d / "baseline").write_bytes(base)
    current = base
    for key, before, after in stages:
        (d / "live").write_bytes(current)
        proc = subprocess.run([sys.executable, str(script), str(d / "baseline"), str(d / "live"), str(d / "new"), key], capture_output=True, text=True)
        assert proc.returncode == 0, (key, proc.stdout, proc.stderr)
        nxt = (d / "new").read_bytes()
        assert nxt == current.replace(before, after, 1)
        assert nxt.replace(after, before, 1) == current
        (d / "new").unlink()
        print("PASS", key)
        current = nxt
    (d / "live").write_bytes(current + b"UNEXPECTED")
    bad = subprocess.run([sys.executable, str(script), str(d / "baseline"), str(d / "live"), str(d / "new"), "hakuto"], capture_output=True, text=True)
    assert bad.returncode != 0 and not (d / "new").exists()
    print("PASS drift rejected")
print("OFFLINE_TESTS_PASS")
