<?php
declare(strict_types=1);

const KS_LINE_BOT_BOOTSTRAP = true;
const KS_RELAY_ENDPOINT = 'https://nami.rss7.net/ks-line-bot/relay.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit;
}

$cronKeyPath = __DIR__ . '/cron_key.php';
$configPath = __DIR__ . '/config.php';

if (!is_file($cronKeyPath) || !is_file($configPath)) {
    http_response_code(503);
    echo "runtime config missing\n";
    exit;
}

$cronKey = require $cronKeyPath;
$expectedHash = is_array($cronKey) ? (string)($cronKey['token_hash'] ?? '') : '';
$provided = (string)($_POST['cron_token'] ?? '');

if ($expectedHash === '' || $provided === ''
    || !hash_equals($expectedHash, hash('sha256', $provided))) {
    http_response_code(401);
    echo "unauthorized\n";
    exit;
}

$config = require $configPath;
$accessToken = is_array($config) ? trim((string)($config['channel_access_token'] ?? '')) : '';
if ($accessToken === '') {
    http_response_code(503);
    echo "access token missing\n";
    exit;
}

$body = json_encode(
    ['endpoint' => KS_RELAY_ENDPOINT],
    JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
);

$ch = curl_init('https://api.line.me/v2/bot/channel/webhook/endpoint');
if ($ch === false) {
    http_response_code(500);
    exit;
}

curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => 'PUT',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => $body,
]);

$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

if ($response === false || $httpCode < 200 || $httpCode >= 300) {
    http_response_code(502);
    echo "endpoint update failed http={$httpCode}\n";
    exit;
}

$check = curl_init('https://api.line.me/v2/bot/channel/webhook/endpoint');
if ($check === false) {
    http_response_code(500);
    exit;
}

curl_setopt_array($check, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $accessToken,
    ],
]);

$checkResponse = curl_exec($check);
$checkCode = (int)curl_getinfo($check, CURLINFO_RESPONSE_CODE);
curl_close($check);

if ($checkResponse === false || $checkCode < 200 || $checkCode >= 300) {
    http_response_code(502);
    echo "endpoint verification failed\n";
    exit;
}

$decoded = json_decode($checkResponse, true);
$current = is_array($decoded) ? (string)($decoded['endpoint'] ?? '') : '';

if ($current !== KS_RELAY_ENDPOINT) {
    http_response_code(502);
    echo "endpoint mismatch\n";
    exit;
}

header('Content-Type: text/plain; charset=utf-8');
echo "ok\n";
