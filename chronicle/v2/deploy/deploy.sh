#!/usr/bin/env bash
# Firebase Hosting への公開（プロジェクト luminous-chronicle）。持ち主 2026-09-28「Firebase に移行」
#   HEAD の中身だけでビルドする（作業中の変更は入れない）→ pack_web で体験版の範囲を固める → GA4 のタグを入れる → deploy
#   必要な環境変数: FIREBASE_SERVICE_ACCOUNT（サービスアカウントの JSON。Firebase Hosting 管理者）、GA4_ID（G-XXXX、任意）
#   使い方: bash chronicle/v2/deploy/deploy.sh [--dry] [--full]
#   --full: 製品版（DB.config.slice を偽にし、全地方の絵を入れる）を、公開中の体験版とは別のプレビュー用 URL（チャンネル full、30 日で切れる）に出す。
#           テストプレイ用なので GA4 のタグは入れない。持ち主 2026-10-01「製品版をテストプレイしたいから、どこかにアップ」
set -euo pipefail
DRY=; FULL=
for a in "$@"; do case "$a" in --dry) DRY=--dry;; --full) FULL=1;; *) echo "unknown option $a"; exit 1;; esac; done
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
WORK=${DEPLOY_WORK:-/tmp/claude-0/deploy_work}
rm -rf "${WORK:?}" && mkdir -p "$WORK"
# v2/design（撮影や資料 1.4GB）はビルドに要らないので入れない
git -C "$ROOT" archive HEAD chronicle/v2/src chronicle/v2/tools chronicle/v2/assets chronicle/assets chronicle/design/portraits chronicle/design/voice chronicle/tools | tar -x -C "$WORK"
mkdir -p "$WORK/chronicle/v2/dist"   # 文字のキャッシュ（.fontcache）は作業のツリーから写す（無ければ build が作る）
[ -d "$ROOT/chronicle/v2/dist/.fontcache" ] && cp -r "$ROOT/chronicle/v2/dist/.fontcache" "$WORK/chronicle/v2/dist/"
cd "$WORK/chronicle/v2"
SCOPE=demo
if [ -n "$FULL" ]; then
  grep -q "^    slice: true," src/data/config.js || { echo "config.js: slice: true not found"; exit 1; }
  sed -i 's/^    slice: true,/    slice: false,/' src/data/config.js
  SCOPE=all
fi
node tools/build.js > /dev/null
python3 tools/pack_web.py --dist dist --out "$WORK/public" --scope "$SCOPE" ${FULL:+--no-size-limits} > "$WORK/pack.log" 2>&1 || { tail -20 "$WORK/pack.log"; exit 1; }
GA4_ID=${GA4_ID:-G-GKKGJ8PJR8}   # GA4 の測定 ID（Firebase のウェブアプリ Luminous Chronicle）
if [ -n "${GA4_ID:-}" ] && [ -z "$FULL" ]; then
  python3 - "$WORK/public/index.html" "$GA4_ID" <<'PY'
import sys
p, gid = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf8').read()
tag = f'<script async src="https://www.googletagmanager.com/gtag/js?id={gid}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag("js",new Date());gtag("config","{gid}");</script>'
if 'googletagmanager' not in s:
    s = s.replace('</head>', tag + '</head>', 1)
open(p, 'w', encoding='utf8').write(s)
PY
fi
cp "$ROOT/chronicle/v2/deploy/firebase.json" "$ROOT/chronicle/v2/deploy/.firebaserc" "$WORK/"
du -sh "$WORK/public"
[ "$DRY" = "--dry" ] && { echo "dry run: $WORK/public"; exit 0; }
# 鍵: 環境変数 FIREBASE_SERVICE_ACCOUNT（JSON の中身）か、/tmp/claude-0/secrets/firebase_sa.json（リポジトリには置かない）
KEYF=/tmp/claude-0/secrets/firebase_sa.json
if [ -n "${FIREBASE_SERVICE_ACCOUNT:-}" ]; then KEYF=$(mktemp /tmp/claude-0/secrets/fb_sa.XXXXXX.json); trap 'rm -f "$KEYF"' EXIT; printf '%s' "$FIREBASE_SERVICE_ACCOUNT" > "$KEYF"; chmod 600 "$KEYF"; fi
[ -f "$KEYF" ] || { echo "no Firebase key (FIREBASE_SERVICE_ACCOUNT or $KEYF)"; exit 1; }
if [ -n "$FULL" ]; then
  cd "$WORK" && GOOGLE_APPLICATION_CREDENTIALS="$KEYF" npx --yes firebase-tools@latest hosting:channel:deploy full --expires 30d --project luminous-chronicle --non-interactive
else
  cd "$WORK" && GOOGLE_APPLICATION_CREDENTIALS="$KEYF" npx --yes firebase-tools@latest deploy --only hosting --project luminous-chronicle --non-interactive
fi
