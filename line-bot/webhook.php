<?php
declare(strict_types=1);

const KS_LINE_BOT_BOOTSTRAP = true;
const KS_ADMIN_SETUP_CODE_HASH = '378e269f0f958bd62609f5b35f567a95db2d9a0138f3bf147e35dcff595400d9';
const KS_NOTE_BATCH_SIZE = 20;
const KS_NOTE_MAX_AGE_DAYS = 30;
const KS_STATE_FILE = __DIR__ . '/state.php';
const KS_STATE_LOCK = __DIR__ . '/.state.lock';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    header('Content-Type: text/plain; charset=utf-8');
    echo "ok\n";
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(503);
    error_log('KS LINE bot: config.php is missing.');
    exit;
}

/** @var array{channel_id?:string,channel_secret?:string} $config */
$config = require $configPath;
$channelId = (string)($config['channel_id'] ?? '');
$channelSecret = (string)($config['channel_secret'] ?? '');

if ($channelId === '' || $channelSecret === '') {
    http_response_code(503);
    error_log('KS LINE bot: required credentials are not configured.');
    exit;
}

if (isset($_GET['cron'])) {
    handleCronRequest($channelId, $channelSecret);
    exit;
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false) {
    http_response_code(400);
    exit;
}

$receivedSignature = (string)($_SERVER['HTTP_X_LINE_SIGNATURE'] ?? '');
$expectedSignature = base64_encode(hash_hmac('sha256', $rawBody, $channelSecret, true));

if ($receivedSignature === '' || !hash_equals($expectedSignature, $receivedSignature)) {
    http_response_code(401);
    error_log('KS LINE bot: invalid webhook signature.');
    exit;
}

try {
    /** @var array{events?:array<int,array<string,mixed>>} $payload */
    $payload = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    http_response_code(400);
    error_log('KS LINE bot: invalid JSON payload.');
    exit;
}

$accessToken = issueStatelessToken($channelId, $channelSecret);

foreach (($payload['events'] ?? []) as $event) {
    handleLineEvent($event, $accessToken);
}

http_response_code(200);
header('Content-Type: text/plain; charset=utf-8');
echo "ok\n";

function handleLineEvent(array $event, ?string $accessToken): void
{
    $type = (string)($event['type'] ?? '');
    $sourceType = (string)($event['source']['type'] ?? '');
    $groupId = (string)($event['source']['groupId'] ?? '');
    $sourceUserId = (string)($event['source']['userId'] ?? '');
    $replyToken = (string)($event['replyToken'] ?? '');

    if ($type === 'memberJoined' && $sourceType === 'group' && $groupId !== '') {
        $joinedMembers = $event['joined']['members'] ?? [];
        $now = nowIso();

        [$lock, $state] = lockAndLoadState();
        foreach ($joinedMembers as $member) {
            if (($member['type'] ?? '') !== 'user') {
                continue;
            }
            $userId = (string)($member['userId'] ?? '');
            if ($userId === '') {
                continue;
            }

            $displayName = '';
            if ($accessToken !== null) {
                $profile = getGroupMemberProfile($accessToken, $groupId, $userId);
                $displayName = (string)($profile['displayName'] ?? '');
            }

            upsertMember($state, $groupId, $userId, $displayName, $now);
        }
        saveAndUnlockState($lock, $state);

        if ($accessToken !== null && $replyToken !== '') {
            replyMessages($accessToken, $replyToken, [welcomeText()]);
        }
        return;
    }

    if ($type === 'memberLeft' && $sourceType === 'group' && $groupId !== '') {
        [$lock, $state] = lockAndLoadState();
        foreach (($event['left']['members'] ?? []) as $member) {
            if (($member['type'] ?? '') !== 'user') {
                continue;
            }
            $userId = (string)($member['userId'] ?? '');
            if ($userId === '') {
                continue;
            }
            $key = memberKey($groupId, $userId);
            if (isset($state['members'][$key])) {
                $state['members'][$key]['active'] = false;
                $state['members'][$key]['left_at'] = nowIso();
            }
        }
        saveAndUnlockState($lock, $state);
        return;
    }

    if ($type === 'unsend' && $sourceType === 'group' && $groupId !== '') {
        $messageId = (string)($event['unsend']['messageId'] ?? '');
        if ($messageId !== '') {
            [$lock, $state] = lockAndLoadState();
            foreach ($state['members'] as &$member) {
                if (($member['group_id'] ?? '') !== $groupId) {
                    continue;
                }
                if (($member['intro']['message_id'] ?? '') === $messageId) {
                    $member['intro']['active'] = false;
                    $member['intro']['unsent_at'] = nowIso();
                    $member['intro']['note_reflected'] = false;
                    $member['intro']['pending_batch_id'] = null;
                }
            }
            unset($member);
            recalculateNotificationFlags($state);
            saveAndUnlockState($lock, $state);
        }
        return;
    }

    if ($type !== 'message' || ($event['message']['type'] ?? '') !== 'text') {
        return;
    }

    $text = trim((string)($event['message']['text'] ?? ''));
    $messageId = (string)($event['message']['id'] ?? '');

    if ($sourceType === 'user' && $sourceUserId !== '') {
        handleDirectCommand($sourceUserId, $text, $replyToken, $accessToken);
        return;
    }

    if ($sourceType !== 'group' || $groupId === '' || $sourceUserId === '') {
        return;
    }

    $displayName = '';
    if ($accessToken !== null) {
        $profile = getGroupMemberProfile($accessToken, $groupId, $sourceUserId);
        $displayName = (string)($profile['displayName'] ?? '');
    }

    [$lock, $state] = lockAndLoadState();
    upsertMember($state, $groupId, $sourceUserId, $displayName, nowIso());

    $isIntro = containsIntroTag($text);
    if ($isIntro) {
        $cleanText = cleanIntroText($text);
        $key = memberKey($groupId, $sourceUserId);
        $state['members'][$key]['intro'] = [
            'text' => mb_substr($cleanText, 0, 1000),
            'message_id' => $messageId,
            'submitted_at' => nowIso(),
            'active' => true,
            'note_reflected' => false,
            'pending_batch_id' => null,
        ];
        recalculateNotificationFlags($state);
    }

    saveAndUnlockState($lock, $state);

    if ($isIntro && $accessToken !== null && $replyToken !== '') {
        $name = $displayName !== '' ? $displayName : '参加者';
        replyMessages(
            $accessToken,
            $replyToken,
            ["✅ {$name}さん\n自己紹介ありがとうございます！\n登録しました🤙"]
        );
    }

    if ($isIntro && $accessToken !== null) {
        maybeNotifyAdmin($accessToken);
    }
}

