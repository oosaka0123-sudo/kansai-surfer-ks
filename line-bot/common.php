<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Tokyo');

function ksConfig(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    $path = __DIR__ . '/config.php';
    if (!is_file($path)) {
        throw new RuntimeException('config.php is missing');
    }

    $loaded = require $path;
    if (!is_array($loaded)) {
        throw new RuntimeException('config.php must return an array');
    }

    $channelId = trim((string)($loaded['channel_id'] ?? ''));
    $channelSecret = trim((string)($loaded['channel_secret'] ?? ''));
    if ($channelId === '' || $channelSecret === '') {
        throw new RuntimeException('LINE credentials are incomplete');
    }

    $config = [
        'channel_id' => $channelId,
        'channel_secret' => $channelSecret,
    ];
    return $config;
}

function ksDataDir(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Failed to create data directory');
    }
    return $dir;
}

function ksUpdateJson(string $filename, callable $mutator): mixed
{
    $path = ksDataDir() . '/' . $filename;
    $fh = fopen($path, 'c+');
    if ($fh === false) {
        throw new RuntimeException('Failed to open state file');
    }

    try {
        if (!flock($fh, LOCK_EX)) {
            throw new RuntimeException('Failed to lock state file');
        }

        rewind($fh);
        $raw = stream_get_contents($fh);
        $data = [];
        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }

        [$next, $result] = $mutator($data);
        $json = json_encode(
            $next,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR
        );

        rewind($fh);
        if (!ftruncate($fh, 0)) {
            throw new RuntimeException('Failed to truncate state file');
        }
        if (fwrite($fh, $json . PHP_EOL) === false) {
            throw new RuntimeException('Failed to write state file');
        }
        fflush($fh);
        flock($fh, LOCK_UN);
        return $result;
    } finally {
        fclose($fh);
    }
}

function ksReadJson(string $filename): array
{
    $path = ksDataDir() . '/' . $filename;
    if (!is_file($path)) {
        return [];
    }

    $raw = file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function ksRememberGroup(string $groupId): void
{
    if ($groupId === '') {
        return;
    }

    ksUpdateJson('groups.json', static function (array $data) use ($groupId): array {
        $data['groups'] ??= [];
        $current = is_array($data['groups'][$groupId] ?? null) ? $data['groups'][$groupId] : [];
        $current['active'] = true;
        $current['first_seen'] ??= date(DATE_ATOM);
        $current['last_seen'] = date(DATE_ATOM);
        $data['groups'][$groupId] = $current;
        return [$data, null];
    });
}

function ksForgetGroup(string $groupId): void
{
    if ($groupId === '') {
        return;
    }

    ksUpdateJson('groups.json', static function (array $data) use ($groupId): array {
        $data['groups'] ??= [];
        $current = is_array($data['groups'][$groupId] ?? null) ? $data['groups'][$groupId] : [];
        $current['active'] = false;
        $current['last_seen'] = date(DATE_ATOM);
        $data['groups'][$groupId] = $current;
        return [$data, null];
    });
}

function ksActiveGroups(): array
{
    $data = ksReadJson('groups.json');
    $groups = [];
    foreach (($data['groups'] ?? []) as $groupId => $meta) {
        if (is_string($groupId) && is_array($meta) && ($meta['active'] ?? false) === true) {
            $groups[] = $groupId;
        }
    }
    return $groups;
}

function ksSpots(): array
{
    return [
        'isonoura' => '磯ノ浦',
        'ikumi' => '生見',
        'kokufu' => '国府の浜',
        'komatsu' => '小松',
        'ise' => '伊勢方面',
        'undecided' => '未定',
        'skip' => '行かない',
    ];
}

function ksAnonymousVoterKey(string $userId): string
{
    return hash_hmac('sha256', 'ks-destination-vote|' . $userId, ksConfig()['channel_secret']);
}

function ksRegisterVote(string $groupId, string $date, string $userId, string $spot): bool
{
    if (!isset(ksSpots()[$spot]) || $groupId === '' || $userId === '') {
        return false;
    }

    $voterKey = ksAnonymousVoterKey($userId);
    return (bool)ksUpdateJson('votes.json', static function (array $data) use ($groupId, $date, $voterKey, $spot): array {
        $data['votes'] ??= [];
        $data['votes'][$date] ??= [];
        $data['votes'][$date][$groupId] ??= [];
        $data['votes'][$date][$groupId][$voterKey] = [
            'spot' => $spot,
            'updated_at' => date(DATE_ATOM),
        ];
        return [$data, true];
    });
}

function ksTally(string $groupId, string $date): array
{
    $counts = array_fill_keys(array_keys(ksSpots()), 0);
    $data = ksReadJson('votes.json');
    $votes = $data['votes'][$date][$groupId] ?? [];

    if (is_array($votes)) {
        foreach ($votes as $vote) {
            if (!is_array($vote)) {
                continue;
            }
            $spot = (string)($vote['spot'] ?? '');
            if (array_key_exists($spot, $counts)) {
                $counts[$spot]++;
            }
        }
    }

    return $counts;
}

function ksWasSent(string $groupId, string $date, string $mode): bool
{
    $data = ksReadJson('sent.json');
    $key = $mode . '|' . $date . '|' . $groupId;
    return isset($data['sent'][$key]);
}

function ksMarkSent(string $groupId, string $date, string $mode): void
{
    ksUpdateJson('sent.json', static function (array $data) use ($groupId, $date, $mode): array {
        $data['sent'] ??= [];
        $key = $mode . '|' . $date . '|' . $groupId;
        $data['sent'][$key] = date(DATE_ATOM);
        return [$data, null];
    });
}

function ksIssueStatelessToken(): ?string
{
    $config = ksConfig();
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
            'client_id' => $config['channel_id'],
            'client_secret' => $config['channel_secret'],
        ], '', '&', PHP_QUERY_RFC3986),
    ]);

    $response = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if (!is_string($response) || $code < 200 || $code >= 300) {
        error_log('KS LINE bot: token issue failed http=' . $code . ($error !== '' ? ' error=' . $error : ''));
        return null;
    }

    $decoded = json_decode($response, true);
    $token = is_array($decoded) ? (string)($decoded['access_token'] ?? '') : '';
    return $token !== '' ? $token : null;
}

