<?php
declare(strict_types=1);

const KS_LINE_BOT_BOOTSTRAP = true;
const KS_RELAY_PRIMARY = 'https://kansai.rss7.net/line/webhook.php';
const KS_RELAY_SECONDARY = 'https://nami.rss7.net/ks-line-bot/webhook.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    header('Content-Type: text/plain; charset=utf-8');
    echo "ok\n";
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit;
}

if (isset($_GET['selftest'])) {
    runSelfTest();
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(503);
    error_log('KS LINE relay: config.php missing.');
    exit;
}

$config = require $configPath;
$channelSecret = is_array($config) ? (string)($config['channel_secret'] ?? '') : '';
if ($channelSecret === '') {
    http_response_code(503);
    error_log('KS LINE relay: channel secret missing.');
    exit;
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false || $rawBody === '') {
    http_response_code(400);
    exit;
}

$signature = (string)($_SERVER['HTTP_X_LINE_SIGNATURE'] ?? '');
$expected = base64_encode(hash_hmac('sha256', $rawBody, $channelSecret, true));

if ($signature === '' || !hash_equals($expected, $signature)) {
    http_response_code(401);
    error_log('KS LINE relay: invalid signature.');
    exit;
}

$results = forwardWebhook($rawBody, $signature);

$primaryCode = (int)($results[KS_RELAY_PRIMARY]['http_code'] ?? 0);
$secondaryCode = (int)($results[KS_RELAY_SECONDARY]['http_code'] ?? 0);

if ($secondaryCode < 200 || $secondaryCode >= 300) {
    error_log('KS LINE relay: secondary failed http=' . $secondaryCode);
}

if ($primaryCode < 200 || $primaryCode >= 300) {
    error_log('KS LINE relay: primary failed http=' . $primaryCode);
    http_response_code(502);
    echo "primary failed\n";
    exit;
}

http_response_code(200);
header('Content-Type: text/plain; charset=utf-8');
echo "ok\n";

function runSelfTest(): void
{
    $cronKeyPath = __DIR__ . '/cron_key.php';
    $configPath = __DIR__ . '/config.php';

    if (!is_file($cronKeyPath) || !is_file($configPath)) {
        http_response_code(503);
        echo "runtime config missing\n";
        return;
    }

    $cronKey = require $cronKeyPath;
    $expectedHash = is_array($cronKey) ? (string)($cronKey['token_hash'] ?? '') : '';
    $provided = (string)($_POST['cron_token'] ?? '');

    if ($expectedHash === '' || $provided === ''
        || !hash_equals($expectedHash, hash('sha256', $provided))) {
        http_response_code(401);
        echo "unauthorized\n";
        return;
    }

    $config = require $configPath;
    $channelSecret = is_array($config) ? (string)($config['channel_secret'] ?? '') : '';
    if ($channelSecret === '') {
        http_response_code(503);
        echo "channel secret missing\n";
        return;
    }

    $body = '{"destination":"ks-relay-selftest","events":[]}';
    $signature = base64_encode(hash_hmac('sha256', $body, $channelSecret, true));
    $results = forwardWebhook($body, $signature);

    $primary = (int)($results[KS_RELAY_PRIMARY]['http_code'] ?? 0);
    $secondary = (int)($results[KS_RELAY_SECONDARY]['http_code'] ?? 0);

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        [
            'primary' => $primary,
            'secondary' => $secondary,
            'ok' => $primary >= 200 && $primary < 300
                && $secondary >= 200 && $secondary < 300,
        ],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    ) . "\n";
}

function forwardWebhook(string $body, string $signature): array
{
    $urls = [KS_RELAY_PRIMARY, KS_RELAY_SECONDARY];
    $multi = curl_multi_init();
    $handles = [];

    foreach ($urls as $url) {
        $ch = curl_init($url);
        if ($ch === false) {
            continue;
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-Line-Signature: ' . $signature,
                'User-Agent: KS-LINE-Relay/1.0',
            ],
            CURLOPT_POSTFIELDS => $body,
        ]);

        curl_multi_add_handle($multi, $ch);
        $handles[$url] = $ch;
    }

    do {
        $status = curl_multi_exec($multi, $running);
        if ($status !== CURLM_OK) {
            break;
        }
        if ($running > 0) {
            curl_multi_select($multi, 1.0);
        }
    } while ($running > 0);

    $results = [];
    foreach ($handles as $url => $ch) {
        $response = curl_multi_getcontent($ch);
        $results[$url] = [
            'http_code' => (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE),
            'response' => is_string($response) ? $response : '',
            'error' => curl_error($ch),
        ];
        curl_multi_remove_handle($multi, $ch);
        curl_close($ch);
    }

    curl_multi_close($multi);
    return $results;
}
