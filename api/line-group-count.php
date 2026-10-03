<?php
/**
 * LINE Messaging API 経由で「普通のグループチャット」の参加人数を取得する。
 * ブラウザから直接 LINE API は叩かず、このエンドポイントだけが呼び出す。
 *
 * 必要な環境変数（リポジトリには秘密値を一切コミットしない）:
 *   LINE_CHANNEL_ACCESS_TOKEN  LINE公式アカウント/Botのチャネルアクセストークン
 *   LINE_GROUP_CHAT_GROUP_ID   対象グループの groupId（Botが参加済みであること）
 *
 * 環境変数が未設定、またはLINE API呼び出しが失敗した場合は、
 * 人数を捏造せず {"status":"unconfigured"} / {"status":"error"} を返す。
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $payload): void {
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$channelAccessToken = getenv('LINE_CHANNEL_ACCESS_TOKEN');
$groupId = getenv('LINE_GROUP_CHAT_GROUP_ID');

if (!$channelAccessToken || !$groupId) {
    respond(['status' => 'unconfigured']);
}

if (!function_exists('curl_init')) {
    respond(['status' => 'error']);
}

$endpoint = 'https://api.line.me/v2/bot/group/' . rawurlencode($groupId) . '/members/count';

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $channelAccessToken,
    ],
]);
$body = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErrno = curl_errno($ch);
curl_close($ch);

if ($body === false || $curlErrno !== 0 || $httpCode !== 200) {
    respond(['status' => 'error']);
}

$data = json_decode((string) $body, true);

if (!is_array($data) || !isset($data['count']) || !is_int($data['count'])) {
    respond(['status' => 'error']);
}

respond(['status' => 'ok', 'count' => $data['count']]);
