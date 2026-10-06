<?php
declare(strict_types=1);

header('Cache-Control: no-store, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow, noarchive', true);
header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

const EXPECTED_CHANNEL_ID = '2011871559';
const EXPECTED_BASIC_ID = '@051zoffk';
const TARGET_WEBHOOK = 'https://nami.rss7.net/ks-line-bot/webhook.php';

function postForm(string $url, array $fields): array
{
    $ch = curl_init($url);
    if ($ch === false) {
        return [0, '', 'curl_init failed'];
    }
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

function lineRequest(string $method, string $url, string $token, ?array $payload = null): array
{
    $ch = curl_init($url);
    if ($ch === false) {
        return [0, '', 'curl_init failed'];
    }

    $headers = ['Authorization: Bearer ' . $token];
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
    }

    $opts = [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_HTTPHEADER => $headers,
    ];
    if ($payload !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode(
            $payload,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
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
$confirmedName = '';
$adminCode = '';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $channelSecret = trim((string)($_POST['channel_secret'] ?? ''));

    if (!preg_match('/^[A-Za-z0-9_-]{20,100}$/', $channelSecret)) {
        $error = 'Channel secret の形式を確認してください。';
    } else {
        [$tokenCode, $tokenBody, $tokenErr] = postForm(
            'https://api.line.me/oauth2/v3/token',
            [
                'grant_type' => 'client_credentials',
                'client_id' => EXPECTED_CHANNEL_ID,
                'client_secret' => $channelSecret,
            ]
        );

        $tokenData = json_decode($tokenBody, true);
        $accessToken = is_array($tokenData) ? (string)($tokenData['access_token'] ?? '') : '';

        if ($tokenCode !== 200 || $accessToken === '') {
            $error = 'LINE認証に失敗しました。仲間探しBOTの Channel secret か確認してください。';
            error_log('KS LINE repair: token validation failed http=' . $tokenCode . ' err=' . $tokenErr);
        } else {
            [$infoCode, $infoBody, $infoErr] = lineRequest(
                'GET',
                'https://api.line.me/v2/bot/info',
                $accessToken
            );
            $info = json_decode($infoBody, true);
            $basicId = is_array($info) ? (string)($info['basicId'] ?? '') : '';
            $displayName = is_array($info) ? (string)($info['displayName'] ?? '') : '';

            if ($infoCode !== 200 || $basicId !== EXPECTED_BASIC_ID) {
                $error = '別のLINE公式アカウントです。@051zoffk の Channel secret を入力してください。';
                error_log('KS LINE repair: wrong bot identity http=' . $infoCode . ' err=' . $infoErr);
            } else {
                [$endpointCode, , $endpointErr] = lineRequest(
                    'PUT',
                    'https://api.line.me/v2/bot/channel/webhook/endpoint',
                    $accessToken,
                    ['endpoint' => TARGET_WEBHOOK]
                );

                if ($endpointCode < 200 || $endpointCode >= 300) {
                    $error = 'Webhook URL の設定に失敗しました。';
                    error_log('KS LINE repair: endpoint update failed http=' . $endpointCode . ' err=' . $endpointErr);
                } else {
                    $config = [
                        'channel_id' => EXPECTED_CHANNEL_ID,
                        'channel_secret' => $channelSecret,
                    ];
                    $configText =
                        "<?php\n" .
                        "if (!defined('KS_LINE_BOT_BOOTSTRAP')) { http_response_code(404); exit; }\n" .
                        'return ' . var_export($config, true) . ";\n";

                    $configPath = __DIR__ . '/config.php';
                    $tmpPath = __DIR__ . '/config.php.tmp';

                    if (file_put_contents($tmpPath, $configText, LOCK_EX) === false
                        || !rename($tmpPath, $configPath)) {
                        @unlink($tmpPath);
                        $error = 'サーバー設定の保存に失敗しました。';
                    } else {
                        @chmod($configPath, 0600);

                        $adminCode = strtoupper(bin2hex(random_bytes(4)));
                        $adminHash = hash('sha256', $adminCode);
                        $adminSetupPath = __DIR__ . '/admin_setup.php';
                        $adminSetupText =
                            "<?php\n" .
                            "if (!defined('KS_LINE_BOT_BOOTSTRAP')) { http_response_code(404); exit; }\n" .
                            "return ['code_hash' => '" . $adminHash . "'];\n";

                        if (file_put_contents($adminSetupPath, $adminSetupText, LOCK_EX) === false) {
                            $error = '管理者登録コードの作成に失敗しました。';
                        } else {
                            @chmod($adminSetupPath, 0600);

                            [$testCode, , $testErr] = lineRequest(
                                'POST',
                                'https://api.line.me/v2/bot/channel/webhook/test',
                                $accessToken
                            );
                            if ($testCode < 200 || $testCode >= 300) {
                                error_log('KS LINE repair: webhook test http=' . $testCode . ' err=' . $testErr);
                            }

                            $confirmedName = $displayName;
                            $success = true;
                            @unlink(__FILE__);
                        }
                    }
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
<title>仲間探しBOT 修復</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#eef6ff;color:#18212f;margin:0;padding:24px}
.card{max-width:520px;margin:28px auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.08)}
h1{font-size:22px;margin:0 0 10px}.sub{color:#58677a;line-height:1.6;margin-bottom:20px}
label{display:block;font-weight:700;margin:16px 0 6px}
input{box-sizing:border-box;width:100%;font-size:16px;padding:12px;border:1px solid #bdc9d8;border-radius:10px}
button{width:100%;margin-top:20px;padding:14px;border:0;border-radius:12px;background:#1877f2;color:#fff;font-size:17px;font-weight:700}
.error{background:#fff1f1;color:#a51d1d;padding:12px;border-radius:10px;margin:12px 0}
.ok{background:#edfff2;color:#11652c;padding:16px;border-radius:12px;line-height:1.7}
.note{font-size:13px;color:#64748b;margin-top:14px;line-height:1.6}
</style>
</head>
<body>
<div class="card">
<?php if ($success): ?>
  <h1>✅ 修復完了</h1>
  <div class="ok">
    <?= htmlspecialchars($confirmedName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?> を確認しました。<br>
    Webhookも仲間探しBOT用に設定しました。<br><br>
    管理者登録コード：<strong><?= htmlspecialchars($adminCode, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></strong><br>
    LINEの1:1トークで「管理者登録 <?= htmlspecialchars($adminCode, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?>」と送信してください。<br><br>
    この設定ページは自動削除されました。
  </div>
<?php else: ?>
  <h1>関西サーファーKS｜仲間探しBOT</h1>
  <div class="sub">間違った公式アカウント設定を修復します。秘密情報はこのサーバー内で検証し、チャットには送信しません。</div>
  <?php if ($error !== ''): ?>
    <div class="error"><?= htmlspecialchars($error, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></div>
  <?php endif; ?>
  <form method="post" autocomplete="off">
    <label>Channel ID</label>
    <input value="<?= EXPECTED_CHANNEL_ID ?>" readonly>

    <label>仲間探しBOTの Channel secret</label>
    <input name="channel_secret" type="password" required autocomplete="off">

    <button type="submit">仲間探しBOTを修復</button>
  </form>
  <div class="note">対象は Basic ID <?= EXPECTED_BASIC_ID ?> だけに限定しています。別のLINE公式アカウントのsecretでは保存されません。</div>
<?php endif; ?>
</div>
</body>
</html>