function handleDirectCommand(
    string $userId,
    string $text,
    string $replyToken,
    ?string $accessToken
): void {
    if ($accessToken === null || $replyToken === '') {
        return;
    }

    if (preg_match('/^管理者登録\s+([0-9A-Fa-f]+)$/u', $text, $matches) === 1) {
        $code = strtoupper((string)$matches[1]);
        if (!hash_equals(KS_ADMIN_SETUP_CODE_HASH, hash('sha256', $code))) {
            replyMessages($accessToken, $replyToken, ['管理者登録コードが違います。']);
            return;
        }

        [$lock, $state] = lockAndLoadState();
        $existingAdmin = (string)($state['admin_user_id'] ?? '');
        if ($existingAdmin !== '' && $existingAdmin !== $userId) {
            saveAndUnlockState($lock, $state);
            replyMessages($accessToken, $replyToken, ['管理者はすでに登録されています。']);
            return;
        }

        $state['admin_user_id'] = $userId;
        saveAndUnlockState($lock, $state);
        replyMessages(
            $accessToken,
            $replyToken,
            [
                "✅ 管理者登録が完了しました。\n\n使えるコマンド\n・状態\n・未投稿\n・ノート用\n・ノート反映済み\n・ヘルプ"
            ]
        );
        maybeNotifyAdmin($accessToken);
        return;
    }

    [$lock, $state] = lockAndLoadState();
    $isAdmin = ((string)($state['admin_user_id'] ?? '') === $userId);

    if (!$isAdmin) {
        saveAndUnlockState($lock, $state);
        replyMessages(
            $accessToken,
            $replyToken,
            ['このBOTの管理コマンドは運営者専用です。']
        );
        return;
    }

    if ($text === '状態') {
        $summary = buildStatusText($state);
        saveAndUnlockState($lock, $state);
        replyMessages($accessToken, $replyToken, [$summary]);
        return;
    }

    if ($text === '未投稿') {
        $summary = buildMissingIntroText($state);
        saveAndUnlockState($lock, $state);
        replyMessages($accessToken, $replyToken, splitTextMessages($summary));
        return;
    }

    if ($text === 'ノート用') {
        $members = getOrCreatePendingBatch($state);
        $count = count($members);
        if ($count === 0) {
            saveAndUnlockState($lock, $state);
            replyMessages($accessToken, $replyToken, ['未反映の自己紹介はありません。']);
            return;
        }

        $noteText = buildNoteText($members);
        saveAndUnlockState($lock, $state);
        replyMessages($accessToken, $replyToken, splitTextMessages($noteText));
        return;
    }

    if ($text === 'ノート反映済み') {
        $count = markPendingBatchReflected($state);
        $remaining = countUnreflectedIntros($state);

        if ($remaining >= KS_NOTE_BATCH_SIZE) {
            $state['meta']['threshold_notified'] = true;
        } else {
            $state['meta']['threshold_notified'] = false;
        }
        $state['meta']['age_notified'] = false;

        saveAndUnlockState($lock, $state);

        if ($count === 0) {
            replyMessages($accessToken, $replyToken, ['反映待ちのノート用バッチはありません。']);
            return;
        }

        $message = "✅ {$count}人分をノート反映済みにしました。";
        if ($remaining >= KS_NOTE_BATCH_SIZE) {
            $message .= "\nまだ{$remaining}人分あります。続けて「ノート用」で次の20人を出せます。";
        } elseif ($remaining > 0) {
            $message .= "\n未反映はあと{$remaining}人です。";
        } else {
            $message .= "\n未反映は0人です。";
        }
        replyMessages($accessToken, $replyToken, [$message]);
        return;
    }

    if ($text === 'ヘルプ') {
        saveAndUnlockState($lock, $state);
        replyMessages(
            $accessToken,
            $replyToken,
            [
                "運営コマンド\n\n状態：登録状況を確認\n未投稿：観測できている未投稿者を確認\nノート用：未反映の自己紹介を最大20人分まとめる\nノート反映済み：直前の20人を処理済みにする"
            ]
        );
        return;
    }

    saveAndUnlockState($lock, $state);
    replyMessages(
        $accessToken,
        $replyToken,
        ['「状態」「未投稿」「ノート用」「ノート反映済み」「ヘルプ」のいずれかを送ってください。']
    );
}

