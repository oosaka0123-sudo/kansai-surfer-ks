<?php
declare(strict_types=1);

header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow, noarchive', true);
header('Content-Type: text/html; charset=utf-8');

const SETUP_PASSWORD_SHA256 = '507dc0ad6ce07ed4c5d11c4a9341444b68da3547d4a06e95749aca07c8927e62';
const WEBHOOK_URL = 'https://nami.rss7.net/ks-line-bot/webhook.php';

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function postForm(string $url, array $fields): array {
    $ch = curl_init($url);
    if ($ch === false) return [0, '', 'curl_init failed'];
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_POSTFIELDS => http_build_query($fields, '', '&', PHP_QUERY_RFC3986),
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return [$code, $body === false ? '' : $body, $err];
}

function lineJson(string $method, string $url, string $token, ?array $payload = null): array {
    $ch = curl_init($url);
    if ($ch === false) return [0, '', 'curl_init failed'];
    $headers = [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ];
    $opts = [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_HTTPHEADER => $headers,
    ];
    if ($payload !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
    curl_setopt_array($ch, $opts);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return [$code, $body === false ? '' : $body, $err];
}

$error = '';
$success = false;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $setupPassword = (string)($_POST['setup_password'] ?? '');
    $channelId = trim((string)($_POST['channel_id'] ?? ''));
    $channelSecret = trim((string)($_POST['channel_secret'] ?? ''));

    if (!hash_equals(SETUP_PASSWORD_SHA256, hash('sha256', $setupPassword))) {
        usleep(500000);
        $error = 'セットアップ用パスワードが違います。';
    } elseif (!preg_match('/^\d{6,20}$/', $channelId)) {
        $error = 'Channel IDの形式を確認してください。';
    } elseif (!preg_match('/^[A-Za-z0-9_-]{20,100}$/', $channelSecret)) {
        $error = 'Channel secretの形式を確認してください。';
    } else {
        [$tokenCode, $tokenBody, $tokenErr] = postForm(
            'https://api.line.me/oauth2/v3/token',
            [
                'grant_type' => 'client_credentials',
                'client_id' => $channelId,
                'client_secret' => $channelSecret,
            ]
        );

        $tokenData = json_decode($tokenBody, true);
        $accessToken = is_array($tokenData) ? (string)($tokenData['access_token'] ?? '') : '';

        if ($tokenCode !== 200 || $accessToken === '') {
            $error = 'LINE認証に失敗しました。Channel ID / Channel secretを確認してください。';
            error_log('KS LINE setup: token validation failed http=' . $tokenCode . ' err=' . $tokenErr);
        } else {
            [$endpointCode, , $endpointErr] = lineJson(
                'PUT',
                'https://api.line.me/v2/bot/channel/webhook/endpoint',
                $accessToken,
                ['endpoint' => WEBHOOK_URL]
            );

            if ($endpointCode < 200 || $endpointCode >= 300) {
                $error = 'Webhook URLの自動登録に失敗しました。';
                error_log('KS LINE setup: endpoint update failed http=' . $endpointCode . ' err=' . $endpointErr);
            } else {
                $config = [
                    'channel_id' => $channelId,
                    'channel_secret' => $channelSecret,
                ];
                $configText =
                    "<?php\n" .
                    "if (!defined('KS_LINE_BOT_BOOTSTRAP')) { http_response_code(404); exit; }\n" .
                    'return ' . var_export($config, true) . ";\n";

                $configPath = __DIR__ . '/config.php';
                $tmpPath = __DIR__ . '/config.php.tmp';

                if (file_put_contents($tmpPath, $configText, LOCK_EX) === false || !rename($tmpPath, $configPath)) {
                    @unlink($tmpPath);
                    $error = 'サーバー設定ファイルの保存に失敗しました。';
                } else {
                    @chmod($configPath, 0600);

                    [$testCode, , $testErr] = lineJson(
                        'POST',
                        'https://api.line.me/v2/bot/channel/webhook/test',
                        $accessToken,
                        null
                    );

                    if ($testCode < 200 || $testCode >= 300) {
                        error_log('KS LINE setup: webhook test returned http=' . $testCode . ' err=' . $testErr);
                    }

                    $success = true;
                    @unlink(__FILE__);
                }
            }
        }
    }
}
?>
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KS LINE Bot セットアップ</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#f5f7f9;margin:0;padding:24px;color:#17202a}
main{max-width:520px;margin:30px auto;background:#fff;padding:24px;border-radius:18px;box-shadow:0 8px 30px rgba(0,0,0,.08)}
h1{font-size:22px;margin-top:0}label{display:block;margin:16px 0 6px;font-weight:700}
input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #ccd3da;border-radius:10px;font-size:16px}
button{width:100%;margin-top:22px;padding:14px;border:0;border-radius:10px;background:#06c755;color:#fff;font-size:17px;font-weight:700}
.note{font-size:14px;color:#5f6b76;line-height:1.6}.err{background:#fff0f0;color:#a40000;padding:12px;border-radius:10px}.ok{background:#effcf3;color:#126b2d;padding:14px;border-radius:10px;line-height:1.7}
</style>
</head>
<body><main>
<?php if ($success): ?>
<h1>設定完了</h1>
<div class="ok">Webhook URLの登録とサーバー設定が完了しました。<br>このセットアップページは自動削除しました。<br><br>次はLINE Developersで「Webhookの利用」をONにするだけです。</div>
<?php else: ?>
<h1>KS LINE Bot 初回設定</h1>
<p class="note">このページは一度だけ使います。Channel secretはChatGPTには送らず、ここへ直接入力してください。成功するとこのページは自動削除されます。</p>
<?php if ($error !== ''): ?><div class="err"><?=h($error)?></div><?php endif; ?>
<form method="post" autocomplete="off">
<label>セットアップ用パスワード</label>
<input type="password" name="setup_password" required>
<label>Channel ID</label>
<input type="text" inputmode="numeric" name="channel_id" required>
<label>Channel secret</label>
<input type="password" name="channel_secret" required>
<button type="submit">安全に設定する</button>
</form>
<?php endif; ?>
</main></body></html>
