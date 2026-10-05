<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    exit;
}

$mode = (string)($_GET['mode'] ?? '');
if ($mode === '') {
    header('Content-Type: text/plain; charset=utf-8');
    echo "ok\n";
    exit;
}

if ($mode !== 'auto') {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "invalid mode\n";
    exit;
}

$timezone = new DateTimeZone('Asia/Tokyo');
$now = new DateTimeImmutable('now', $timezone);

$result = [
    'ok' => true,
    'now' => $now->format(DATE_ATOM),
    'mode' => 'auto',
    'action' => 'none',
    'date' => null,
    'active_groups' => 0,
    'sent' => 0,
    'skipped' => 0,
    'failed' => 0,
];

if ($now->format('N') !== '6') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    exit;
}

$hour = (int)$now->format('G');
$action = match ($hour) {
    19 => 'poll',
    21 => 'summary',
    default => null,
};

if ($action === null) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    exit;
}

$targetDate = $now->modify('+1 day')->format('Y-m-d');
$groups = ksActiveGroups();

$result['action'] = $action;
$result['date'] = $targetDate;
$result['active_groups'] = count($groups);

foreach ($groups as $groupId) {
    if (ksWasSent($groupId, $targetDate, $action)) {
        $result['skipped']++;
        continue;
    }

    $messages = $action === 'poll'
        ? [ksPollMessage($targetDate)]
        : [[
            'type' => 'text',
            'text' => ksSummaryText($groupId, $targetDate),
        ]];

    if (ksPush($groupId, $messages)) {
        ksMarkSent($groupId, $targetDate, $action);
        $result['sent']++;
    } else {
        $result['failed']++;
    }
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(
    $result,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
) . "\n";
