import hashlib
import json
import shutil
import subprocess
from urllib.parse import parse_qs, urlparse
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
            p.write_text(PHP, encoding='utf-8')
            target=Path(d)/'preview.php'
            correct=hashlib.sha256(p.read_bytes()).hexdigest()
            self.assertEqual(main(['--input',str(p),'--expected-sha256',correct,'--output',str(target)]),0)
            self.assertTrue(target.is_file())
            self.assertEqual(p.read_text(encoding='utf-8'),PHP)
            with self.assertRaises(UnsafePatch):
                main(['--input',str(p),'--expected-sha256','0'*64])
            with self.assertRaises(UnsafePatch):
                main(['--input',str(p),'--expected-sha256',correct,'--output',str(p)])


# Offline PHP execution fixture. All fetchUrl calls are intercepted locally;
# no Open-Meteo or production endpoints are contacted in these tests.
EXECUTABLE_PHP = r'''<?php
$captured = [];
function fetchUrl($url) {
    global $captured;
    $captured[] = $url;
    return '{}';
}
$SPOTS = [
  'takahama' => [ 'name' => 'Takahama', 'lat' => 35.708, 'lng' => 135.208, 'offshoreStart'=>120, ],
  'ikumi' => [ 'name' => 'Ikumi', 'lat' => 33.50, 'lng' => 134.30, ],
  'hakuto' => [ 'name' => 'Hakuto', 'lat' => 35.512, 'lng' => 134.168, ],
];
foreach ($SPOTS as $key => $spot) {
    $marineUrl = 'https://marine-api.open-meteo.com/v1/marine?latitude=' . $spot['lat']
        . '&longitude=' . $spot['lng'] . '&hourly=wave_height%2Cwave_period';
    $weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' . $spot['lat']
        . '&longitude=' . $spot['lng']
        . '&hourly=wind_speed_10m%2Cwind_direction_10m&timezone=Asia%2FTokyo';
    $marineJson  = fetchUrl($marineUrl);
    $weatherJson = fetchUrl($weatherUrl);
}
echo json_encode($captured, JSON_THROW_ON_ERROR);
'''


