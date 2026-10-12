# KS Notebook Video Pipeline

関西サーファーKSの日次波ランキングから、NotebookLM動画生成、検証、YouTubeアップロード、LINE通知までを自動化するMVP。

## 設計原則
- オーケストレーター: Node.js / TypeScript
- ブラウザ自動化: Playwright + 専用Chrome + CDP
- Chrome: ジョブ実行時のみ起動し、終了時に閉じる
- Notebook: 毎日新規 `KS-YYYY-MM-DD`
- ソース: `source.md` をローカル生成しファイルアップロード
- 状態: 日付別 `runs/YYYY-MM-DD/state.json`
- 多重起動防止: `pipeline.lock`
- 動画検証: ffprobe + 将来の音声QA
- YouTube: YouTube Data API v3
- 公開: private/unlistedで止め、LINE通知後に人間が公開
- Notebook保持: 14日。削除前にローカル成果物保存を確認

## MVP順序
1. YouTube API疎通
2. NotebookLM Playwright単体検証
3. state/lock実装
4. LINE通知
5. 通し実行
