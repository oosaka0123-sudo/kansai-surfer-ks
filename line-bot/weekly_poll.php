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

if (!in_array($mode, ['poll', 'summary'], true)) {
    http_response_code(400);
    echo "invalid mode\n";
    exit;
}

try {
    $expectedKey = ksSchedulerKey();
} catch (Throwable $e) {
    http_response_code(503);
    error_log('KS LINE bot scheduler: ' . $e->getMessage());
    exit;
}

$receivedKey = (string)($_SERVER['HTTP_X_KS_SCHEDULER_KEY'] ?? '');
if ($receivedKey === '' || !hash_equals($expectedKey, $receivedKey)) {
    http_response_code(401);
    echo "unauthorized\n";
    exit;
}

$timezone = new DateTimeZone('Asia/Tokyo');
$now = new DateTimeImmutable('now', $timezone);
$requestedDate = trim((string)($_GET['date'] ?? ''));

if ($requestedDate !== '') {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $requestedDate)) {
        http_response_code(400);
        echo "invalid date\n";
        exit;
    }
    $targetDate = $requestedDate;
} else {
    $targetDate = $now->modify('+1 day')->format('Y-m-d');
}

$groups = ksActiveGroups();
$result = [
    'ok' => true,
    'mode' => $mode,
    'date' => $targetDate,
    'active_groups' => count($groups),
    'sent' => 0,
    'skipped' => 0,
    'failed' => 0,
];

foreach ($groups as $groupId) {
    if (ksWasSent($groupId, $targetDate, $mode)) {
        $result['skipped']++;
        continue;
    }

    if ($mode === 'poll') {
        $messages = [ksPollMessage($targetDate)];
    } else {
        $messages = [[
            'type' => 'text',
            'text' => ksSummaryText($groupId, $targetDate),
        ]];
    }

    if (ksPush($groupId, $messages)) {
        ksMarkSent($groupId, $targetDate, $mode);
        $result['sent']++;
    } else {
        $result['failed']++;
    }
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
