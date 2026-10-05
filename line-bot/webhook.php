<?php
/**
 * LINE Webhook receiver for 関西サーファーKS
 *
 * Existing behavior preserved:
 * - save LINE image/video posts for the KS site.
 *
 * Added behavior:
 * - remember normal LINE groups the bot is in;
 * - receive anonymous "明日どこ行く？" postback votes.
 */

declare(strict_types=1);

require_once __DIR__ . '/common.php';

date_default_timezone_set('Asia/Tokyo');

$dataFile  = __DIR__ . '/../data/line_posts.json';
$uploadDir = __DIR__ . '/../uploads/line/';
$logFile   = __DIR__ . '/../data/line_webhook.log';

$maxPosts = 1000;
$allowedTypes = ['image', 'video'];

function line_log(string $message): void
{
    global $logFile;
    $dir = dirname($logFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    @error_log(date('c') . ' ' . $message . PHP_EOL, 3, $logFile);
}

function json_response(int $statusCode, string $message): never
{
    http_response_code($statusCode);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

function read_posts(string $dataFile): array
{
    if (!is_file($dataFile)) {
        return [];
    }

    $json = file_get_contents($dataFile);
    $posts = json_decode($json ?: '[]', true);
    return is_array($posts) ? $posts : [];
}

function save_posts(string $dataFile, array $posts): bool
{
    $dir = dirname($dataFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    $json = json_encode(
        $posts,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
    );
    if ($json === false) {
        return false;
    }

    return file_put_contents($dataFile, $json, LOCK_EX) !== false;
}

function detect_extension(string $type, string $binary, string $fallback): string
{
    if ($type === 'image') {
        $info = @getimagesizefromstring($binary);
        if (is_array($info) && !empty($info['mime'])) {
            return match ($info['mime']) {
                'image/jpeg' => 'jpg',
                'image/png'  => 'png',
                'image/webp' => 'webp',
                'image/gif'  => 'gif',
                default      => $fallback,
            };
        }
    }

    return $fallback;
}

function download_line_content(string $messageId, string $accessToken): array
{
    $url = 'https://api-data.line.me/v2/bot/message/' . rawurlencode($messageId) . '/content';

    $ch = curl_init($url);
    if ($ch === false) {
        return [false, '', 0, 'curl init failed'];
    }

    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HEADER => true,
    ]);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if ($response === false) {
        return [false, '', $httpCode, 'curl error: ' . $curlError];
    }

    $body = substr((string)$response, $headerSize);
    if ($httpCode !== 200 || $body === '') {
        return [false, '', $httpCode, 'download failed'];
    }

    return [true, $body, $httpCode, ''];
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    json_response(200, "LINE webhook.php OK\n");
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(405, 'Method Not Allowed');
}

try {
    $config = ksConfig();
} catch (Throwable $e) {
    line_log('config error: ' . $e->getMessage());
    json_response(500, 'LINE config error');
}

$channelSecret = (string)$config['channel_secret'];
$accessToken = (string)$config['channel_access_token'];

if ($accessToken === '') {
    $issued = ksIssueStatelessToken();
    $accessToken = $issued ?? '';
}

if ($channelSecret === '' || $accessToken === '') {
    line_log('missing channel secret or access token');
    json_response(500, 'LINE config error');
}

$body = file_get_contents('php://input') ?: '';
$signature = (string)($_SERVER['HTTP_X_LINE_SIGNATURE'] ?? '');

if ($body === '' || $signature === '') {
    line_log('empty body or signature');
    json_response(400, 'Bad Request');
}

$hash = base64_encode(hash_hmac('sha256', $body, $channelSecret, true));
if (!hash_equals($hash, $signature)) {
    line_log('invalid signature');
    json_response(403, 'Invalid signature');
}

$json = json_decode($body, true);
if (!is_array($json) || !isset($json['events']) || !is_array($json['events'])) {
    json_response(200, 'No events');
}

$posts = null;
$postsChanged = false;

foreach ($json['events'] as $event) {
    if (!is_array($event)) {
        continue;
    }

    $source = is_array($event['source'] ?? null) ? $event['source'] : [];
    $sourceType = (string)($source['type'] ?? '');
    $groupId = $sourceType === 'group' ? (string)($source['groupId'] ?? '') : '';
    $eventType = (string)($event['type'] ?? '');

    if ($sourceType === 'group' && $groupId !== '') {
        if ($eventType === 'leave') {
            ksForgetGroup($groupId);
        } else {
            ksRememberGroup($groupId);
        }
    }

    if ($eventType === 'postback' && $sourceType === 'group' && $groupId !== '') {
        $userId = (string)($source['userId'] ?? '');
        $postbackData = (string)($event['postback']['data'] ?? '');

        if ($userId !== '' && $postbackData !== '') {
            parse_str($postbackData, $params);

            if (($params['ks_poll'] ?? '') === 'destination') {
                $date = (string)($params['date'] ?? '');
                $spot = (string)($params['spot'] ?? '');

                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && isset(ksSpots()[$spot])) {
                    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Tokyo'));
                    $voteDate = DateTimeImmutable::createFromFormat(
                        '!Y-m-d',
                        $date,
                        new DateTimeZone('Asia/Tokyo')
                    );

                    if (
                        $voteDate instanceof DateTimeImmutable &&
                        $voteDate >= $today &&
                        $voteDate <= $today->modify('+7 days')
                    ) {
                        ksRegisterVote($groupId, $date, $userId, $spot);
                    }
                }
            }
        }

        continue;
    }

    if ($eventType !== 'message') {
        continue;
    }

    $message = is_array($event['message'] ?? null) ? $event['message'] : [];
    $type = (string)($message['type'] ?? '');

    if (!in_array($type, $allowedTypes, true)) {
        continue;
    }

    if ($posts === null) {
        if (!is_dir(dirname($dataFile))) {
            @mkdir(dirname($dataFile), 0755, true);
        }
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0755, true);
        }
        $posts = read_posts($dataFile);
    }

    $messageId = (string)($message['id'] ?? '');
    $userId = (string)($source['userId'] ?? '');

    $post = [
        'id' => date('YmdHis') . '_' . bin2hex(random_bytes(4)),
        'created_at' => date('Y-m-d H:i:s'),
        'user_id' => $userId,
        'source_type' => $sourceType,
        'type' => $type,
        'text' => $type === 'image' ? '画像投稿' : '動画投稿',
        'file' => '',
        'file_name' => '',
        'file_size' => 0,
        'message_id' => $messageId,
        'status' => 'pending',
        'file_deleted' => false,
    ];

    if ($messageId === '') {
        $post['status'] = 'error';
        $post['text'] = 'message id missing';
        array_unshift($posts, $post);
        $postsChanged = true;
        continue;
    }

    [$ok, $fileData, $httpCode, $error] = download_line_content($messageId, $accessToken);
    if (!$ok) {
        $post['status'] = 'error';
        $post['text'] = $type . ' download failed. HTTP: ' . $httpCode;
        $post['error'] = $error;
        array_unshift($posts, $post);
        $postsChanged = true;
        line_log(
            'download failed message_id=' . $messageId .
            ' http=' . $httpCode .
            ' error=' . $error
        );
        continue;
    }

    $fallbackExt = $type === 'image' ? 'jpg' : 'mp4';
    $ext = detect_extension($type, $fileData, $fallbackExt);
    $filename = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $savePath = $uploadDir . $filename;

    if (file_put_contents($savePath, $fileData, LOCK_EX) === false) {
        $post['status'] = 'error';
        $post['text'] = 'file save failed';
        array_unshift($posts, $post);
        $postsChanged = true;
        line_log('file save failed: ' . $savePath);
        continue;
    }

    @chmod($savePath, 0644);

    $post['file'] = '/uploads/line/' . $filename;
    $post['file_name'] = $filename;
    $post['file_size'] = filesize($savePath) ?: strlen($fileData);
    $post['status'] = 'pending';

    array_unshift($posts, $post);
    $postsChanged = true;
}

if ($postsChanged && is_array($posts)) {
    $posts = array_slice($posts, 0, $maxPosts);
    if (!save_posts($dataFile, $posts)) {
        line_log('line_posts.json save failed');
        json_response(500, 'Save failed');
    }
}

json_response(200, 'OK');
