<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    header('Content-Type: text/plain; charset=utf-8');
    echo "ok\n";
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit;
}

try {
    $config = ksConfig();
} catch (Throwable $e) {
    http_response_code(503);
    error_log('KS LINE bot: ' . $e->getMessage());
    exit;
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false) {
    http_response_code(400);
    exit;
}

$receivedSignature = (string)($_SERVER['HTTP_X_LINE_SIGNATURE'] ?? '');
$expectedSignature = base64_encode(
    hash_hmac('sha256', $rawBody, $config['channel_secret'], true)
);

if ($receivedSignature === '' || !hash_equals($expectedSignature, $receivedSignature)) {
    http_response_code(401);
    error_log('KS LINE bot: invalid webhook signature.');
    exit;
}

try {
    $payload = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    http_response_code(400);
    error_log('KS LINE bot: invalid JSON payload.');
    exit;
}

$welcomeText = <<<'TEXT'
🌊 参加ありがとうございます！

関西サーフィン・仲間探しへようこそ🏄

このグループは
🏄 サーフ仲間探し
🚗 相乗り募集
🏕️ サーフキャンプ・オフ会
など、実際につながるためのグループです。

参加された方は、
右上の「≡」→「ノート」→
「🏄 自己紹介はこちら 🌊」
から簡単な自己紹介をお願いします😊

⚠️ お願い
・営業、勧誘は禁止
・出会い目的のみの利用は禁止
・誹謗中傷、迷惑行為は禁止
・相乗りの費用や集合時間は事前に確認
・安全第一でお願いします

みんなで気持ちよく楽しめるグループにしていきましょう🤙

関西サーファーKS
TEXT;

foreach (($payload['events'] ?? []) as $event) {
    if (!is_array($event)) {
        continue;
    }

    $source = is_array($event['source'] ?? null) ? $event['source'] : [];
    if (($source['type'] ?? '') !== 'group') {
        continue;
    }

    $groupId = (string)($source['groupId'] ?? '');
    if ($groupId === '') {
        continue;
    }

    $type = (string)($event['type'] ?? '');

    if ($type === 'leave') {
        ksForgetGroup($groupId);
        continue;
    }

    ksRememberGroup($groupId);

    if ($type === 'memberJoined') {
        $replyToken = (string)($event['replyToken'] ?? '');
        if ($replyToken !== '') {
            ksReply($replyToken, [[
                'type' => 'text',
                'text' => $welcomeText,
            ]]);
        }
        continue;
    }

    if ($type !== 'postback') {
        continue;
    }

    $userId = (string)($source['userId'] ?? '');
    $data = (string)($event['postback']['data'] ?? '');
    if ($userId === '' || $data === '') {
        continue;
    }

    parse_str($data, $params);
    if (($params['ks_poll'] ?? '') !== 'destination') {
        continue;
    }

    $date = (string)($params['date'] ?? '');
    $spot = (string)($params['spot'] ?? '');

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !isset(ksSpots()[$spot])) {
        continue;
    }

    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Tokyo'));
    $voteDate = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('Asia/Tokyo'));
    if (!$voteDate instanceof DateTimeImmutable) {
        continue;
    }

    if ($voteDate < $today || $voteDate > $today->modify('+7 days')) {
        continue;
    }

    ksRegisterVote($groupId, $date, $userId, $spot);
}

http_response_code(200);
header('Content-Type: text/plain; charset=utf-8');
echo "ok\n";
