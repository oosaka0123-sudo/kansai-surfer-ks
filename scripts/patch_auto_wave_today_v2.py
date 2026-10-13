#!/usr/bin/env python3
import argparse
import hashlib
import pathlib
import re
import tempfile

DEFAULT_EXPECTED_SHA256 = "e2224884f6fded3655e4bfee83e3355c02da1f4ed9f08ae4d6b6861782203795"
MARKER = "【関西サーファー朝刊 v2 最優先ルール】"
CONTEXT_MARKER = "KS_MORNING_CONTEXT_V1"
SCHEMA_VERSION = "ks-morning-brief-v2"

POLICY = """【関西サーファー朝刊 v2 最優先ルール】
・冒頭は必ず「おはようございます、木山です。」で始める。
・大阪の天気や時事・季節ネタは、入力として確認済みの情報だけを短く使う。未提供なら作らない。
・現地を見ていないのに「今朝見てきた」「仲間から聞いた」などの体験・証言を作らない。
・現在の波と今後の予報を混ぜない。数値・サイズ・順位は入力データを改変しない。
・波ランキングは最大TOP5。9スポットはデータが無い場合「本日データなし」とし、推測で補完しない。
・コンペ情報、サーフィン関連ニュース、海の事故・安全情報は、下記の確認済み朝刊コンテキスト(JSON)に存在する内容だけを事実として書く。
・コンペ情報が無い日に、月間日程・S.LEAGUE TOP3・五十嵐カノア順位などを勝手に生成しない。competition_fallback で publish=true の確認済み項目だけ使用する。
・確認済み朝刊コンテキストが {} の場合、コンペ・サーフニュース・事故安全について「無い」と断定せず、その節自体を省略する。
・海の事故・津波・地震・台風・高波等は一次情報と発表時刻が入力された場合だけ掲載し、古い警報を現在情報として書かない。
・通常日は朝2〜3分で読める簡潔さを優先する。重大な安全情報がある場合のみ必要な長さにする。
・本文中のS.LEAGUE / エスリーグは、表示側で https://sleague.rss7.net/ へリンクする前提で扱う。
【ここまで最優先ルール】

確認済み朝刊コンテキスト(JSON): {$ksMorningContextText}

"""

PROMPT_OPENER = re.compile(r"(\$prompt\s*=\s*<<<PROMPT\s*\r?\n)")
FUNCTION_OPENER = re.compile(r"(function\s+generate_article\s*\([^)]*\)\s*\{\s*\r?\n)", re.I)

CONTEXT_LOADER = """    // KS_MORNING_CONTEXT_V1: load only verified, same-day, fresh structured context.
    $ksMorningContextText = '{}';
    $ksMorningContextPath = __DIR__ . '/../data/morning-brief.json';
    if (is_file($ksMorningContextPath)) {
        $ksMorningContextRaw = @file_get_contents($ksMorningContextPath);
        $ksMorningContextData = is_string($ksMorningContextRaw) ? json_decode($ksMorningContextRaw, true) : null;
        if (is_array($ksMorningContextData)) {
            try {
                $ksMorningNow = new DateTimeImmutable('now', new DateTimeZone('Asia/Tokyo'));
                $ksMorningGenerated = !empty($ksMorningContextData['generated_at'])
                    ? new DateTimeImmutable($ksMorningContextData['generated_at'])
                    : null;
                $ksMorningAge = $ksMorningGenerated
                    ? $ksMorningNow->getTimestamp() - $ksMorningGenerated->getTimestamp()
                    : null;
                $ksMorningEligible =
                    (($ksMorningContextData['schema_version'] ?? '') === 'ks-morning-brief-v2') &&
                    (($ksMorningContextData['preview'] ?? true) === false) &&
                    (($ksMorningContextData['verified'] ?? false) === true) &&
                    (($ksMorningContextData['date'] ?? '') === $ksMorningNow->format('Y-m-d')) &&
                    is_int($ksMorningAge) && $ksMorningAge >= -300 && $ksMorningAge <= 21600;
                if ($ksMorningEligible) {
                    $ksMorningEncoded = json_encode($ksMorningContextData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    if (is_string($ksMorningEncoded)) {
                        $ksMorningContextText = $ksMorningEncoded;
                    }
                }
            } catch (Throwable $e) {
                $ksMorningContextText = '{}';
            }
        }
    }

"""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def patch_source(raw: bytes, expected_sha256: str) -> tuple[bytes, str, str]:
    old_hash = sha256_bytes(raw)
    if old_hash != expected_sha256:
        raise ValueError(f"source hash changed: expected={expected_sha256} actual={old_hash}")

    text = raw.decode("utf-8")
    if MARKER in text or CONTEXT_MARKER in text:
        raise ValueError("morning v2 marker already present; refusing a duplicate patch")

    function_matches = list(FUNCTION_OPENER.finditer(text))
    if len(function_matches) != 1:
        raise ValueError(f"expected exactly one generate_article function opener, found {len(function_matches)}")
    text, function_count = FUNCTION_OPENER.subn(lambda m: m.group(1) + CONTEXT_LOADER, text, count=1)
    if function_count != 1 or text.count(CONTEXT_MARKER) != 1:
        raise ValueError("context loader patch did not produce exactly one loader block")

    matches = list(PROMPT_OPENER.finditer(text))
    if len(matches) != 1:
        raise ValueError(f"expected exactly one article prompt opener, found {len(matches)}")

    patched, count = PROMPT_OPENER.subn(lambda m: m.group(1) + POLICY, text, count=1)
    if count != 1 or patched.count(MARKER) != 1:
        raise ValueError("prompt patch did not produce exactly one policy block")
    if patched.count("確認済み朝刊コンテキスト(JSON): {$ksMorningContextText}") != 1:
        raise ValueError("prompt is missing the structured context binding")

    out = patched.encode("utf-8")
    return out, old_hash, sha256_bytes(out)


