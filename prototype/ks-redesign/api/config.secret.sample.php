<?php
// ============================================================================
// LINE Messaging API 設定テンプレート（サンプル / 秘密値は含まれていません）
//
// 使い方:
//   1. このファイルを同じディレクトリに `config.secret.php` としてコピーする。
//      （`config.secret.php` は .gitignore 済みのため、実際の値をコミットしない）
//   2. 下記2値を、対象の LINE 公式アカウント（Bot）の実際の値に書き換える。
//      - channel_access_token: Messaging API の Channel access token
//      - group_chat_group_id : 「普通のグループチャット」に対応する LINE グループの groupId
//        （そのグループに対象の公式アカウント/Botが参加している必要があります）
//   3. サーバー環境変数 LINE_CHANNEL_ACCESS_TOKEN / LINE_GROUP_CHAT_GROUP_ID が
//      設定できる環境では、config.secret.php を置かずに環境変数だけでも動作します。
//
// どちらも未設定の場合、line-group-count.php は人数を取得せず
// { "status": "unconfigured" } を返し、画面側は人数を捏造せず
// フォールバック表示（取得できませんでした）になります。
// ============================================================================

return [
    'channel_access_token' => '',
    'group_chat_group_id' => '',
];