function handleCronRequest(string $channelId, string $channelSecret): void
{
    $cronKeyPath = __DIR__ . '/cron_key.php';
    if (!is_file($cronKeyPath)) {
        http_response_code(503);
        echo "cron key missing\n";
        return;
    }

    $cronKey = require $cronKeyPath;
    $expectedHash = is_array($cronKey) ? (string)($cronKey['token_hash'] ?? '') : '';
    $provided = (string)($_SERVER['HTTP_X_KS_CRON_TOKEN'] ?? '');

    if ($expectedHash === '' || $provided === ''
        || !hash_equals($expectedHash, hash('sha256', $provided))) {
        http_response_code(401);
        echo "unauthorized\n";
        return;
    }

    $accessToken = issueStatelessToken($channelId, $channelSecret);
    if ($accessToken !== null) {
        maybeNotifyAdmin($accessToken, true);
    }

    [$lock, $state] = lockAndLoadState();
    $state['meta']['last_cron_at'] = nowIso();
    saveAndUnlockState($lock, $state);

    http_response_code(200);
    header('Content-Type: text/plain; charset=utf-8');
    echo "ok\n";
}

function maybeNotifyAdmin(string $accessToken, bool $dailyCheck = false): void
{
    [$lock, $state] = lockAndLoadState();
    $adminUserId = (string)($state['admin_user_id'] ?? '');
    if ($adminUserId === '') {
        saveAndUnlockState($lock, $state);
        return;
    }

    $count = countUnreflectedIntros($state);
    if ($count === 0) {
        $state['meta']['threshold_notified'] = false;
        $state['meta']['age_notified'] = false;
        saveAndUnlockState($lock, $state);
        return;
    }

    $message = null;
    $flag = null;

    if ($count >= KS_NOTE_BATCH_SIZE && !($state['meta']['threshold_notified'] ?? false)) {
        $message = "🏄 自己紹介が{$count}人分たまりました。\n「ノート用」と送ると、最大20人分をまとめて出します。";
        $flag = 'threshold_notified';
    } elseif ($dailyCheck && !($state['meta']['age_notified'] ?? false)) {
        $oldest = oldestUnreflectedIntroTimestamp($state);
        if ($oldest !== null && (time() - $oldest) >= KS_NOTE_MAX_AGE_DAYS * 86400) {
            $message = "🏄 未反映の自己紹介が30日経過しました。\n現在{$count}人分あります。\n「ノート用」と送るとまとめて出します。";
            $flag = 'age_notified';
        }
    }

    if ($message === null || $flag === null) {
        saveAndUnlockState($lock, $state);
        return;
    }

    saveAndUnlockState($lock, $state);

    if (pushText($accessToken, $adminUserId, $message)) {
        [$lock2, $state2] = lockAndLoadState();
        $state2['meta'][$flag] = true;
        saveAndUnlockState($lock2, $state2);
    }
}

