<?php
declare(strict_types=1);

if ($argc !== 3) {
    fwrite(STDERR, "usage: patch source target\n");
    exit(2);
}
$source=(string)$argv[1];
$target=(string)$argv[2];
$text=file_get_contents($source);
if(!is_string($text)){fwrite(STDERR,"read failed\n");exit(3);}

$old=<<<'PHP'
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
PHP;

$new=<<<'PHP'
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

「#自己紹介」は付けなくてもOKです。
次のどれかで送るとBotが自己紹介として登録します。

・#自己紹介
・ニックネーム：〇〇
・はじめまして！〇〇です。〜

例）
ニックネーム：
住んでいるエリア：
よく行くポイント：
サーフィン歴：
ショート・ロングなど：
車あり／なし：
平日・土日：
ひとこと：

全部書かなくてもOKです🙆‍♂️
自然な文章でも大丈夫です。
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
PHP;

if(substr_count($text,$old)!==1){fwrite(STDERR,"expected welcomeText block not found exactly once\n");exit(4);}
$patched=str_replace($old,$new,$text,$count);
if($count!==1){fwrite(STDERR,"unexpected replacement count\n");exit(5);}
if(file_put_contents($target,$patched)===false){fwrite(STDERR,"write failed\n");exit(6);}
echo "patched\n";
