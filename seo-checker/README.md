# SEOチェッカーの取得プロキシ

SEOチェッカー本体は **https://off-notes.com/seo-checker/** にある
（リポジトリ `YukiIkemori/off-notes-yuki-site` の `_drafts/seo-checker/` と `tools-seochecker-publish.py`）。

このフォルダは、その道具が使う**取得専用の裏方**。Cloudflare Pages のプロジェクト
`seo-checker-bs4`（ルートディレクトリ `seo-checker`、ビルドなし）としてデプロイされている。

## なぜ別にあるか

ブラウザは他サイトの HTML を直接読めない（CORS）ので、診断対象のページを代わりに取ってくる中継が要る。
OFF NOTES は Firebase Hosting でサーバー側の処理を置けないため、中継だけをここに残した。
はじめはツール本体もここ（`seo-checker-bs4.pages.dev`）で公開していたが、2026-11-13 に OFF NOTES へ移した。

## 中身

| パス | 役割 |
|---|---|
| `functions/api/fetch.js` | `GET /api/fetch?url=…` ページを取得し、ステータス・リダイレクト経路・レスポンスヘッダーを付けて返す |
| `functions/api/check.js` | `POST /api/check` リンク先の HTTP ステータスをまとめて返す（1回12件まで） |
| `worker/worker.js` | 同じ処理を単体の Cloudflare Worker として動かす場合のエントリ（いまは未使用） |
| `_redirects` | 以前ここにあった画面の URL を off-notes.com へ 301 する |
| `_headers` | 残っている応答を検索に出さない（noindex） |

## 呼び出せる相手

`https://off-notes.com` と、このプロジェクト自身のオリジンだけ。ほかのオリジンから使う場合は
Cloudflare の環境変数 `ALLOWED_ORIGINS`（カンマ区切り）に足す。Origin ヘッダーの無い呼び出し
（curl など）は通るので、完全な制限ではなく「第三者のサイトに踏み台として組み込まれない」ための絞り込み。

## 費用

Cloudflare の無料枠で動いている（1日10万リクエストまでという理解。超えるとその日はエラーになるだけで課金されない。
公開前に公式の料金ページで確認すること）。1ページ診断で 4〜10 回、サイト全体診断（50ページ）で 60〜70 回呼ぶ。

## 変更するとき

このブランチに push すると Cloudflare Pages が自動でデプロイする（反映まで10分前後かかることがある）。
応答の形式（`x-seo-*` ヘッダー、`/api/check` の JSON）を変えたら、OFF NOTES 側の
`_drafts/seo-checker/js/fetcher.js` も合わせて直すこと。