function welcomeText(): string
{
    return <<<'TEXT'
🌊 参加ありがとうございます！

関西サーフィン・仲間探しへようこそ🏄

このグループは
🏄 サーフ仲間探し
🚗 相乗り募集
🏕️ サーフキャンプ・オフ会
など、実際につながるためのグループです。

👇 まず簡単な自己紹介をお願いします😊

#自己紹介
ニックネーム：
住んでいるエリア：
よく行くポイント：
サーフィン歴：
ショート・ロングなど：
車あり／なし：
平日・土日：
ひとこと：

全部書かなくてもOKです🙆‍♂️
このトークにそのまま送ってください。

⚠️ お願い
・営業、勧誘は禁止
・出会い目的のみの利用は禁止
・誹謗中傷、迷惑行為は禁止
・相乗りの費用や集合時間は事前に確認
・安全第一でお願いします

みんなで気持ちよく楽しめるグループにしていきましょう🤙

関西サーファーKS
TEXT;
}

function containsIntroTag(string $text): bool
{
    return mb_stripos($text, '#自己紹介') !== false
        || mb_stripos($text, '＃自己紹介') !== false;
}

function cleanIntroText(string $text): string
{
    $text = str_replace(['#自己紹介', '＃自己紹介'], '', $text);
    return trim($text);
}

function buildStatusText(array $state): string
{
    $active = 0;
    $posted = 0;
    foreach ($state['members'] as $member) {
        if (!($member['active'] ?? false)) {
            continue;
        }
        $active++;
        if (isActiveIntro($member)) {
            $posted++;
        }
    }

    $missing = max(0, $active - $posted);
    $unreflected = countUnreflectedIntros($state);

    return "🏄 自己紹介管理\n\n観測できている在籍：{$active}人\n自己紹介済み：{$posted}人\n未投稿：{$missing}人\nノート未反映：{$unreflected}人";
}

function buildMissingIntroText(array $state): string
{
    $missing = [];
    foreach ($state['members'] as $member) {
        if (!($member['active'] ?? false) || isActiveIntro($member)) {
            continue;
        }
        $name = (string)($member['display_name'] ?? '');
        if ($name === '') {
            $name = '表示名未取得';
        }
        $joined = (string)($member['joined_at'] ?? '');
        $days = 0;
        $ts = strtotime($joined);
        if ($ts !== false) {
            $days = max(0, (int)floor((time() - $ts) / 86400));
        }
        $missing[] = "・{$name}（BOT確認から{$days}日）";
    }

    if ($missing === []) {
        return "✅ 観測できている範囲では、自己紹介未投稿者はいません。";
    }

    return "自己紹介未投稿\n※BOTが観測できているメンバーのみ\n\n" . implode("\n", $missing);
}

function getOrCreatePendingBatch(array &$state): array
{
    $pendingId = (string)($state['meta']['pending_batch_id'] ?? '');
    if ($pendingId !== '') {
        $existing = [];
        foreach ($state['members'] as $member) {
            if (($member['intro']['pending_batch_id'] ?? '') === $pendingId
                && !($member['intro']['note_reflected'] ?? false)
                && isActiveIntro($member)) {
                $existing[] = $member;
            }
        }
        if ($existing !== []) {
            usort($existing, fn(array $a, array $b): int =>
                strcmp((string)$a['intro']['submitted_at'], (string)$b['intro']['submitted_at'])
            );
            return $existing;
        }
    }

    $eligible = [];
    foreach ($state['members'] as $key => $member) {
        if (!isActiveIntro($member)) {
            continue;
        }
        if ($member['intro']['note_reflected'] ?? false) {
            continue;
        }
        $eligible[$key] = $member;
    }

    uasort($eligible, fn(array $a, array $b): int =>
        strcmp((string)$a['intro']['submitted_at'], (string)$b['intro']['submitted_at'])
    );

    $selected = array_slice($eligible, 0, KS_NOTE_BATCH_SIZE, true);
    if ($selected === []) {
        return [];
    }

    $batchId = gmdate('YmdHis') . '-' . bin2hex(random_bytes(3));
    $state['meta']['pending_batch_id'] = $batchId;

    foreach (array_keys($selected) as $key) {
        $state['members'][$key]['intro']['pending_batch_id'] = $batchId;
    }

    return array_values($selected);
}

