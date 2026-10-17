#!/usr/bin/env python3
import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("builder",ROOT/"scripts"/"build_morning_official_context.py")
builder=importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
JST=timezone(timedelta(hours=9))

rss=""""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>SURFMEDIA</title>
<item>
<title><![CDATA[äºååµã«ãã¢ãã³ãã¼ã»ãªã¬ã¢ãªã¼ã¨ãã©ã¦ã³ã2ã§æéã9ä½ã§ãã£ããã·ã¥ãCTç¬¬10æ¦MEOãªããã»ã«ã¼ã«ã»ãã­ã»ãã«ãã¬ã«ãã¹ã¿ã¼ãã]]></title>
<link>https://surfmedia.jp/2026/10/17/test-kanoa/</link>
<pubDate>Sat, 17 Oct 2026 03:00:00 +0000</pubDate>
<category><![CDATA[WSL MENS CT]]></category>
<description><![CDATA[<p>äºååµã«ãã¢ã¨ã³ãã¼ã»ãªã¬ã¢ãªã¼ã¯ã¨ãã«ã©ã¦ã³ã2ã§æéãã9ä½ã§ãã£ããã·ã¥ããã</p>]]></description>
</item>
<item>
<title><![CDATA[éå»ã®ãµã¼ãæ å]]></title>
<link>https://surfmedia.jp/2026/10/10/old-story/</link>
<pubDate>Sat, 10 Oct 2026 03:00:00 +0000</pubDate>
<category><![CDATA[NEWS]]></category>
<description><![CDATA[<p>å¤ãè¨äºã§ãã</p>]]></description>
</item>
</channel>
</rss>""".encode("utf-8")

entries=builder.parse_surfmedia_feed(rss)
assert len(entries)==2
target=entries[0]
assert "五十嵐カノア" in target["title"]
assert target["published"].isoformat()=="2026-10-17T12:00:00+09:00"
assert "ラウンド2" in target["description"]
assert builder.surfmedia_competition_score(target) >= 300

real_fetch=builder.fetch
builder.fetch=lambda url:rss
status={}
try:
    out=builder.collect_surfmedia_competition(datetime(2026,10,17,13,58,tzinfo=JST),status)
finally:
    builder.fetch=real_fetch
assert len(out)==1, out
assert "五十嵐カノア" in out[0]["title"]
assert out[0]["source"]=="https://surfmedia.jp/2026/10/17/test-kanoa/"
assert out[0]["published_at"]=="2026-10-17T12:00:00+09:00"
assert status["surfmedia_competition"]["ok"] is True
assert status["surfmedia_competition"]["selected"]==1

# Fail closed: unrelated old/filler items are not promoted to competition news.
old_only=rss.replace(b"Sat, 17 Oct 2026 03:00:00 +0000",b"Sat, 10 Oct 2026 03:00:00 +0000")
builder.fetch=lambda url:old_only
status={}
try:
    out=builder.collect_surfmedia_competition(datetime(2026,10,17,13,58,tzinfo=JST),status)
finally:
    builder.fetch=real_fetch
assert out==[]
assert status["surfmedia_competition"]["ok"] is True

print("SURFMEDIA competition collector tests passed")
