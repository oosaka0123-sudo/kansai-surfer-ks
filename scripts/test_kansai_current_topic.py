#!/usr/bin/env python3
import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("builder",ROOT/"scripts"/"build_morning_official_context.py")
builder=importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
JST=timezone(timedelta(hours=9))

html="""<!doctype html><html><body>
<a href="/articles/-/100">全国ニュースだけの見出しです</a>
<a href="/articles/-/101">大阪・梅田に新スポットがオープン　地域のにぎわいに期待</a>
<a href="/articles/-/102">京都で交通事故　男性が死亡</a>
<a href="/articles/-/103">兵庫・神戸で秋のイベント開催へ　地域文化を発信</a>
</body></html>""".encode("utf-8")

items=builder.parse_mbs_kansai_links(html)
assert len(items)==4
assert items[1]["url"]=="https://newsdig.tbs.co.jp/articles/-/101"
assert builder.kansai_topic_score(items[0]["title"],0)<0
assert builder.kansai_topic_score(items[1]["title"],1)>builder.kansai_topic_score(items[2]["title"],2)

article_html="""<!doctype html><html><body><h1>大阪・梅田に新スポットがオープン　地域のにぎわいに期待</h1><p>本文は表示に使いません。</p></body></html>""".encode("utf-8")
real_fetch=builder.fetch
builder.fetch=lambda url: article_html if url.endswith("/101") else html
status={}
try:
    topic=builder.collect_kansai_current_topic(datetime(2026,10,26,6,50,tzinfo=JST),status)
finally:
    builder.fetch=real_fetch

assert topic is not None
assert topic["kind"]=="kansai_current_affairs"
assert topic["text"]=="大阪・梅田に新スポットがオープン　地域のにぎわいに期待"
assert topic["source"]=="https://newsdig.tbs.co.jp/articles/-/101"
assert status["kansai_current_topic"]["ok"] is True
assert status["kansai_current_topic"]["selected"]==1

print("Kansai current-affairs topic collector tests passed")
