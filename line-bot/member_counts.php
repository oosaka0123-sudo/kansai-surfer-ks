<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60, s-maxage=60');
header('Access-Control-Allow-Origin: *');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$configPath = __DIR__ . '/config.php';
$statePath = __DIR__ . '/state.php';

if (!is_file($configPath)) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'config_missing']);
    exit;
}

$config = require $configPath;
if (!is_array($config)) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'config_invalid']);
    exit;
}

function ksAccessToken(array $config): ?string
{
    $direct = trim((string)($config['channel_access_token'] ?? ''));
    if ($direct !== '') {
        return $direct;
    }

    $channelId = trim((string)($config['channel_id'] ?? ''));
    $secret = trim((string)($config['channel_secret'] ?? ''));
    if ($channelId === '' || $secret === '') {
        return null;
    }

    $ch = curl_init('https://api.line.me/oauth2/v3/token');
    if ($ch === false) {
        return null;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'client_credentials',
            'client_id' => $channelId,
            'client_secret' => $secret,
        ], '', '&', PHP_QUERY_RFC3986),
    ]);

    $response = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if (!is_string($response) || $code < 200 || $code >= 300) {
        return null;
    }

    $decoded = json_decode($response, true);
    $token = is_array($decoded) ? trim((string)($decoded['access_token'] ?? '')) : '';
    return $token !== '' ? $token : null;
}

function ksLineGet(string $token, string $path): ?array
{
    $ch = curl_init('https://api.line.me' . $path);
    if ($ch === false) {
        return null;
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
    ]);

    $response = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if (!is_string($response) || $code < 200 || $code >= 300) {
        return null;
    }

    $decoded = json_decode($response, true);
    return is_array($decoded) ? $decoded : null;
}

function ksAlias(string $groupName): ?string
{
    $name = mb_strtolower(trim($groupName), 'UTF-8');

    $rules = [
        'buddy' => ['仲間探し', '仲間', '相乗り'],
        'isonoura' => ['磯ノ浦', 'いそのうら'],
        'kounohama' => ['国府の浜', '国府浜'],
        'ikumi' => ['生見', 'いくみ'],
        'komatsu' => ['小松海岸', '小松'],
        'irago' => ['伊良湖'],
        'shizunami' => ['静波'],
        'hamadutu' => ['浜詰'],
        'takahama' => ['高浜'],
        'hakuto' => ['白兎'],
    ];

    foreach ($rules as $alias => $needles) {
        foreach ($needles as $needle) {
            if (mb_strpos($name, mb_strtolower($needle, 'UTF-8')) !== false) {
                return $alias;
            }
        }
    }

    return null;
}

$state = is_file($statePath) ? require $statePath : [];
$groupIds = [];

if (is_array($state)) {
    foreach (($state['members'] ?? []) as $member) {
        if (!is_array($member) || !($member['active'] ?? false)) {
            continue;
        }

        $groupId = trim((string)($member['group_id'] ?? ''));
        if ($groupId !== '') {
            $groupIds[$groupId] = true;
        }
    }
}

$token = ksAccessToken($config);
if ($token === null) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'token_unavailable']);
    exit;
}

$counts = [];
foreach (array_keys($groupIds) as $groupId) {
    $encoded = rawurlencode($groupId);
    $summary = ksLineGet($token, '/v2/bot/group/' . $encoded . '/summary');
    if (!is_array($summary)) {
        continue;
    }

    $alias = ksAlias((string)($summary['groupName'] ?? ''));
    if ($alias === null || array_key_exists($alias, $counts)) {
        continue;
    }

    $countData = ksLineGet($token, '/v2/bot/group/' . $encoded . '/members/count');
    if (!is_array($countData)) {
        continue;
    }

    $count = filter_var($countData['count'] ?? null, FILTER_VALIDATE_INT);
    if ($count === false || $count < 0) {
        continue;
    }

    $counts[$alias] = $count;
}

echo json_encode([
    'ok' => true,
    'updated_at' => date(DATE_ATOM),
    'counts' => $counts,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
