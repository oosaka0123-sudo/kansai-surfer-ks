# api/line-group-count.php

LINE Community ページの「普通のグループチャット」バナーが参加人数を表示するための、
server-side のみの LINE Messaging API 呼び出しエンドポイント。ブラウザから LINE API を
直接呼び出すことはない。

## 必要な環境変数

リポジトリには一切コミットしない。本番ホスティング側（例: Lolipopのサーバー環境変数設定）で、
以下の2つを設定する。

- `LINE_CHANNEL_ACCESS_TOKEN` — 対象グループが参加しているLINE公式アカウント/Botのチャネルアクセストークン
- `LINE_GROUP_CHAT_GROUP_ID` — 人数を取得したい対象グループの `groupId`

いずれか一方でも未設定の場合、このエンドポイントは人数を捏造せず
`{"status":"unconfigured"}` を返す。LINE API呼び出しが失敗した場合は `{"status":"error"}` を返す。

成功時は `{"status":"ok","count":123}` を返す。

## 前提条件

- 対象のLINEグループに、トークン発行元のLINE公式アカウント/Botが参加していること。
- `KS_PROD_FTP_USER` / `KS_PROD_FTP_PASSWORD` などの既存デプロイ用シークレットとは別物であり、
  アプリ実行時にPHPから読み取れる環境変数として、本番サーバー側で個別に設定する必要がある。
