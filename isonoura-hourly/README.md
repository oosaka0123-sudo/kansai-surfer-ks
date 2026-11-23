# 関西サーファーKS｜磯ノ浦 1時間別波・風・潮位

## 関東版の正本
- Repository: `oosaka0123-sudo/kanto-surfer-ks`
- Commit: `dfce29051e0e3b866f3f8832ac78d1b70c83189c`
- `app.js`: 同コミット `prototype/spot-forecast/app.js` を **無改変でコピー**
- `styles.css`: 同コミット `prototype/spot-forecast/styles.css` を **無改変でコピー**
- HTML構造: 同コミット `scripts/build_pages_site.php` の鵠沼専用UIを参照。関西ヘッダー/フッターと共通CSSの干渉を防ぐため、`isonoura.html` から独立した同一オリジン `iframe` で表示
- `adapter.js`: 関西の既存Open-Meteo JSON形式→関東グラフ用データ形式への変換、和歌山潮位データ接続（サーバー本体には変更なし）

## データ地点・意味
- 波/風・気温/天気: `../data/spot_isonoura.json`、関西の既存設定 `34.18, 135.05`
- 降水量/降水確率: Open-Meteo `/v1/forecast`, `34.18, 135.05`, `timezone=Asia/Tokyo`, `hourly=precipitation,precipitation_probability`
- 波高: Open-Meteo海洋モデルの**生波高**。現行サイトのランキング用波高係数0.7や評価は変更しない
- 潮位: 気象庁の**和歌山**（`WY`, 34°13′N, 135°09′E）の**天文潮位予測**。磯ノ浦実測ではない。潮位表基準面上のcm。湘南港D8は一切使用しない
- 原典: https://www.data.jma.go.jp/kaiyou/db/tide/suisan/suisan.php?stn=WY
- 原始形式: https://www.data.jma.go.jp/kaiyou/db/tide/suisan/readme.html
- 2026年度: `jma-source/WY-2026.txt`
- 2027年度: `jma-source/WY-2027.txt`
- 変換スクリプト: `build_jma_wakayama.py`（公式の固定長形式から `data/WY-YYYY.json` を作る）

## 表示規則
- JST 04:00〜20:00、17本の**1時間刻み**
- 波高棒、水色／風速折れ線、オレンジ
- 潮位線、降水量棒（**別スケール**）
- 気象の過去時間は取得時点の**モデル予報値**であり、現地観測値ではない
- 降水量 `0.0mm` と `—`（未取得）は別扱い。モデルAPIが返らないときは`—`表示
- 過去の潮位線も気象庁の**天文推算**であり、実測ではない
- 潮回りは旧暦換算の**目安**、気象庁が公表する区分ではない
- 2028年以降は新たなWY潮位表を公式から取得し変換すること。未取得は`—`のまま
- グラフ3領域の時刻軸・横スクロールは関東版 `app.js` の元処理を使用
- 選択日時・潮位の現在点（04〜20時内）・満干潮マーカー等も関東版元実装による

## 展開時の注意
このディレクトリの `app.js`・`styles.css` は関東版の原典を保持している。次のポイントへの展開は「既存地点のモデル取得座標」「JMA潮位の適切な基準地点」を**先に独立監査**し、地名・API・潮位表を別々に設定する。

2026-11-23導入時点では磯ノ浦限定。関西トップ、他8ポイント、共通JS/CSS、10日間予報、PHP、ランキング、スコア・補正係数は変更しない。

## 検証
- Chrome: スマホ320/360/390px
- 17列×5行=90セルを波・風表、潮位・降水表にそれぞれ描画
- 3箇所でスクロール `[260,260,260]` 一致
- 当日/翌日のJST切替、満干潮表、潮回り、天文潮位WYと降水量を確認
- 15:42 JSTのシミュレーションで赤い潮位現在点が点滅（`tide-now-blink`）
- 既存 `#ks10-forecast` とサイト内座標・補正係数を維持
