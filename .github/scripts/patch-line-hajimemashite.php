<?php
declare(strict_types=1);

if ($argc !== 3) {
    fwrite(STDERR, "usage: patch source target\n");
    exit(2);
}

$source = (string)$argv[1];
$target = (string)$argv[2];
$text = file_get_contents($source);
if (!is_string($text)) {
    fwrite(STDERR, "failed to read source\n");
    exit(3);
}

$old = <<<'PHP'
function containsIntroTag(string $text): bool
{
    if (
        mb_stripos($text, '#自己紹介') !== false
        || mb_stripos($text, '＃自己紹介') !== false
    ) {
        return true;
    }

    // Also treat the standard self-introduction template as an intro
    // even when the member omits the #自己紹介 tag.
    // Require an actual nickname value to avoid matching casual chat.
    return preg_match(
        '/(?:^|\R)[\t 　]*ニックネーム[\t 　]*[：:][\t 　]*\S+/u',
        $text
    ) === 1;
}
PHP;

$new = <<<'PHP'
function containsIntroTag(string $text): bool
{
    if (
        mb_stripos($text, '#自己紹介') !== false
        || mb_stripos($text, '＃自己紹介') !== false
    ) {
        return true;
    }

    // Standard self-introduction template without the #自己紹介 tag.
    if (
        preg_match(
            '/(?:^|\R)[\t 　]*ニックネーム[\t 　]*[：:][\t 　]*\S+/u',
            $text
        ) === 1
    ) {
        return true;
    }

    // Natural introductions such as "はじめまして！ミカンです。..."
    // are accepted only when the message starts with the greeting.
    return preg_match('/^[\t 　]*はじめまして/u', $text) === 1;
}
PHP;

if (substr_count($text, $old) !== 1) {
    fwrite(STDERR, "expected live containsIntroTag block not found exactly once\n");
    exit(4);
}

$patched = str_replace($old, $new, $text, $count);
if ($count !== 1) {
    fwrite(STDERR, "unexpected replacement count\n");
    exit(5);
}

if (file_put_contents($target, $patched) === false) {
    fwrite(STDERR, "failed to write target\n");
    exit(6);
}
echo "patched\n";