@unittest.skipUnless(shutil.which('php'), 'PHP CLI is required for executable URL tests')
class ExecutableUrlTests(unittest.TestCase):
    def run_php(self, source: str, php_options: tuple[str, ...] = ()) -> tuple[subprocess.CompletedProcess[str], list[str] | None]:
        with tempfile.TemporaryDirectory(prefix='ks-takahama-sandbox-') as directory:
            path = Path(directory) / 'fixture.php'
            path.write_text(source, encoding='utf-8')
            result = subprocess.run(
                ['php', *php_options, str(path)],
                capture_output=True, text=True, encoding='utf-8', errors='replace',
                timeout=15, check=False,
            )
            urls = json.loads(result.stdout) if result.returncode == 0 else None
            return result, urls

    def test_actual_php_urls_split_only_takahama(self):
        baseline, before = self.run_php(EXECUTABLE_PHP)
        self.assertEqual(baseline.returncode, 0, baseline.stderr)
        candidate, after = self.run_php(build_preview(EXECUTABLE_PHP.encode()).decode())
        self.assertEqual(candidate.returncode, 0, candidate.stderr)
        self.assertEqual(len(after), 6)
        self.assertEqual(len(before), 6)
        parsed = [parse_qs(urlparse(url).query) for url in after]
        # Marine coordinates for Takahama change; weather coordinates use coastal location.
        self.assertEqual(parsed[0]['latitude'], ['35.65'])
        self.assertEqual(parsed[0]['longitude'], ['135.45'])
        self.assertEqual(parsed[1]['latitude'], ['35.49133'])
        self.assertEqual(parsed[1]['longitude'], ['135.55782'])
        # Request parameters other than the coordinates are retained.
        for i in range(6):
            original = parse_qs(urlparse(before[i]).query)
            revised = parsed[i]
            for key in set(original) - {'latitude', 'longitude'}:
                self.assertEqual(revised.get(key), original[key], (i, key))
        self.assertEqual(after[2:], before[2:], 'Other surf spots must be byte-identical')

    def test_missing_weather_longitude_fails_closed(self):
        # The tool may create a preview of a changed API URL shape; the PHP
        # guard must stop, not silently use a wrong wind coordinate.
        malformed = EXECUTABLE_PHP.replace(
            "        . '&longitude=' . $spot['lng']\n        . '&hourly=wind_speed",
            "        . '&hourly=wind_speed",
            1,
        )
        self.assertNotEqual(malformed, EXECUTABLE_PHP)
        result, urls = self.run_php(build_preview(malformed.encode()).decode())
        self.assertNotEqual(result.returncode, 0)
        self.assertIsNone(urls)
        self.assertIn('no coordinate keys', result.stderr)

    def test_original_php_urls_unchanged_for_all_other_spots(self):
        result, urls = self.run_php(build_preview(EXECUTABLE_PHP.encode()).decode())
        self.assertEqual(result.returncode, 0, result.stderr)
        for name, i, lat, lon in [('ikumi', 2, '33.5', '134.3'),
                                  ('hakuto', 4, '35.512', '134.168')]:
            for endpoint in urls[i:i+2]:
                params = parse_qs(urlparse(endpoint).query)
                self.assertEqual(params['latitude'], [lat], name)
                self.assertEqual(params['longitude'], [lon], name)


    def test_url_separator_is_not_controlled_by_php_ini(self):
        patched = build_preview(EXECUTABLE_PHP.encode()).decode()
        result, urls = self.run_php(
            patched, ('-d', 'arg_separator.output=&amp;'),
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        wind = parse_qs(urlparse(urls[1]).query)
        self.assertEqual(wind['latitude'], ['35.49133'])
        self.assertEqual(wind['longitude'], ['135.55782'])
        self.assertEqual(wind['timezone'], ['Asia/Tokyo'])

    def test_php_source_is_not_executed_with_network(self):
        # Explicitly verify our fixture uses only the capturing stub.
        self.assertIn('function fetchUrl($url)', EXECUTABLE_PHP)
        self.assertNotIn('curl_exec(', EXECUTABLE_PHP)
        self.assertNotIn('file_get_contents(', EXECUTABLE_PHP)


class AdditionalGuardTests(unittest.TestCase):
    def test_duplicate_takahama_entry_rejected(self):
        duplicated = PHP.replace(
            "  'ikumi' =>",
            "  'takahama' => [ 'name' => 'duplicate', 'lat' => 35.708, 'lng' => 135.208, ],\n  'ikumi' =>",
        )
        with self.assertRaises(UnsafePatch):
            build_preview(duplicated.encode())


    def test_uppercase_takahama_key_is_rejected(self):
        changed = PHP.replace("'takahama' =>", "'Takahama' =>", 1)
        with self.assertRaisesRegex(UnsafePatch, 'Exactly one Takahama'):
            build_preview(changed.encode('utf-8'))

    def test_output_outside_private_temp_root_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            source = Path(d) / 'source.php'
            source.write_text(PHP, encoding='utf-8')
            candidate = Path.home() / 'ks-takahama-preview-forbidden.php'
            self.assertFalse(candidate.exists(), 'Test filename must not already exist')
            sha = hashlib.sha256(source.read_bytes()).hexdigest()
            with self.assertRaisesRegex(UnsafePatch, 'private temporary directory'):
                main(['--input', str(source), '--expected-sha256', sha,
                      '--output', str(candidate)])
            self.assertFalse(candidate.exists())

    def test_existing_output_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.php'
            out = Path(directory) / 'existing.php'
            source.write_text(PHP, encoding='utf-8')
            out.write_text('KEEP-ME')
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            with self.assertRaisesRegex(UnsafePatch, 'Output already exists'):
                main(['--input', str(source), '--expected-sha256', digest,
                      '--output', str(out)])
            self.assertEqual(out.read_text(), 'KEEP-ME')

if __name__ == '__main__':
    unittest.main()