function buildNoteText(array $members): string
{
    $lines = [
        '🏄 自己紹介まとめ',
        date('Y/m/d'),
        '',
    ];

    $i = 1;
    foreach ($members as $member) {
        $name = trim((string)($member['display_name'] ?? ''));
        if ($name === '') {
            $name = 'メンバー';
        }
        $intro = trim((string)($member['intro']['text'] ?? ''));

        $lines[] = "【{$i}. {$name}】";
        $lines[] = $intro;
        $lines[] = '';
        $lines[] = '──────────';
        $lines[] = '';
        $i++;
    }

    $lines[] = '関西サーファーKS';
    return trim(implode("\n", $lines));
}

function markPendingBatchReflected(array &$state): int
{
    $pendingId = (string)($state['meta']['pending_batch_id'] ?? '');
    if ($pendingId === '') {
        return 0;
    }

    $count = 0;
    foreach ($state['members'] as &$member) {
        if (($member['intro']['pending_batch_id'] ?? '') !== $pendingId) {
            continue;
        }
        $member['intro']['note_reflected'] = true;
        $member['intro']['note_reflected_at'] = nowIso();
        $member['intro']['pending_batch_id'] = null;
        $count++;
    }
    unset($member);

    $state['meta']['pending_batch_id'] = null;
    return $count;
}

function splitTextMessages(string $text): array
{
    $max = 4500;
    if (mb_strlen($text) <= $max) {
        return [$text];
    }

    $messages = [];
    $current = '';

    foreach (explode("\n", $text) as $line) {
        $candidate = $current === '' ? $line : $current . "\n" . $line;
        if (mb_strlen($candidate) > $max) {
            if ($current !== '') {
                $messages[] = $current;
            }
            $current = $line;
            if (count($messages) >= 4) {
                break;
            }
        } else {
            $current = $candidate;
        }
    }

    if ($current !== '' && count($messages) < 5) {
        $messages[] = $current;
    }

    return array_slice($messages, 0, 5);
}

function countUnreflectedIntros(array $state): int
{
    $count = 0;
    foreach ($state['members'] as $member) {
        if (!isActiveIntro($member)) {
            continue;
        }
        if (!($member['intro']['note_reflected'] ?? false)) {
            $count++;
        }
    }
    return $count;
}

function oldestUnreflectedIntroTimestamp(array $state): ?int
{
    $oldest = null;
    foreach ($state['members'] as $member) {
        if (!isActiveIntro($member) || ($member['intro']['note_reflected'] ?? false)) {
            continue;
        }
        $ts = strtotime((string)($member['intro']['submitted_at'] ?? ''));
        if ($ts === false) {
            continue;
        }
        $oldest = $oldest === null ? $ts : min($oldest, $ts);
    }
    return $oldest;
}

function isActiveIntro(array $member): bool
{
    return isset($member['intro'])
        && is_array($member['intro'])
        && ($member['intro']['active'] ?? false)
        && trim((string)($member['intro']['text'] ?? '')) !== '';
}

function recalculateNotificationFlags(array &$state): void
{
    $count = countUnreflectedIntros($state);
    if ($count < KS_NOTE_BATCH_SIZE) {
        $state['meta']['threshold_notified'] = false;
    }
    if ($count === 0) {
        $state['meta']['age_notified'] = false;
        $state['meta']['pending_batch_id'] = null;
    }
}

function upsertMember(
    array &$state,
    string $groupId,
    string $userId,
    string $displayName,
    string $joinedAt
): void {
    $key = memberKey($groupId, $userId);
    if (!isset($state['members'][$key])) {
        $state['members'][$key] = [
            'group_id' => $groupId,
            'user_id' => $userId,
            'display_name' => $displayName,
            'joined_at' => $joinedAt,
            'active' => true,
        ];
        return;
    }

    $state['members'][$key]['active'] = true;
    if ($displayName !== '') {
        $state['members'][$key]['display_name'] = $displayName;
    }
}

function memberKey(string $groupId, string $userId): string
{
    return hash('sha256', $groupId . '|' . $userId);
}

function initialState(): array
{
    return [
        'version' => 1,
        'admin_user_id' => null,
        'members' => [],
        'meta' => [
            'pending_batch_id' => null,
            'threshold_notified' => false,
            'age_notified' => false,
            'last_cron_at' => null,
        ],
    ];
}

