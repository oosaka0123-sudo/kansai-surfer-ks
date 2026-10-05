<?php
declare(strict_types=1);

if ($argc < 3) {
    fwrite(STDERR, "usage: php extract-line-runtime-config.php CURRENT_WEBHOOK OUTPUT_CONFIG [CURRENT_CONFIG]\n");
    exit(2);
}

$webhookPath = $argv[1];
$outputPath = $argv[2];
$configPath = $argv[3] ?? '';

$webhook = is_file($webhookPath) ? (string)file_get_contents($webhookPath) : '';
$configSource = $configPath !== '' && is_file($configPath)
    ? (string)file_get_contents($configPath)
    : '';

function firstMatch(array $patterns, string $source): string
{
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $source, $matches) === 1) {
            return (string)($matches[2] ?? '');
        }
    }
    return '';
}

$secretPatterns = [
    '/([\'"])channel_secret\1\s*=>\s*([\'"])([^\'"]+)\2/',
];

$tokenPatterns = [
    '/([\'"])channel_access_token\1\s*=>\s*([\'"])([^\'"]+)\2/',
    '/([\'"])access_token\1\s*=>\s*([\'"])([^\'"]+)\2/',
];

function arrayValue(string $source, array $keys): string
{
    foreach ($keys as $key) {
        $pattern = '/[\'"]' . preg_quote($key, '/') . '[\'"]\s*=>\s*([\'"])(.*?)\1/s';
        if (preg_match($pattern, $source, $m) === 1) {
            return (string)$m[2];
        }
    }
    return '';
}

function variableValue(string $source, array $names): string
{
    foreach ($names as $name) {
        $pattern = '/\$' . preg_quote($name, '/') . '\s*=\s*([\'"])(.*?)\1\s*;/s';
        if (preg_match($pattern, $source, $m) === 1) {
            return (string)$m[2];
        }
    }
    return '';
}

$channelSecret = arrayValue($configSource, ['channel_secret', 'channelSecret']);
$accessToken = arrayValue($configSource, ['channel_access_token', 'access_token', 'accessToken']);

if ($channelSecret === '') {
    $channelSecret = variableValue($webhook, ['channelSecret', 'channel_secret']);
}
if ($accessToken === '') {
    $accessToken = variableValue($webhook, ['accessToken', 'access_token']);
}

if (strlen($channelSecret) < 16 || strlen($accessToken) < 20) {
    fwrite(STDERR, "Unable to extract valid LINE runtime credentials.\n");
    exit(1);
}

$config = [
    'channel_secret' => $channelSecret,
    'channel_access_token' => $accessToken,
];

$content = "<?php\ndeclare(strict_types=1);\n\nreturn " . var_export($config, true) . ";\n";
if (file_put_contents($outputPath, $content) === false) {
    fwrite(STDERR, "Unable to write runtime config.\n");
    exit(1);
}

@chmod($outputPath, 0600);
fwrite(STDOUT, "LINE runtime config extracted without printing credentials.\n");
