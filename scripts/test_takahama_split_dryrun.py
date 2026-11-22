import hashlib
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parent))
from takahama_split_dryrun import UnsafePatch, build_preview, main

PHP = '''<?php
$SPOTS = [
  'takahama' => [ 'name' => '高浜', 'lat' => 35.708, 'lng' => 135.208, 'offshoreStart'=>120, ],
  'ikumi' => [ 'name' => '生見', 'lat' => 33.50, 'lng' => 134.30, ],
  'hakuto' => [ 'name' => '白兎', 'lat' => 35.512, 'lng' => 134.168, ],
];
foreach ($SPOTS as $key => $spot) {
    $marineUrl = 'https://marine-api.open-meteo.com/v1/marine?latitude=' . $spot['lat'];
    $weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' . $spot['lat'];
    $marineJson  = fetchUrl($marineUrl);
    $weatherJson = fetchUrl($weatherUrl);
}
'''

class PatchTests(unittest.TestCase):
    def test_takahama_only_and_reversible(self):
        original = PHP.encode()
        p = build_preview(original).decode()
        self.assertEqual(p.count("if ($key === 'takahama')"), 1)
        self.assertIn("'lat' => 35.65, 'lng' => 135.45", p)
        self.assertIn("'lat' => 33.50, 'lng' => 134.30", p)
        self.assertIn("'lat' => 35.512, 'lng' => 134.168", p)
        self.assertEqual(p.count('function calcScore'), 0)
        self.assertIn("$ksQuery['latitude'] = '35.49133';",p)
        self.assertIn("$ksQuery['longitude'] = '135.55782';",p)
        self.assertIn("$marineJson  = fetchUrl($marineUrl);",p)
    def test_refuses_unexpected_source(self):
        with self.assertRaises(UnsafePatch):
            build_preview(PHP.replace('35.708','35.700').encode())
    def test_refuses_missing_anchor(self):
        with self.assertRaises(UnsafePatch):
            build_preview(PHP.replace('$weatherJson = fetchUrl($weatherUrl);','').encode())
    def test_refuses_multiple_anchor(self):
        with self.assertRaises(UnsafePatch):
            build_preview((PHP+'$weatherJson = fetchUrl($weatherUrl);').encode())
    def test_sha_guard_and_private_output(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/'production.php'
            p.write_text(PHP)
            target=Path(d)/'preview.php'
            correct=hashlib.sha256(p.read_bytes()).hexdigest()
            self.assertEqual(main(['--input',str(p),'--expected-sha256',correct,'--output',str(target)]),0)
            self.assertTrue(target.is_file())
            self.assertEqual(p.read_text(),PHP)
            with self.assertRaises(UnsafePatch):
                main(['--input',str(p),'--expected-sha256','0'*64])
            with self.assertRaises(UnsafePatch):
                main(['--input',str(p),'--expected-sha256',correct,'--output',str(p)])

if __name__ == '__main__':
    unittest.main()
