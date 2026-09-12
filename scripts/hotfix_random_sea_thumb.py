from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: hotfix_random_sea_thumb.py <save_post.php>")

p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8")

if "function ks_random_sea_thumb" in text:
    print("random sea eyecatch patch already present")
    raise SystemExit(0)

anchor = "\nfunction ks_related_posts_html("
if anchor not in text:
    raise SystemExit("helper anchor not found")

helper = r'''
function ks_random_sea_thumb($root){
    $candidates = [
        "/img/isonoura_hero.jpg",
        "/img/kounohama_hero.jpg",
        "/img/ikumi_guide_hero.jpeg",
        "/img/komatsu_guide_hero.jpeg",
        "/img/irago_guide_hero.jpeg",
        "/img/shizunami_guide_hero.jpeg",
        "/img/hakuto_guide_hero.jpeg"
    ];
    $available = [];
    foreach($candidates as $path){
        if (file_exists($root . $path)) $available[] = $path;
    }
    if (empty($available)) return "";
    try {
        return $available[random_int(0, count($available) - 1)];
    } catch (Throwable $e) {
        return $available[array_rand($available)];
    }
}
'''
text = text.replace(anchor, "\n" + helper + anchor, 1)

replacements = [
    (
        '$thumbPath = "../" . ltrim($thumb, "/");',
        '$thumbPath = (strpos($thumb, "/") === 0) ? $thumb : "../" . ltrim($thumb, "/");',
        "related thumb anchor",
    ),
    (
        '$ogImage = ($thumbRelative !== "" && $thumbRelative !== "img/noimage.jpg") ? $siteUrl."/blog/".$thumbRelative : "";',
        '$ogImage = ($thumbRelative !== "" && $thumbRelative !== "img/noimage.jpg") ? ((strpos($thumbRelative, "/") === 0) ? $siteUrl.$thumbRelative : $siteUrl."/blog/".$thumbRelative) : "";',
        "OG image anchor",
    ),
    (
        '$articleThumb = ($thumb !== "img/noimage.jpg") ? "../" . $thumb : "";',
        '$articleThumb = ($thumb !== "img/noimage.jpg") ? ((strpos($thumb, "/") === 0) ? $thumb : "../" . $thumb) : "";',
        "edit thumb anchor",
    ),
]

for old, new, label in replacements:
    if old not in text:
        raise SystemExit(f"{label} not found")
    text = text.replace(old, new, 1)

anchor = '$inlineHtmls = [];'
if anchor not in text:
    raise SystemExit("inline image anchor not found")

random_block = r'''// 新規投稿で画像未指定なら、既存の海・サーフポイント写真からランダム設定
$explicitClear = (($_POST["selectedThumb"] ?? "") === "__clear__");
if ($editSlug === "" && !$explicitClear && $thumb === "img/noimage.jpg") {
    $seaThumb = ks_random_sea_thumb($root);
    if ($seaThumb !== "") {
        $thumb = $seaThumb;
        $articleThumb = $seaThumb;
    }
}

'''
text = text.replace(anchor, random_block + anchor, 1)
p.write_text(text, encoding="utf-8")
print("random sea eyecatch patch ready")