function ksLinePost(string $path, array $body): bool
{
    $token = ksIssueStatelessToken();
    if ($token === null) {
        return false;
    }

    $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $ch = curl_init('https://api.line.me' . $path);
    if ($ch === false) {
        return false;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $json,
    ]);

    $response = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($code < 200 || $code >= 300) {
        error_log(
            'KS LINE bot: LINE API failed path=' . $path . ' http=' . $code .
            ($error !== '' ? ' error=' . $error : '') .
            ' body=' . substr((string)$response, 0, 300)
        );
        return false;
    }

    return true;
}

function ksReply(string $replyToken, array $messages): bool
{
    if ($replyToken === '') {
        return false;
    }

    return ksLinePost('/v2/bot/message/reply', [
        'replyToken' => $replyToken,
        'messages' => array_slice($messages, 0, 5),
    ]);
}

function ksPush(string $to, array $messages): bool
{
    if ($to === '') {
        return false;
    }

    return ksLinePost('/v2/bot/message/push', [
        'to' => $to,
        'messages' => array_slice($messages, 0, 5),
    ]);
}

function ksPollMessage(string $date): array
{
    $dateObj = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('Asia/Tokyo'));
    $dateLabel = $dateObj instanceof DateTimeImmutable ? $dateObj->format('n/j') : $date;

    $contents = [
        [
            'type' => 'text',
            'text' => '明日どこ行く？',
            'weight' => 'bold',
            'size' => 'xl',
        ],
        [
            'type' => 'text',
            'text' => $dateLabel . ' の予定',
            'size' => 'sm',
            'color' => '#666666',
            'margin' => 'sm',
        ],
        [
            'type' => 'text',
            'text' => "匿名投票です。名前は表示しません。\n押し直すと行き先を変更できます。",
            'size' => 'sm',
            'color' => '#555555',
            'wrap' => true,
            'margin' => 'md',
        ],
    ];

    foreach (ksSpots() as $key => $label) {
        $contents[] = [
            'type' => 'button',
            'style' => $key === 'skip' ? 'secondary' : 'primary',
            'height' => 'sm',
            'margin' => 'sm',
            'action' => [
                'type' => 'postback',
                'label' => $label,
                'data' => http_build_query([
                    'ks_poll' => 'destination',
                    'date' => $date,
                    'spot' => $key,
                ], '', '&', PHP_QUERY_RFC3986),
            ],
        ];
    }

    return [
        'type' => 'flex',
        'altText' => '明日どこ行く？ 匿名投票',
        'contents' => [
            'type' => 'bubble',
            'body' => [
                'type' => 'box',
                'layout' => 'vertical',
                'contents' => $contents,
            ],
        ],
    ];
}

function ksSummaryText(string $groupId, string $date): string
{
    $dateObj = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('Asia/Tokyo'));
    $dateLabel = $dateObj instanceof DateTimeImmutable ? $dateObj->format('n/j') : $date;
    $counts = ksTally($groupId, $date);

    $lines = [$dateLabel . ' 明日の予定'];
    foreach (ksSpots() as $key => $label) {
        $lines[] = $label . '　' . (int)($counts[$key] ?? 0) . '人';
    }

    return implode("\n", $lines);
}

function ksSchedulerKey(): string
{
    return hash_hmac('sha256', 'ks-scheduler-v1', ksConfig()['channel_secret']);
}
