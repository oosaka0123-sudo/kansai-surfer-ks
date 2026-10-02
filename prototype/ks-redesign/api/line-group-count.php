<?php
// ============================================================================
// 「普通のグループチャット」の参加人数を LINE Messaging API から server-side で
// 取得するエンドポイント。ブラウザから直接 LINE API を呼ばないための中継。
//
// 秘密値（Channel access token, groupId）は config.secret.php（.gitignore済み、
// 未コミット）または環境変数 LINE_CHANNEL_ACCESS_TOKEN / LINE_GROUP_CHAT_GROUP_ID
// から読み込む。どちらも未設定の場合は status=unconfigured を返し、人数は
// 捏造しない。API呼び出しが失敗した場合も status=error を返すのみで、
// 固定人数や推測値への差し替えは行わない。
// ============================================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond_and_exit(array $payload) {
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$configFile = __DIR__ . '/config.secret.php';
$config = is_file($configFile) ? (require $configFile) : [];
if (!is_array($config)) {
    $config = [];
}

$token = $config['channel_access_token'] ?? (getenv('LINE_CHANNEL_ACCESS_TOKEN') ?: '');
$groupId = $config['group_chat_group_id'] ?? (getenv('LINE_GROUP_CHAT_GROUP_ID') ?: '');

if ($token === '' || $groupId === '') {
    respond_and_exit(['status' => 'unconfigured']);
}

if (!function_exists('curl_init')) {
    respond_and_exit(['status' => 'error']);
}

$ch = curl_init('https://api.line.me/v2/bot/group/' . rawurlencode($groupId) . '/members/count');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $token,
    ],
]);
$body = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErrno = curl_errno($ch);
curl_close($ch);

if ($body === false || $curlErrno !== 0 || $httpCode !== 200) {
    respond_and_exit(['status' => 'error']);
}

$data = json_decode($body, true);
if (!is_array($data) || !isset($data['count']) || !is_int($data['count'])) {
    respond_and_exit(['status' => 'error']);
}

respond_and_exit(['status' => 'ok', 'count' => $data['count']]);