def apply_file(source: pathlib.Path, output: pathlib.Path, expected_sha256: str) -> None:
    patched, old_hash, new_hash = patch_source(source.read_bytes(), expected_sha256)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(patched)
    print("MORNING_V2_PATCH_READY")
    print(f"SOURCE_SHA256={old_hash}")
    print(f"PATCHED_SHA256={new_hash}")
    print("PROMPT_PATCH_COUNT=1")
    print("PRODUCTION_WRITE=none")


def self_test() -> None:
    fixture = b"<?php\nfunction generate_article($spots_data) {\n$prompt = <<<PROMPT\nold prompt\nPROMPT;\n}\n"
    expected = sha256_bytes(fixture)
    patched, old_hash, new_hash = patch_source(fixture, expected)
    assert old_hash == expected
    assert new_hash != old_hash
    decoded = patched.decode("utf-8")
    assert decoded.count(MARKER) == 1
    assert decoded.count(CONTEXT_MARKER) == 1
    assert "ks-morning-brief-v2" in decoded
    assert "$ksMorningContextData['verified']" in decoded

    try:
        patch_source(fixture, "0" * 64)
    except ValueError as exc:
        assert "source hash changed" in str(exc)
    else:
        raise AssertionError("hash mismatch must fail")

    duplicate = b"<?php\n$prompt = <<<PROMPT\na\nPROMPT;\n$prompt = <<<PROMPT\nb\nPROMPT;\n"
    try:
        patch_source(duplicate, sha256_bytes(duplicate))
    except ValueError as exc:
        assert "exactly one article prompt opener" in str(exc)
    else:
        raise AssertionError("multiple prompt openers must fail")

    no_function = b"<?php\n$prompt = <<<PROMPT\nold prompt\nPROMPT;\n"
    try:
        patch_source(no_function, sha256_bytes(no_function))
    except ValueError as exc:
        assert "generate_article function opener" in str(exc)
    else:
        raise AssertionError("missing generate_article function must fail")

    try:
        patch_source(patched, sha256_bytes(patched))
    except ValueError as exc:
        assert "already present" in str(exc)
    else:
        raise AssertionError("duplicate policy insertion must fail")

    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp) / "in.php"
        out = pathlib.Path(tmp) / "out.php"
        src.write_bytes(fixture)
        apply_file(src, out, expected)
        assert out.exists()

    print("SELF_TEST_OK")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path)
    parser.add_argument("--expected-sha256", default=DEFAULT_EXPECTED_SHA256)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return
    if not args.source or not args.output:
        parser.error("--source and --output are required unless --self-test is used")
    apply_file(args.source, args.output, args.expected_sha256)


if __name__ == "__main__":
    main()
