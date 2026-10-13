#!/usr/bin/env python3
import argparse
import pathlib
import re
import sys

START = "KS_MORNING_BRIEF_POLICY_V2_START"
END = "KS_MORNING_BRIEF_POLICY_V2_END"

POLICY = r"""
[KS_MORNING_BRIEF_POLICY_V2_START]
【関西サーファー朝刊 v2 / 朝記事固定ルール】
- 冒頭は必ず「おはようございます、木山です。」から始める。
- 冒頭は3〜4文程度。大阪の天気は提供された大阪天気データだけを使う。
- 時事・季節・海ネタは、プロンプト内に明示的に提供された確認済み情報だけを使う。情報が無い場合は創作せず、その一文を省略する。
- 「今朝見てきました」「仲間から聞きました」など、実際に与えられていない本人経験・友人証言・現地確認を絶対に創作しない。
- 本文は原則として次の順番:
  1. 今日の関西 波ランキングTOP5
  2. 9スポットの波情報
  3. 今日のコンペニュース
  4. サーフィン関連ニュース
  5. 海の事故・安全情報
  6. 今日のひとこと
- ランキング、波サイズ、風、点数などは入力データの値だけを使い、変更・補完・推測しない。
- 9スポットは 磯ノ浦 / 国府の浜 / 生見 / 小松海岸 / 伊良湖 / 静波 / 浜詰 / 高浜 / 白兎。入力にデータが無いスポットは推測して埋めない。
- 現在値と予報値を混ぜない。「現在」「今後/予報」など、時点が分かる形で区別する。
- コンペニュース、サーフィン関連ニュース、海の事故・安全情報は、プロンプト内に確認済みのソース・時刻付き情報が明示的に提供された場合だけ事実として書く。情報が無い場合にニュースや事故を創作しない。
- コンペの新規ニュースが無い場合の代替情報（月間日程、S.LEAGUE TOP3、五十嵐カノアのランキング/次戦）は、提供データ側で掲載対象に選ばれたものだけを書く。AI自身で再掲可否を判断しない。
- 本文中に表示される「S.LEAGUE」「エスリーグ」は S.LEAGUE NOW（https://sleague.rss7.net/）へのリンクにする。ただしURL・HTML属性・alt・コード文字列を機械置換しない。
- 台風・地震・津波・高波・海難・サーファー事故は安全を最優先し、提供された一次情報の発表元・発表時刻・確認時刻を維持する。古い情報を現在情報として断定しない。
- 通常日は朝2〜3分で読める簡潔さを優先する。重大な安全情報がある日は文字数を優先せず必要情報を伝える。
[KS_MORNING_BRIEF_POLICY_V2_END]
""".strip()

HEREDOC_RE = re.compile(r"(?m)^(?P<indent>\s*)\$prompt\s*=\s*<<<PROMPT\s*$")
END_RE = re.compile(r"(?m)^\s*PROMPT;\s*$")


def patch_text(text: str) -> tuple[str, str]:
    if START in text and END in text:
        return text, "already_patched"
    if START in text or END in text:
        raise ValueError("partial morning policy marker found")

    matches = list(HEREDOC_RE.finditer(text))
    if len(matches) != 1:
        raise ValueError(f"expected exactly one article prompt heredoc, found {len(matches)}")

    start = matches[0].end()
    end_match = END_RE.search(text, start)
    if not end_match:
        raise ValueError("article prompt terminator PROMPT; not found")

    policy = "\n\n" + POLICY + "\n"
    patched = text[:end_match.start()] + policy + text[end_match.start():]
    if patched.count(START) != 1 or patched.count(END) != 1:
        raise ValueError("morning policy marker validation failed")
    return patched, "patched"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    text = args.source.read_text(encoding="utf-8")
    patched, state = patch_text(text)

    print(f"STATE={state}")
    print(f"ORIGINAL_BYTES={len(text.encode('utf-8'))}")
    print(f"PATCHED_BYTES={len(patched.encode('utf-8'))}")
    print(f"POLICY_MARKERS={patched.count(START)}/{patched.count(END)}")

    if args.check:
        return 0

    if not args.output:
        parser.error("--output is required unless --check is used")
    args.output.write_text(patched, encoding="utf-8")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"ERROR={exc}", file=sys.stderr)
        raise SystemExit(1)
