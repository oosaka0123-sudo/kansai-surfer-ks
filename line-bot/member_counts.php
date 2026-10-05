<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60, s-maxage=60');
header('Access-Control-Allow-Origin: *');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

function ksLineGetJson(string $path): ?array
{
    $token = ksIssueStatelessToken();
    if ($token === null) {
        return null;
    }

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

function ksGroupAlias(string $groupName): ?string
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

$counts = [];
$matched = [];
$groups = ksActiveGroups();

foreach ($groups as $groupId) {
    $encoded = rawurlencode($groupId);

    $summary = ksLineGetJson('/v2/bot/group/' . $encoded . '/summary');
    if (!is_array($summary)) {
        continue;
    }

    $groupName = (string)($summary['groupName'] ?? '');
    $alias = ksGroupAlias($groupName);
    if ($alias === null || isset($matched[$alias])) {
        continue;
    }

    $countData = ksLineGetJson('/v2/bot/group/' . $encoded . '/members/count');
    if (!is_array($countData)) {
        continue;
    }

    $count = filter_var($countData['count'] ?? null, FILTER_VALIDATE_INT);
    if ($count === false || $count < 0) {
        continue;
    }

    $counts[$alias] = $count;
    $matched[$alias] = true;
}

echo json_encode([
    'ok' => true,
    'updated_at' => date(DATE_ATOM),
    'counts' => $counts,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