function lockAndLoadState(): array
{
    $lock = fopen(KS_STATE_LOCK, 'c+');
    if ($lock === false) {
        throw new RuntimeException('KS LINE bot: failed to open state lock.');
    }
    if (!flock($lock, LOCK_EX)) {
        fclose($lock);
        throw new RuntimeException('KS LINE bot: failed to lock state.');
    }

    $state = initialState();
    if (is_file(KS_STATE_FILE)) {
        $loaded = require KS_STATE_FILE;
        if (is_array($loaded)) {
            $state = array_replace_recursive($state, $loaded);
        }
    }

    return [$lock, $state];
}

function saveAndUnlockState($lock, array $state): void
{
    $content = "<?php\nreturn " . var_export($state, true) . ";\n";
    $tmp = KS_STATE_FILE . '.tmp';

    if (file_put_contents($tmp, $content, LOCK_EX) === false) {
        flock($lock, LOCK_UN);
        fclose($lock);
        throw new RuntimeException('KS LINE bot: failed to write state.');
    }

    if (!rename($tmp, KS_STATE_FILE)) {
        @unlink($tmp);
        flock($lock, LOCK_UN);
        fclose($lock);
        throw new RuntimeException('KS LINE bot: failed to replace state.');
    }

    flock($lock, LOCK_UN);
    fclose($lock);
}

function nowIso(): string
{
    return gmdate('c');
}

function getGroupMemberProfile(
    string $channelAccessToken,
    string $groupId,
    string $userId
): array {
    $url = 'https://api.line.me/v2/bot/group/'
        . rawurlencode($groupId)
        . '/member/'
        . rawurlencode($userId);

    $ch = curl_init($url);
    if ($ch === false) {
        return [];
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $channelAccessToken,
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($response === false || $httpCode < 200 || $httpCode >= 300) {
        return [];
    }

    $decoded = json_decode($response, true);
    return is_array($decoded) ? $decoded : [];
}

function issueStatelessToken(string $channelId, string $channelSecret): ?string
{
    $ch = curl_init('https://api.line.me/oauth2/v3/token');
    if ($ch === false) {
        error_log('KS LINE bot: failed to initialize token cURL.');
        return null;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/x-www-form-urlencoded',
        ],
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'client_credentials',
            'client_id' => $channelId,
            'client_secret' => $channelSecret,
        ], '', '&', PHP_QUERY_RFC3986),
    ]);

    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $httpCode < 200 || $httpCode >= 300) {
        error_log(
            'KS LINE bot: token issue failed. http=' . $httpCode .
            ($curlError !== '' ? ' curl_error=' . $curlError : '')
        );
        return null;
    }

    try {
        $decoded = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        error_log('KS LINE bot: invalid token response JSON.');
        return null;
    }

    $accessToken = (string)($decoded['access_token'] ?? '');
    if ($accessToken === '') {
        error_log('KS LINE bot: token response did not contain access_token.');
        return null;
    }

    return $accessToken;
}

function replyMessages(
    string $channelAccessToken,
    string $replyToken,
    array $texts
): bool {
    $messages = [];
    foreach (array_slice($texts, 0, 5) as $text) {
        $messages[] = [
            'type' => 'text',
            'text' => mb_substr((string)$text, 0, 5000),
        ];
    }

    $body = json_encode(
        [
            'replyToken' => $replyToken,
            'messages' => $messages,
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    );

    return sendLineRequest(
        'https://api.line.me/v2/bot/message/reply',
        $channelAccessToken,
        $body
    );
}

function pushText(
    string $channelAccessToken,
    string $to,
    string $text
): bool {
    $body = json_encode(
        [
            'to' => $to,
            'messages' => [
                [
                    'type' => 'text',
                    'text' => mb_substr($text, 0, 5000),
                ],
            ],
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    );

    return sendLineRequest(
        'https://api.line.me/v2/bot/message/push',
        $channelAccessToken,
        $body
    );
}

function sendLineRequest(
    string $url,
    string $channelAccessToken,
    string $body
): bool {
    $ch = curl_init($url);
    if ($ch === false) {
        return false;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $channelAccessToken,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $body,
    ]);

    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $httpCode < 200 || $httpCode >= 300) {
        error_log(
            'KS LINE bot: LINE request failed. http=' . $httpCode .
            ($curlError !== '' ? ' curl_error=' . $curlError : '')
        );
        return false;
    }

    return true;
}
