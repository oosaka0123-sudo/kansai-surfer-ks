<?php
declare(strict_types=1);

const KS_LINE_BOT_BOOTSTRAP = true;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    header('Content-Type: text/plain; charset=utf-8');
    echo "ok\n";
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(503);
    error_log('KS LINE bot: config.php is missing.');
    exit;
}

/** @var array{channel_id?:string,channel_secret?:string} $config */
$config = require $configPath;
$channelId = (string)($config['channel_id'] ?? '');
$channelSecret = (string)($config['channel_secret'] ?? '');

if ($channelId === '' || $channelSecret === '') {
    http_response_code(503);
    error_log('KS LINE bot: required credentials are not configured.');
    exit;
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false) {
    http_response_code(400);
    exit;
}

$receivedSignature = (string)($_SERVER['HTTP_X_LINE_SIGNATURE'] ?? '');
$expectedSignature = base64_encode(
    hash_hmac('sha256', $rawBody, $channelSecret, true)
);

if ($receivedSignature === '' || !hash_equals($expectedSignature, $receivedSignature)) {
    http_response_code(401);
    error_log('KS LINE bot: invalid webhook signature.');
    exit;
}

try {
    /** @var array{events?:array<int,array<string,mixed>>} $payload */
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
    if (($event['type'] ?? '') !== 'memberJoined') {
        continue;
    }

    if (($event['source']['type'] ?? '') !== 'group') {
        continue;
    }

    $replyToken = (string)($event['replyToken'] ?? '');
    if ($replyToken === '') {
        continue;
    }

    $channelAccessToken = issueStatelessToken($channelId, $channelSecret);
    if ($channelAccessToken === null) {
        continue;
    }

    replyText($channelAccessToken, $replyToken, $welcomeText);
}

http_response_code(200);
header('Content-Type: text/plain; charset=utf-8');
echo "ok\n";


function issueStatelessToken(string $channelId, string $channelSecret): ?string
{
    $ch = curl_init('https://api.line.me/oauth2/v3/token');
    if ($ch === false) {
        error_log('KS LINE bot: failed to initialize token cURL.');
        return null;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/x-www-form-urlencoded',
        ],
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'client_credentials',
            'client_id' => $channelId,
            'client_secret' => $channelSecret,
        ], '', '&', PHP_QUERY_RFC3986),
    ]);

    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $httpCode < 200 || $httpCode >= 300) {
        error_log(
            'KS LINE bot: token issue failed. http=' . $httpCode .
            ($curlError !== '' ? ' curl_error=' . $curlError : '')
        );
        return null;
    }

    try {
        $decoded = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        error_log('KS LINE bot: invalid token response JSON.');
        return null;
    }

    $accessToken = (string)($decoded['access_token'] ?? '');
    if ($accessToken === '') {
        error_log('KS LINE bot: token response did not contain access_token.');
        return null;
    }

    return $accessToken;
}

function replyText(string $channelAccessToken, string $replyToken, string $text): void
{
    $body = json_encode(
        [
            'replyToken' => $replyToken,
            'messages' => [
                [
                    'type' => 'text',
                    'text' => $text,
                ],
            ],
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    );

    $ch = curl_init('https://api.line.me/v2/bot/message/reply');
    if ($ch === false) {
        error_log('KS LINE bot: failed to initialize cURL.');
        return;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $channelAccessToken,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $body,
    ]);

    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $httpCode < 200 || $httpCode >= 300) {
        error_log(
            'KS LINE bot: reply failed. http=' . $httpCode .
            ($curlError !== '' ? ' curl_error=' . $curlError : '')
        );
    }
}
