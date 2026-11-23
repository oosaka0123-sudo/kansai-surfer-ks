#!/usr/bin/env python3
"""Convert official JMA WY annual fixed-width tide tables into auditable static JSON.
Format/offsets follow the exact Kanto surfer commit dfce290 tide_jma.php parser.
These are ASTRONOMICAL PREDICTIONS, never on-beach measurements.
"""
from pathlib import Path
import json
import re
import sys
from datetime import date
root = Path(__file__).resolve().parent

def parse(year):
    raw = root / "jma-source" / f"WY-{year}.txt"
    assert raw.is_file(), raw
    rows = []
    for line in raw.read_text(encoding="ascii").splitlines():
        assert len(line) == 136, len(line)
        assert line[78:80] == "WY", line[72:80]
        y = 2000 + int(line[72:74])
        m = int(line[74:76])
        d = int(line[76:78])
        assert y == year
        day = date(y,m,d).isoformat()
        levels = []
        for hour in range(24):
            t = line[hour*3:hour*3+3].strip()
            levels.append(int(t) if re.fullmatch(r"-?\d+",t or "!") and t not in ("999", "-99") else None)
        def events(offset):
            out = []
            for j in range(4):
                pair = line[offset+j*7:offset+j*7+7]
                time = pair[:4].replace(" ","0")
                value = pair[4:7].strip()
                if time=="9999" or value=="999" or not time.isdigit() or not re.fullmatch(r"-?\d+",value):continue
                hh,mm = divmod(int(time),100)
                if hh>=24 or mm>=60:continue
                out.append({"time":f"{hh:02d}:{mm:02d}","height_cm":int(value)})
            return out
        if len(levels) != 24 or any(x is None for x in levels):
            # Missing dates must NOT be fabricated.
            continue
        rows.append({"date":day,"hourly_cm":levels,"high":events(80),"low":events(108)})
    assert len(rows) in (365,366), (year,len(rows))
    return {"station":"和歌山","station_id":"WY","datum":"気象庁潮位表基準面","unit":"cm","timezone":"Asia/Tokyo",
            "source":"気象庁・和歌山の潮位表（天文潮位予測）",
            "source_url":"https://www.data.jma.go.jp/kaiyou/db/tide/suisan/suisan.php?stn=WY",
            "observation":False,"year":year,"days":rows}

for year in (2026,2027):
    data=parse(year)
    out=root/"data"/f"WY-{year}.json"
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    nov=next((row for row in data["days"] if row["date"]==f"{year}-11-23"),None)
    print("JMA_WY_PARSED",year,len(data["days"]),"bytes",out.stat().st_size,
          "nov23_hourly_00_04",nov["hourly_cm"][:5] if nov else None,
          "high",nov["high"] if nov else None,"low",nov["low"] if nov else None)
